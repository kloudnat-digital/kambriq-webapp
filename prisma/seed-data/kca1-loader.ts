/**
 * KCA1 loader parser.
 *
 * Provides pure functions for parsing Word HTML into structured course data,
 * and reading CSVs for quiz questions. Extracted from the side-effecting
 * script for testability without requiring a Drive mount or deployment.
 *
 * Parses structure based on block text content (e.g. `PARCOURS n -`) rather
 * than markup to ensure robustness against varying Word HTML outputs.
 */

import { parse } from 'csv-parse/sync';

import { LessonContentType } from '@kambriq/common/constants/kbs/lesson-content';
import { type KbsLessonMediaKind } from '@kambriq/common/constants/kbs/lesson-media';

import { orderAnswers, type SeedQuestion } from './kbs-questions';

/**
 * Media slot marker types matching KbsLessonMediaKind.
 */
export type Kca1MarkerKind = KbsLessonMediaKind;

/**
 * Document markers indicating media slots.
 * Kept exactly as they appear in the source document (including accents).
 */
export const MARKER_LITERALS: ReadonlyArray<readonly [Kca1MarkerKind, string]> = [
  ['VIDEO', '[EMPLACEMENT VIDÉO]'],
  ['IMAGE', '[EMPLACEMENT IMAGE]'],
  ['DOCUMENT', '[EMPLACEMENT DOCUMENT]'],
];

/**
 * Expected casing for lesson content type.
 * Must be 'HTML' to match runtime conditions.
 */
export const LESSON_CONTENT_TYPE = LessonContentType.HTML;

export type Kca1Lesson = {
  /**
   * Content-derived identity, stable across reordering: `P0/M1`.
   *
   * Not a sequential index. A sequential key re-points a candidate's completion
   * the moment a lesson is inserted above it, which is exactly what step 3 has
   * to survive.
   */
  key: string;
  parcours: string;
  moduleNumber: number;
  title: string;
  goal: string;
  /** Minutes, for `KbsLesson.duration`. A range takes its lower bound. */
  durationMinutes: number;
  /** The marker exactly as written, kept because the range is information. */
  durationText: string;
  order: number;
  contentHtml: string;
  markers: Record<Kca1MarkerKind, number>;
};

/**
 * One media slot: a marker the document left for something not yet produced.
 *
 * A3. The `contentUrl` widening the brief first proposed could not work - the
 * API signs `contentUrl` only for VIDEO/PDF lessons and the web view does not
 * read it for an HTML lesson either, so a companion video on an HTML lesson was
 * unreachable through both read paths. A slot is a row instead: it names the
 * lesson it belongs to, its position within that lesson, and what the marker
 * said, and carries a `url` that is null until the file exists.
 *
 * That is what makes a slot addressable - Visquis can be shown the eighteen
 * empty ones, pick one, and attach a file without anyone re-reading the docx.
 */
export type Kca1MediaSlot = {
  kind: Kca1MarkerKind;
  /** 1-based order of this slot within its lesson, in document order. */
  position: number;
  /** What the marker said, without the bracketed prefix. */
  label: string;
};

export type Kca1Parcours = {
  code: string;
  title: string;
  subtitle: string;
  objectives: string[];
  order: number;
  lessons: Kca1Lesson[];
};

export type Kca1Answer = { text: string; isCorrect: boolean };

export type Kca1Question = {
  sourceId: string;
  parcours: string;
  text: string;
  answers: Kca1Answer[];
  explanation: string;
  tag: string;
  level: string;
};

export type Kca1Course = { parcours: Kca1Parcours[] };

/** Block elements mammoth emits at the top level of the document. */
const BLOCK_TAGS: readonly string[] = ['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'table'];

const TAG_PATTERN = /<(\/?)([a-z0-9]+)[^>]*?(\/?)>/g;

/**
 * Splits the document into its top-level blocks by tracking depth.
 *
 * Not a regex split on `<p>`: a table contains paragraphs
 * (`<table><tr><td><p>`), so splitting on the paragraph tag tears tables apart.
 * Depth tracking over the block tag set keeps a table whole and is why the test
 * asserts the joined blocks equal the input exactly - a splitter that drops a
 * block drops content, silently.
 */
export const splitTopLevelBlocks = (html: string): string[] => {
  const blocks: string[] = [];
  let depth = 0;
  let start = -1;
  TAG_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = TAG_PATTERN.exec(html);
  while (match !== null) {
    const closing = match[1] === '/';
    const name = match[2];
    const selfClosing = match[3] === '/';
    if (BLOCK_TAGS.includes(name) && !selfClosing) {
      if (!closing) {
        if (depth === 0) start = match.index;
        depth += 1;
      } else if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          blocks.push(html.slice(start, match.index + match[0].length));
          start = -1;
        }
      }
    }
    match = TAG_PATTERN.exec(html);
  }
  return blocks;
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/**
 * A block as plain text, entities decoded.
 *
 * Ten real module titles contain `&amp;`. Stored undecoded, the title renders
 * with the entity showing.
 */
export const blockText = (block: string): string =>
  block
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&([a-zA-Z]+);/g, (whole, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/\s+/g, ' ')
    .trim();

const PARCOURS_PATTERN = /^PARCOURS\s+(\d+)\s*-\s*(.+)$/;
const MODULE_PATTERN = /^MODULE\s+(\d+)\s*-\s*(.+)$/;
const CLOCK = '⏱';
const GOAL = '🎯';

/**
 * Reads the duration a module states, and refuses rather than guessing.
 *
 * 31 of the 33 real markers are a single number; two are ranges. `duration` is
 * a non-null Int, so a range has to become one value: the lower bound, with the
 * marker kept verbatim beside it so the range itself is not lost. A marker that
 * cannot be read throws, because a silently invented duration is a number
 * somebody would then plan their week around.
 */
export const parseDuration = (clockText: string): { minutes: number; verbatim: string } => {
  const match = /⏱\s*(\d+(?:\s*-\s*\d+)?)\s*min/.exec(clockText);
  if (!match) {
    throw new Error(
      `cannot read a duration marker from ${JSON.stringify(clockText)} - it must read ` +
        `like "${CLOCK} 25 min" or "${CLOCK} 25-30 min"`,
    );
  }
  const normalised = match[1].replace(/\s*-\s*/, '-');
  return { minutes: Number(normalised.split('-')[0]), verbatim: `${normalised} min` };
};

/** Brief rule 4: hyphen-minus only, including in seeded content. */
const hyphenMinusOnly = (html: string): string => html.replace(/[–—]/g, '-');

/**
 * Every media slot in one lesson body, in document order.
 *
 * Counting markers says how many; this says which, where, and what each one is
 * for, which is the difference between a number in a report and a slot somebody
 * can fill.
 */
export const extractSlots = (contentHtml: string): Kca1MediaSlot[] => {
  const found: Array<{ at: number; kind: Kca1MarkerKind; label: string }> = [];

  for (const [kind, literal] of MARKER_LITERALS) {
    let from = 0;
    for (;;) {
      const at = contentHtml.indexOf(literal, from);
      if (at === -1) break;
      // The marker's text runs to the end of its own element. Taking it up to
      // the next tag keeps the label to one line rather than swallowing the
      // rest of the lesson.
      const rest = contentHtml.slice(at + literal.length).split('<')[0] ?? '';
      found.push({
        at,
        kind,
        label: blockText(rest)
          .replace(/^[-\s:]+/, '')
          .trim(),
      });
      from = at + literal.length;
    }
  }

  // Document order, not family order: the position is what somebody counts
  // down the page to find.
  return found
    .sort((a, b) => a.at - b.at)
    .map((slot, index) => ({ kind: slot.kind, position: index + 1, label: slot.label }));
};

const countMarkers = (text: string): Record<Kca1MarkerKind, number> => {
  const counts: Record<Kca1MarkerKind, number> = { VIDEO: 0, IMAGE: 0, DOCUMENT: 0 };
  for (const [kind, literal] of MARKER_LITERALS) {
    counts[kind] = text.split(literal).length - 1;
  }
  return counts;
};

type OpenLesson = { lesson: Kca1Lesson; body: string[] };

/**
 * Parses the course structure out of the converted HTML.
 *
 * The clock block is consumed rather than kept in the body: its two facts
 * become `durationMinutes`/`durationText` and `goal`, so leaving it in the body
 * would state the same thing twice and let the two drift apart.
 */
export const parseCourseHtml = (html: string): Kca1Course => {
  const blocks = splitTopLevelBlocks(html);
  const parcours: Kca1Parcours[] = [];
  let current: Kca1Parcours | null = null;
  let open: OpenLesson | null = null;
  let awaitingClock = false;
  let sawObjectivesHeading = false;

  const closeLesson = () => {
    if (!open) return;
    const body = hyphenMinusOnly(open.body.join(''));
    open.lesson.contentHtml = body;
    open.lesson.markers = countMarkers(blockText(body));
    open = null;
  };

  for (const block of blocks) {
    const text = blockText(block);

    const parcoursMatch = PARCOURS_PATTERN.exec(text);
    if (parcoursMatch) {
      closeLesson();
      current = {
        code: `P${parcoursMatch[1]}`,
        title: parcoursMatch[2].trim(),
        subtitle: '',
        objectives: [],
        order: parcours.length + 1,
        lessons: [],
      };
      parcours.push(current);
      sawObjectivesHeading = false;
      continue;
    }

    const moduleMatch = MODULE_PATTERN.exec(text);
    if (moduleMatch && current) {
      closeLesson();
      const moduleNumber = Number(moduleMatch[1]);
      const lesson: Kca1Lesson = {
        key: `${current.code}/M${moduleNumber}`,
        parcours: current.code,
        moduleNumber,
        title: moduleMatch[2].trim(),
        goal: '',
        durationMinutes: 0,
        durationText: '',
        order: current.lessons.length + 1,
        contentHtml: '',
        markers: { VIDEO: 0, IMAGE: 0, DOCUMENT: 0 },
      };
      current.lessons.push(lesson);
      open = { lesson, body: [] };
      awaitingClock = true;
      continue;
    }

    if (!current) continue;

    if (awaitingClock && text.includes(CLOCK)) {
      const { minutes, verbatim } = parseDuration(text);
      const lesson = (open as OpenLesson).lesson;
      lesson.durationMinutes = minutes;
      lesson.durationText = verbatim;
      lesson.goal = text.includes(GOAL) ? text.split(GOAL)[1].trim() : '';
      awaitingClock = false;
      continue;
    }

    if (open) {
      open.body.push(block);
      continue;
    }

    // Parcours-level material, before the first module of the parcours.
    if (/^Objectifs/i.test(text)) {
      sawObjectivesHeading = true;
      continue;
    }
    if (sawObjectivesHeading && /^<ul/.test(block)) {
      current.objectives = [...block.matchAll(/<li[^>]*>(.*?)<\/li>/gs)].map((m) =>
        blockText(m[1]),
      );
      sawObjectivesHeading = false;
      continue;
    }
    if (!current.subtitle && /^<p/.test(block) && text.length > 0) {
      current.subtitle = text;
    }
  }

  closeLesson();
  return { parcours };
};

const OPTION_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['A', 'option_A'],
  ['B', 'option_B'],
  ['C', 'option_C'],
  ['D', 'option_D'],
];

/** Re-exported so the script and the tests parse CSV through one code path. */
export const parseCsvRows = (csv: string): Record<string, string>[] =>
  parse(csv, { columns: true, skip_empty_lines: true, bom: true }) as Record<string, string>[];

/**
 * Reads one parcours's quiz file, and fails loudly on a row it cannot trust.
 *
 * A question with no correct answer is a question nobody can pass, and I21
 * already showed where scoring defects end up: a certificate that certifies
 * nothing, and through KAMNET an agent. So a malformed row stops the load,
 * named, rather than being seeded and discovered by a candidate.
 */
export const parseQuizCsv = (csv: string, source: string): Kca1Question[] => {
  const rows = parseCsvRows(csv);
  return rows.map((row, index) => {
    const sourceId = (row['id'] ?? '').trim() || `row ${index + 2}`;
    const refuse = (why: string): never => {
      throw new Error(
        `${source}: question ${sourceId} ${why}. A question nobody can answer correctly is ` +
          `a question nobody can pass, so the load refuses it rather than seeding it.`,
      );
    };

    const text = (row['question'] ?? '').trim();
    if (!text) refuse('has no question text');

    const key = (row['bonne_reponse'] ?? '').trim().toUpperCase();
    if (!OPTION_COLUMNS.some(([letter]) => letter === key)) {
      refuse(
        `has bonne_reponse ${JSON.stringify(row['bonne_reponse'] ?? '')}, which is not one of A, B, C or D`,
      );
    }

    const answers: Kca1Answer[] = OPTION_COLUMNS.map(([letter, column]) => {
      const optionText = (row[column] ?? '').trim();
      if (!optionText) refuse(`has a blank ${column}`);
      return { text: optionText, isCorrect: letter === key };
    });

    return {
      sourceId,
      parcours: (row['parcours'] ?? '').trim(),
      text,
      answers,
      explanation: (row['explication'] ?? '').trim(),
      tag: (row['tag'] ?? '').trim(),
      level: (row['niveau_kca'] ?? '').trim(),
    };
  });
};

/**
 * A2 - the correct answer is moved across positions when the seed is generated.
 *
 * The source key is degenerate: A 0, B 63, C 16, D 1 over the eighty questions.
 * A candidate answering B to everything passes three of the four module quizzes
 * as written, and reaches 79 % against an 80 % exam. Visquis decided the CSV
 * files stay exactly as he wrote them and the redistribution happens here.
 *
 * `orderAnswers` and `POSITION_CYCLE` in `./kbs-questions` already do this for
 * the demonstration bank, and they are reused rather than reimplemented - one
 * mechanism, one place it can be wrong. The cycle places each position twice per
 * eight questions, so twenty questions give five apiece.
 *
 * Nothing about the content changes: the four answer TEXTS are the same four,
 * and only their order moves. Step 1 confirmed no `explication` cites an option
 * letter, so no explanation is left pointing at the wrong place.
 *
 * The index runs continuously across the parcours, matching how `prisma/seed.ts`
 * indexes its own banks.
 */
export const withDistributedAnswers = (questions: Kca1Question[]): Kca1Question[] =>
  questions.map((question, index) => {
    const correct = question.answers.findIndex((answer) => answer.isCorrect);
    if (correct === -1) {
      throw new Error(
        `question ${question.sourceId} has no correct answer, so there is nothing to place`,
      );
    }

    const shape: SeedQuestion = {
      q: question.text,
      a: question.answers.map((answer) => answer.text) as [string, string, string, string],
      correct: correct as 0 | 1 | 2 | 3,
    };

    return { ...question, answers: orderAnswers(shape, index) };
  });

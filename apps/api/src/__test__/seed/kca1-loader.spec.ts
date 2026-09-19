/* eslint-disable @nx/enforce-module-boundaries -- the loader lives in prisma/seed-data, outside any nx project; these tests exist to pin it */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LESSON_CONTENT_TYPE,
  blockText,
  extractSlots,
  parseCourseHtml,
  parseDuration,
  parseQuizCsv,
  splitTopLevelBlocks,
  withDistributedAnswers,
} from '../../../../../prisma/seed-data/kca1-loader';
import { targetPosition } from '../../../../../prisma/seed-data/kbs-questions';

/**
 * Step 1 of the KBS foundation: the loader, proved on a fixture.
 *
 * The fixture is a real `.docx`, generated once and committed, carrying two
 * parcours and three modules - and it is read through mammoth exactly as the
 * Drive document is, so the test exercises the production path rather than a
 * convenient approximation. The two CSVs carry four questions between them,
 * including one whose explication contains a comma, because 13 of the 20 rows
 * in the real P0 file would be mis-parsed by a naive `split(',')`.
 *
 * What each assertion exists to catch is named at the assertion.
 */

const FIXTURES = join(__dirname, '__fixtures__');

const readFixtureCsv = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

/**
 * mammoth is async and the fixture is binary; the real conversion runs here.
 *
 * Read through mammoth rather than from a committed HTML string on purpose: the
 * production path is docx -> mammoth -> parser, and a fixture that skipped
 * mammoth would prove the parser against markup no document produces.
 */
const fixtureHtml = async (): Promise<string> => {
  const mammoth = require('mammoth');
  const result = await mammoth.convertToHtml({ path: join(FIXTURES, 'kca1-mini.docx') });
  return result.value as string;
};

describe('KCA1 loader - block splitting', () => {
  it('splits the document into top-level blocks and loses nothing', async () => {
    const html = await fixtureHtml();
    const blocks = splitTopLevelBlocks(html);

    // Byte coverage is the property: a splitter that drops a block is a
    // splitter that drops content, silently.
    expect(blocks.join('')).toBe(html);
  });

  it('reads a block as plain text, decoding the entities titles carry', async () => {
    const html = await fixtureHtml();
    const blocks = splitTopLevelBlocks(html);
    const moduleBlock = blocks.find((b) => blockText(b).startsWith('MODULE 1 -'));

    // Ten real module titles contain `&amp;`. A title stored with the entity in
    // it is a title rendered wrong.
    expect(blockText(moduleBlock as string)).toBe('MODULE 1 - Premier module, Vision & Raison');
  });
});

describe('KCA1 loader - durations', () => {
  it('parses a single-value marker', () => {
    expect(parseDuration('⏱ 15 min   🎯 Objectif').minutes).toBe(15);
  });

  /**
   * 31 of the 33 real markers are one number; two are ranges. `duration` is a
   * non-null Int, so a range has to resolve to one value - the lower bound -
   * and the verbatim text is kept so the range itself is not lost.
   */
  it('takes the lower bound of a range and keeps the text verbatim', () => {
    const parsed = parseDuration('⏱ 25-30 min   🎯 Objectif');

    expect(parsed.minutes).toBe(25);
    expect(parsed.verbatim).toBe('25-30 min');
  });

  /**
   * Pinned on a distinctive phrase, not on the word "duration".
   *
   * The first version of this assertion was `/duration/i`, and it passed
   * against a stub whose message was "parseDuration is not implemented yet" -
   * green while nothing was implemented, which is the colour-guard trap in
   * CLAUDE.md wearing different clothes.
   */
  it('refuses a marker it cannot read rather than guessing a duration', () => {
    expect(() => parseDuration('⏱ bientot   🎯 Objectif')).toThrow(
      /cannot read a duration marker/,
    );
  });
});

describe('KCA1 loader - course structure', () => {
  it('preserves parcours order', async () => {
    const course = parseCourseHtml(await fixtureHtml());

    expect(course.parcours.map((p) => p.code)).toEqual(['P0', 'P1']);
    expect(course.parcours.map((p) => p.order)).toEqual([1, 2]);
  });

  it('preserves lesson order inside a parcours', async () => {
    const course = parseCourseHtml(await fixtureHtml());
    const p0 = course.parcours[0];

    expect(p0.lessons.map((l) => l.moduleNumber)).toEqual([1, 2]);
    expect(p0.lessons.map((l) => l.order)).toEqual([1, 2]);
    expect(course.parcours[1].lessons.map((l) => l.moduleNumber)).toEqual([1]);
  });

  it('carries the parcours title, subtitle and objectives', async () => {
    const course = parseCourseHtml(await fixtureHtml());
    const p0 = course.parcours[0];

    expect(p0.title).toBe('ECOSYSTEME FIXTURE');
    expect(p0.subtitle).toContain('Comprendre avant de vendre');
    expect(p0.objectives).toEqual([
      'Premier objectif du parcours zero',
      'Deuxieme objectif du parcours zero',
    ]);
  });

  it('parses each lesson title, goal and duration from its own markers', async () => {
    const course = parseCourseHtml(await fixtureHtml());
    const [first, second] = course.parcours[0].lessons;

    expect(first.title).toBe('Premier module, Vision & Raison');
    expect(first.goal).toBe('Objectif du premier module');
    expect(first.durationMinutes).toBe(25);
    expect(first.durationText).toBe('25-30 min');
    expect(second.durationMinutes).toBe(15);
  });

  /**
   * Identity has to survive an edit. A sequential index re-points a candidate's
   * completion the moment a lesson is inserted above it, which is the defect
   * step 3 exists to prevent.
   */
  it('keys a lesson on its content position, not on a running index', async () => {
    const course = parseCourseHtml(await fixtureHtml());

    expect(course.parcours[0].lessons.map((l) => l.key)).toEqual(['P0/M1', 'P0/M2']);
    expect(course.parcours[1].lessons[0].key).toBe('P1/M1');
  });

  it('keeps the body as HTML, tables included', async () => {
    const course = parseCourseHtml(await fixtureHtml());
    const second = course.parcours[0].lessons[1];

    expect(LESSON_CONTENT_TYPE).toBe('HTML');
    expect(second.contentHtml).toContain('<table>');
    expect(second.contentHtml).toContain('Une valeur de tableau');
  });

  /**
   * The markers are slots Visquis will fill. Counting them per lesson is what
   * lets him be told which lesson a video belongs to without anybody re-reading
   * the document.
   */
  it('counts the marker families per lesson, including the accented one', async () => {
    const course = parseCourseHtml(await fixtureHtml());
    const [first, second] = course.parcours[0].lessons;

    expect(first.markers).toEqual({ VIDEO: 1, IMAGE: 1, DOCUMENT: 0 });
    expect(second.markers).toEqual({ VIDEO: 0, IMAGE: 0, DOCUMENT: 1 });
  });

  it('keeps the markers visible in the body rather than stripping them', async () => {
    const course = parseCourseHtml(await fixtureHtml());

    expect(course.parcours[0].lessons[0].contentHtml).toContain('[EMPLACEMENT VIDÉO]');
  });

  /** Brief rule 4: hyphen-minus only, including in seeded content. */
  it('emits no em dash or en dash in any generated body', async () => {
    const course = parseCourseHtml(await fixtureHtml());
    const bodies = course.parcours.flatMap((p) => p.lessons.map((l) => l.contentHtml));

    for (const body of bodies) {
      expect(body).not.toMatch(/[–—]/);
    }
  });

  /**
   * The assertion above cannot fail on this fixture, and neither can it on the
   * real document: both are already free of those characters, so it passes
   * while the normalisation it describes never runs. That is a test that proves
   * nothing about the rule it names.
   *
   * This one feeds the characters in and watches them come out converted, so
   * the rule is enforced rather than merely asserted. The dashes are built from
   * their code points so that banning them does not require writing more of
   * them into this file than the matcher above already needs.
   */
  it('converts an em dash and an en dash in the source into hyphen-minus', () => {
    const em = String.fromCharCode(0x2014);
    const en = String.fromCharCode(0x2013);
    const html =
      '<p><strong>PARCOURS 0 - Titre</strong></p>' +
      '<p><strong>MODULE 1 - Module</strong></p>' +
      '<p>⏱ 10 min   🎯 Objectif</p>' +
      `<p>un tiret ${em} cadratin et ${en} demi</p>`;

    const body = parseCourseHtml(html).parcours[0].lessons[0].contentHtml;

    expect(body).toContain('un tiret - cadratin et - demi');
    expect(body.includes(em)).toBe(false);
    expect(body.includes(en)).toBe(false);
  });
});

describe('KCA1 loader - media slots (A3)', () => {
  it('finds one slot per marker, in document order, numbered from one', async () => {
    const course = parseCourseHtml(await fixtureHtml());
    const slots = extractSlots(course.parcours[0].lessons[0].contentHtml);

    expect(slots.map((s) => s.kind)).toEqual(['VIDEO', 'IMAGE']);
    expect(slots.map((s) => s.position)).toEqual([1, 2]);
  });

  /**
   * The label is what tells Visquis which video he is producing. A slot that
   * says only "VIDEO" would send him back to the document, which is the thing
   * making slots addressable was meant to avoid.
   */
  it('carries what the marker said, without the bracketed prefix', async () => {
    const course = parseCourseHtml(await fixtureHtml());
    const [video] = extractSlots(course.parcours[0].lessons[0].contentHtml);

    expect(video.label).toContain('une video de demonstration');
    expect(video.label).not.toContain('[EMPLACEMENT');
  });

  it('recognises the DOCUMENT family the brief omitted', async () => {
    const course = parseCourseHtml(await fixtureHtml());
    const slots = extractSlots(course.parcours[0].lessons[1].contentHtml);

    expect(slots.map((s) => s.kind)).toEqual(['DOCUMENT']);
  });

  it('returns nothing for a lesson with no markers', async () => {
    const course = parseCourseHtml(await fixtureHtml());

    expect(extractSlots(course.parcours[1].lessons[0].contentHtml)).toEqual([]);
  });

  /** The slot count and the marker count are two readings of one fact. */
  it('agrees with the marker counts it sits beside', async () => {
    const course = parseCourseHtml(await fixtureHtml());

    for (const parcours of course.parcours) {
      for (const lesson of parcours.lessons) {
        const slots = extractSlots(lesson.contentHtml);
        const counted = lesson.markers.VIDEO + lesson.markers.IMAGE + lesson.markers.DOCUMENT;
        expect(slots).toHaveLength(counted);
      }
    }
  });
});

describe('KCA1 loader - quiz questions', () => {
  it('reads every row, and quoting survives a comma inside a field', () => {
    const questions = parseQuizCsv(readFixtureCsv('kca1-mini-p0.csv'), 'kca1-mini-p0.csv');

    expect(questions).toHaveLength(2);
    expect(questions[0].explanation).toContain('reponse est C, et cette explication');
  });

  /**
   * The acceptance the brief singles out. A question with no correct answer is
   * a question nobody can pass, and I21 showed where scoring defects end up.
   */
  it('turns bonne_reponse = C into exactly one correct answer, and it is option C', () => {
    const questions = parseQuizCsv(readFixtureCsv('kca1-mini-p0.csv'), 'kca1-mini-p0.csv');
    const [first] = questions;

    expect(first.answers).toHaveLength(4);
    expect(first.answers.filter((a) => a.isCorrect)).toHaveLength(1);
    expect(first.answers.find((a) => a.isCorrect)?.text).toBe('Option C du fixture');
    // And the option order is the file's order, so C is the third.
    expect(first.answers[2].isCorrect).toBe(true);
  });

  it('handles a correct answer at each end of the row', () => {
    const questions = parseQuizCsv(readFixtureCsv('kca1-mini-p1.csv'), 'kca1-mini-p1.csv');

    expect(questions[0].answers[0].isCorrect).toBe(true);
    expect(questions[1].answers[3].isCorrect).toBe(true);
  });

  it('carries the source id, parcours, tag and level through', () => {
    const questions = parseQuizCsv(readFixtureCsv('kca1-mini-p0.csv'), 'kca1-mini-p0.csv');

    expect(questions[0].sourceId).toBe('FX0-01');
    expect(questions[0].parcours).toBe('P0');
    expect(questions[0].tag).toBe('vision');
    expect(questions[0].level).toBe('1');
  });

  /**
   * The acceptance that matters most: a malformed row must fail loudly. Every
   * one of these produces a question nobody can pass, and all of them are
   * survivable by a parser that shrugs.
   */
  it('throws, naming the row, when bonne_reponse is not one of A-D', () => {
    const csv = [
      'id,parcours,question,option_A,option_B,option_C,option_D,bonne_reponse,explication,tag,niveau_kca',
      'FX0-99,P0,Une question cassee,A,B,C,D,E,Explication,tag,1',
    ].join('\n');

    expect(() => parseQuizCsv(csv, 'broken.csv')).toThrow(/FX0-99/);
    expect(() => parseQuizCsv(csv, 'broken.csv')).toThrow(/broken\.csv/);
  });

  it('throws when bonne_reponse is empty', () => {
    const csv = [
      'id,parcours,question,option_A,option_B,option_C,option_D,bonne_reponse,explication,tag,niveau_kca',
      'FX0-98,P0,Une question sans cle,A,B,C,D,,Explication,tag,1',
    ].join('\n');

    expect(() => parseQuizCsv(csv, 'broken.csv')).toThrow(/FX0-98/);
  });

  it('throws when the option the key points at is blank', () => {
    const csv = [
      'id,parcours,question,option_A,option_B,option_C,option_D,bonne_reponse,explication,tag,niveau_kca',
      'FX0-97,P0,Une question dont C est vide,A,B,,D,C,Explication,tag,1',
    ].join('\n');

    expect(() => parseQuizCsv(csv, 'broken.csv')).toThrow(/FX0-97/);
  });

  it('throws when a question has no text', () => {
    const csv = [
      'id,parcours,question,option_A,option_B,option_C,option_D,bonne_reponse,explication,tag,niveau_kca',
      'FX0-96,P0,,A,B,C,D,B,Explication,tag,1',
    ].join('\n');

    expect(() => parseQuizCsv(csv, 'broken.csv')).toThrow(/FX0-96/);
  });
});

describe('KCA1 loader - answer redistribution (A2)', () => {
  const questions = () => parseQuizCsv(readFixtureCsv('kca1-mini-p0.csv'), 'kca1-mini-p0.csv');

  it('keeps exactly one correct answer per question', () => {
    for (const question of withDistributedAnswers(questions())) {
      expect(question.answers.filter((a) => a.isCorrect)).toHaveLength(1);
    }
  });

  /** Only the order moves. A redistribution that edited text would be a rewrite. */
  it('keeps the same four answer texts, only reordered', () => {
    const before = questions();
    const after = withDistributedAnswers(before);

    for (const [i, question] of after.entries()) {
      expect(new Set(question.answers.map((a) => a.text))).toEqual(
        new Set(before[i].answers.map((a) => a.text)),
      );
    }
  });

  /** The same correct TEXT stays correct; the position is all that changes. */
  it('keeps the same answer correct', () => {
    const before = questions();
    const after = withDistributedAnswers(before);

    for (const [i, question] of after.entries()) {
      expect(question.answers.find((a) => a.isCorrect)?.text).toBe(
        before[i].answers.find((a) => a.isCorrect)?.text,
      );
    }
  });

  it('places the correct answer at the position the shared cycle dictates', () => {
    const placed = withDistributedAnswers(questions()).map((q) =>
      q.answers.findIndex((a) => a.isCorrect),
    );

    expect(placed).toEqual([targetPosition(0), targetPosition(1)]);
  });

  it('refuses a question with no correct answer rather than placing nothing', () => {
    const broken = [
      {
        ...questions()[0],
        answers: questions()[0].answers.map((a) => ({ ...a, isCorrect: false })),
      },
    ];

    expect(() => withDistributedAnswers(broken)).toThrow(/no correct answer/);
  });
});

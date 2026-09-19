/**
 * KCA1 loader - the script half: read the source, report, generate.
 *
 * Run it:
 *   pnpm tsx prisma/load-kca1.ts --out prisma/seed-data/kca1.ts
 *   pnpm tsx prisma/load-kca1.ts --out /tmp/preview.ts        (a dry look)
 *
 * The parsing lives in `seed-data/kca1-loader.ts`, which takes strings and has
 * no IO, so it is unit-tested without a Drive mount. This file is the IO: it
 * resolves the source, converts the docx through mammoth, reads the four quiz
 * files, and writes one generated TypeScript module.
 *
 * WHY THIS IS LOCAL AND NOT AN IMAGE STEP. The source of truth is a document on
 * Visquis's Drive, re-read at every load, and a container cannot reach it. So
 * the parse runs on his machine and its OUTPUT is committed; `prisma/seed.ts`
 * then applies that committed data wherever it runs. `mammoth` and `csv-parse`
 * are devDependencies for exactly that reason, and the generated module imports
 * neither - it declares its own types, so nothing dev-only is ever needed
 * inside the image.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LESSON_CONTENT_TYPE,
  MARKER_LITERALS,
  extractSlots,
  parseCourseHtml,
  parseQuizCsv,
  withDistributedAnswers,
  type Kca1Course,
  type Kca1Question,
} from './seed-data/kca1-loader';

/** The four parcours KCA1 is made of, in the order the document states them. */
const PARCOURS_ORDER = ['P0', 'P1', 'P2', 'P5'] as const;

const DRIVE = join(
  process.env['HOME'] ?? '',
  'Library/CloudStorage/GoogleDrive-visquis.miaffossa@kambriq.com/My Drive/KAMBRIQ-DGT/03_PRODUITS/KBS',
);

const DOCX =
  process.env['KCA1_DOCX'] ?? join(DRIVE, 'Certifications', 'kbs_kca1_cert_p0-p1-p2-p5_v01.docx');

const QUIZ_DIR = process.env['KCA1_QUIZ_DIR'] ?? join(DRIVE, 'Quiz');

const quizFile = (parcours: string) => join(QUIZ_DIR, `kbs_${parcours.toLowerCase()}_quiz_v01.csv`);

const arg = (name: string): string | undefined => {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
};

/**
 * What the load produced, printed so the consequences of an edit are readable.
 *
 * Step 3 turns this into a created/updated/left-alone/unmatched report against a
 * database. At this stage it reports what the SOURCE yielded, which is what
 * tells Visquis whether the document he edited parsed the way he meant.
 */
const report = (course: Kca1Course, questions: Kca1Question[]) => {
  console.log('\nKCA1 load report');
  console.log('================\n');

  let lessons = 0;
  const markerTotals: Record<string, number> = { VIDEO: 0, IMAGE: 0, DOCUMENT: 0 };

  for (const parcours of course.parcours) {
    const own = questions.filter((q) => q.parcours === parcours.code);
    console.log(
      `${parcours.code} - ${parcours.title}  (${parcours.lessons.length} lessons, ` +
        `${own.length} questions, ${parcours.objectives.length} objectives)`,
    );
    for (const lesson of parcours.lessons) {
      lessons += 1;
      for (const [kind] of MARKER_LITERALS) markerTotals[kind] += lesson.markers[kind];
      const slots = MARKER_LITERALS.filter(([kind]) => lesson.markers[kind] > 0)
        .map(([kind]) => `${kind} x${lesson.markers[kind]}`)
        .join(', ');
      console.log(
        `   ${lesson.key.padEnd(8)} ${String(lesson.durationMinutes).padStart(3)} min ` +
          `(${lesson.durationText.padEnd(9)}) ${String(lesson.contentHtml.length).padStart(6)} ` +
          `bytes  ${slots || '-'}  ${lesson.title.slice(0, 54)}`,
      );
    }
    console.log('');
  }

  const answers = questions.reduce((n, q) => n + q.answers.length, 0);
  console.log(
    `totals: ${course.parcours.length} parcours, ${lessons} lessons, ` +
      `${questions.length} questions, ${answers} answers`,
  );
  console.log(
    `slots : VIDEO ${markerTotals['VIDEO']}, IMAGE ${markerTotals['IMAGE']}, ` +
      `DOCUMENT ${markerTotals['DOCUMENT']}`,
  );

  // Anything that would seed a lesson nobody can read, or a duration nobody
  // stated, is named here rather than discovered on the screen.
  const noBody = course.parcours
    .flatMap((p) => p.lessons)
    .filter((l) => l.contentHtml.length === 0);
  const noDuration = course.parcours
    .flatMap((p) => p.lessons)
    .filter((l) => l.durationMinutes === 0);
  const noGoal = course.parcours.flatMap((p) => p.lessons).filter((l) => l.goal.length === 0);
  console.log(
    `checks: lessons with no body ${noBody.length}, no duration ${noDuration.length}, ` +
      `no goal ${noGoal.length}`,
  );

  // The video slots by name, because Visquis is producing these and a count
  // would send him back to the document to find out which ones.
  const all = course.parcours.flatMap((p) => p.lessons);
  const carrying = all.filter((l) => extractSlots(l.contentHtml).length > 0);
  console.log(`slots : ${carrying.length} of ${all.length} lessons carry at least one`);
  console.log('video slots, by lesson:');
  for (const lesson of all) {
    for (const slot of extractSlots(lesson.contentHtml)) {
      if (slot.kind !== 'VIDEO') continue;
      console.log(`        ${lesson.key.padEnd(7)} #${slot.position}  ${slot.label.slice(0, 78)}`);
    }
  }
  for (const lesson of [...noBody, ...noDuration, ...noGoal]) {
    console.log(`        ${lesson.key} ${lesson.title.slice(0, 60)}`);
  }
};

const generate = (course: Kca1Course, questions: Kca1Question[]): string => {
  const header = [
    '/**',
    ' * GENERATED by prisma/load-kca1.ts - do not edit by hand.',
    ' *',
    ' * The source of truth is the certification docx on the Drive plus the four',
    ' * quiz CSVs. Re-run the loader after editing either; editing this file',
    ' * instead puts the platform and the document out of step, which is the one',
    ' * thing choosing a single source was meant to prevent.',
    ' *',
    ' * Types are declared here rather than imported, so nothing in the deployed',
    ' * image depends on the dev-only parsing libraries.',
    ' */',
    '',
    `export const KCA1_CONTENT_TYPE = '${LESSON_CONTENT_TYPE}' as const;`,
    '',
    'export type Kca1SeedLesson = {',
    '  key: string;',
    '  parcours: string;',
    '  moduleNumber: number;',
    '  title: string;',
    '  goal: string;',
    '  durationMinutes: number;',
    '  durationText: string;',
    '  order: number;',
    '  contentHtml: string;',
    '  markers: { VIDEO: number; IMAGE: number; DOCUMENT: number };',
    '  slots: Kca1SeedSlot[];',
    '};',
    '',
    'export type Kca1SeedSlot = {',
    "  kind: 'VIDEO' | 'IMAGE' | 'DOCUMENT';",
    '  position: number;',
    '  label: string;',
    '  /** Null until the file exists. A3: the slot is the row, not the url. */',
    '  url: string | null;',
    '};',
    '',
    'export type Kca1SeedParcours = {',
    '  code: string;',
    '  title: string;',
    '  subtitle: string;',
    '  objectives: string[];',
    '  order: number;',
    '  lessons: Kca1SeedLesson[];',
    '};',
    '',
    'export type Kca1SeedQuestion = {',
    '  sourceId: string;',
    '  parcours: string;',
    '  text: string;',
    '  answers: { text: string; isCorrect: boolean }[];',
    '  explanation: string;',
    '  tag: string;',
    '  level: string;',
    '};',
    '',
  ].join('\n');

  const withSlots = course.parcours.map((parcours) => ({
    ...parcours,
    lessons: parcours.lessons.map((lesson) => ({
      ...lesson,
      slots: extractSlots(lesson.contentHtml).map((slot) => ({ ...slot, url: null })),
    })),
  }));

  const body = [
    `export const KCA1_PARCOURS: Kca1SeedParcours[] = ${JSON.stringify(withSlots, null, 2)};`,
    '',
    `export const KCA1_QUESTIONS: Kca1SeedQuestion[] = ${JSON.stringify(questions, null, 2)};`,
    '',
  ].join('\n');

  return `${header}\n${body}`;
};

const main = async () => {
  const mammoth = require('mammoth');
  console.log(`docx : ${DOCX}`);
  console.log(`quiz : ${QUIZ_DIR}`);

  const converted = await mammoth.convertToHtml({ path: DOCX });
  if (converted.messages.length > 0) {
    console.log(`mammoth messages: ${converted.messages.length}`);
    for (const message of converted.messages.slice(0, 10)) {
      console.log(`   ${message.type}: ${message.message}`);
    }
  }

  const course = parseCourseHtml(converted.value as string);

  const questions: Kca1Question[] = [];
  for (const parcours of PARCOURS_ORDER) {
    const path = quizFile(parcours);
    questions.push(
      ...parseQuizCsv(readFileSync(path, 'utf8'), `kbs_${parcours.toLowerCase()}_quiz_v01.csv`),
    );
  }

  // A2: the files stay as Visquis wrote them; the positions move here.
  const distributed = withDistributedAnswers(questions);

  report(course, distributed);

  // The structure the mapping in the brief fixes: one course, a module per
  // parcours, a lesson per docx module, twenty questions per parcours. Asserted
  // here rather than assumed, because a document edit that silently drops a
  // module would otherwise reach the database.
  const lessons = course.parcours.flatMap((p) => p.lessons);
  const problems: string[] = [];
  if (course.parcours.length !== PARCOURS_ORDER.length) {
    problems.push(`expected ${PARCOURS_ORDER.length} parcours, parsed ${course.parcours.length}`);
  }
  const codes = course.parcours.map((p) => p.code).join(',');
  if (codes !== PARCOURS_ORDER.join(',')) {
    problems.push(`expected parcours ${PARCOURS_ORDER.join(',')}, parsed ${codes}`);
  }
  if (lessons.length !== 33) problems.push(`expected 33 lessons, parsed ${lessons.length}`);
  if (distributed.length !== 80)
    problems.push(`expected 80 questions, parsed ${distributed.length}`);
  if (problems.length > 0) {
    console.error('\nREFUSED - the source does not match the fixed mapping:');
    for (const problem of problems) console.error(`   ${problem}`);
    process.exit(1);
  }

  const out = arg('--out');
  if (!out) {
    console.log('\nno --out given, nothing written');
    return;
  }
  writeFileSync(out, generate(course, distributed), 'utf8');

  // Formatted here rather than by whoever notices: this artifact is committed,
  // and `lint-staged` runs `prettier --write` on commit. A generator that emits
  // unformatted output makes every regeneration a diff nobody asked for.
  try {
    execFileSync('npx', ['prettier', '--write', out], { stdio: 'ignore' });
    console.log(`\nwritten and formatted: ${out}`);
  } catch {
    console.log(`\nwritten: ${out} (prettier unavailable, format it before committing)`);
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

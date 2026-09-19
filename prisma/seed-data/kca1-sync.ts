/**
 * KCA1 replay - deciding what a second load means, with no IO.
 *
 * Step 3, and the part that makes this a foundation rather than a script. The
 * content is injected repeatedly, whenever Visquis edits the source, so the
 * second run has to update a course that candidates are already working through
 * without destroying what they have done.
 *
 * ---------------------------------------------------------------------------
 * Why `upsert(..., update: {})` cannot be extended to this
 * ---------------------------------------------------------------------------
 * Every KBS row in `prisma/seed.ts` is written that way: course, modules,
 * lessons, questions, answers, candidates, certificates. It means a re-run over
 * edited content changes NOTHING - "idempotent is not restorative", already in
 * CLAUDE.md from the parcel seed. For a course that is loaded once that is
 * merely useless; for one that is loaded repeatedly it is the whole feature
 * missing.
 *
 * ---------------------------------------------------------------------------
 * Identity, and why the content key is not it
 * ---------------------------------------------------------------------------
 * Step 1 keyed a lesson `P0/M3`, from the `MODULE 3 -` heading, and claimed that
 * survived reordering. It does not. When a module is removed the document
 * RENUMBERS: P0's `MODULE 3` becomes `MODULE 2`, so the key names a different
 * lesson after the edit than before it. A matcher trusting that key would point a
 * candidate's completion at the wrong lesson - quietly, and only for the people
 * who had already done the work.
 *
 * So the stored identity is the database row's own id. It is written once and
 * never rewritten, which is what makes `KbsLessonCompletion.lessonId` keep
 * meaning the same thing across loads. The content key is only ever an input to
 * MATCHING, and matching uses two signals:
 *
 *   1. the normalised title within the parcours - survives renumbering;
 *   2. the module number - survives a retitle.
 *
 * Neither alone is enough, because the acceptance changes both: a title is
 * edited AND a lesson is removed in the same revision. Every match records
 * which signal carried it, so the report says what happened rather than only
 * what the totals were.
 */

/** A lesson as the source now describes it. */
export type SourceLesson = {
  key: string;
  moduleNumber: number;
  title: string;
  goal: string;
  durationMinutes: number;
  contentHtml: string;
};

/** A lesson as the database already holds it. */
export type ExistingLesson = {
  id: string;
  title: string;
  order: number;
  duration: number;
  content: string | null;
};

export type MatchOutcome =
  | 'created'
  | 'unchanged'
  | 'updated'
  | 'moved'
  | 'renamed'
  | 'absent-from-source';

export type LessonMatch = {
  outcome: MatchOutcome;
  /** The source lesson, absent when the row no longer appears in the source. */
  source: SourceLesson | null;
  /** The database row, absent when the source lesson is new. */
  existingId: string | null;
  /** Which signal carried the match, for the report. */
  matchedBy: 'title' | 'module-number' | null;
  /** What differs, named rather than counted. */
  changes: string[];
};

/**
 * Where a lesson the source no longer mentions is parked.
 *
 * It is NOT deleted. `KbsLessonCompletion.lesson` carries `onDelete: Cascade`,
 * so deleting a lesson destroys completions a candidate earned - work they did,
 * erased to tidy up a load. Decided with Visquis: keep the row, move it out of
 * the live ordering band, and report it.
 *
 * The renumbering is forced rather than cosmetic: `@@unique([moduleId, order])`
 * means an orphan still holding order 3 collides with whichever lesson
 * renumbers into 3, and the load would fail on a constraint instead of saying
 * what it found.
 */
export const ORPHAN_ORDER_BASE = 1000;

/** Titles differing only by case, accents or spacing are the same title. */
export const normaliseTitle = (title: string): string =>
  title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const differences = (source: SourceLesson, existing: ExistingLesson): string[] => {
  const changes: string[] = [];
  if (normaliseTitle(source.title) !== normaliseTitle(existing.title)) changes.push('title');
  if (source.durationMinutes !== existing.duration) changes.push('duration');
  if (source.contentHtml !== (existing.content ?? '')) changes.push('content');
  if (source.moduleNumber !== existing.order) changes.push('order');
  return changes;
};

/**
 * Pairs the source against the database, title first and number second.
 *
 * Title first because a removal renumbers the document, so the number is the
 * signal that moves; number second because a retitle leaves the number alone.
 * A row already claimed by one source lesson is never offered to another - two
 * lessons claiming one row is how a completion ends up on the wrong lesson.
 */
export const matchLessons = (source: SourceLesson[], existing: ExistingLesson[]): LessonMatch[] => {
  const claimed = new Set<string>();
  const byTitle = new Map<string, ExistingLesson>();
  for (const row of existing) {
    const key = normaliseTitle(row.title);
    if (!byTitle.has(key)) byTitle.set(key, row);
  }
  const byOrder = new Map<number, ExistingLesson>();
  for (const row of existing) {
    if (!byOrder.has(row.order)) byOrder.set(row.order, row);
  }

  const matches: LessonMatch[] = source.map((lesson) => {
    const titleHit = byTitle.get(normaliseTitle(lesson.title));
    if (titleHit && !claimed.has(titleHit.id)) {
      claimed.add(titleHit.id);
      const changes = differences(lesson, titleHit);
      const outcome: MatchOutcome = changes.includes('order')
        ? 'moved'
        : changes.length > 0
          ? 'updated'
          : 'unchanged';
      return { outcome, source: lesson, existingId: titleHit.id, matchedBy: 'title', changes };
    }

    const orderHit = byOrder.get(lesson.moduleNumber);
    if (orderHit && !claimed.has(orderHit.id)) {
      claimed.add(orderHit.id);
      const changes = differences(lesson, orderHit);
      const outcome: MatchOutcome = changes.includes('title') ? 'renamed' : 'updated';
      return {
        outcome,
        source: lesson,
        existingId: orderHit.id,
        matchedBy: 'module-number',
        changes,
      };
    }

    return { outcome: 'created', source: lesson, existingId: null, matchedBy: null, changes: [] };
  });

  for (const row of existing) {
    if (claimed.has(row.id)) continue;
    matches.push({
      outcome: 'absent-from-source',
      source: null,
      existingId: row.id,
      matchedBy: null,
      changes: [],
    });
  }

  return matches;
};

/** The order an orphan is parked at, given how many the parcours already has. */
export const orphanOrder = (index: number): number => ORPHAN_ORDER_BASE + index + 1;

/** A question as the source carries it, after the A2 redistribution. */
export type SourceQuestion = {
  text: string;
  answers: { text: string; isCorrect: boolean }[];
};

export type QuestionLoadOutcome = 'created' | 'left-untouched';

export type QuestionLoadDecision = {
  outcome: QuestionLoadOutcome;
  existingQuiz: number;
  existingExam: number;
  sourceQuestions: number;
};

/**
 * What a load does with a parcours' question pool - and what it deliberately
 * does NOT do.
 *
 * The lessons half of a replay is implemented: a lesson has two matching
 * signals that survive a real revision, its normalised title and its module
 * number. A QUESTION has neither. Its text is the only thing identifying it,
 * and editing a question is exactly the revision that would need matching, so
 * the signal and the change are the same string. Matching on it would move a
 * candidate's `KbsExamAnswer` onto a different question, quietly, for the
 * people who had already sat the exam.
 *
 * So the rule is narrow on purpose: a FIRST load writes the pool, and any load
 * over a pool that already holds rows writes NOTHING and reports what it found.
 * Not because the pool was checked and approved - nothing here checks it - but
 * because replaying questions is unimplemented work, and the report has to say
 * that rather than imply the opposite by staying quiet.
 */
export const decideQuestionLoad = (args: {
  existingQuiz: number;
  existingExam: number;
  sourceQuestions: number;
}): QuestionLoadDecision => {
  const { existingQuiz, existingExam, sourceQuestions } = args;

  return {
    outcome: existingQuiz === 0 && existingExam === 0 ? 'created' : 'left-untouched',
    existingQuiz,
    existingExam,
    sourceQuestions,
  };
};

/**
 * The decision as a sentence Visquis can act on.
 *
 * It never says the pool is correct, because nothing in this file reads a
 * single question. "Left untouched" and "verified" are different claims, and a
 * report that blurs them teaches somebody to trust a check that was never run.
 */
export const describeQuestionDecision = (decision: QuestionLoadDecision): string => {
  const { outcome, existingQuiz, existingExam, sourceQuestions } = decision;

  if (outcome === 'created') {
    return (
      `created ${sourceQuestions} quiz questions and ${sourceQuestions} exam questions ` +
      `(${sourceQuestions * 4} answers on each side) - the module held none`
    );
  }

  // A half-written pool is a real state: a first load interrupted between the
  // two copies. Topping it up silently is how a candidate ends up examined on
  // twenty questions and drilled on none, so the asymmetry is named and left
  // for a person to settle.
  const asymmetry =
    existingQuiz === existingExam
      ? ''
      : ` The two copies disagree - quiz ${existingQuiz}, exam ${existingExam} - so this pool is` +
        ` incomplete, and completing it is not a decision a load takes on its own.`;

  return (
    `left untouched: quiz ${existingQuiz}, exam ${existingExam} already in the database, ` +
    `replay not implemented.${asymmetry}`
  );
};

/** A count per outcome, so the report says what happened rather than how many rows. */
export const summarise = (matches: LessonMatch[]): Record<MatchOutcome, number> => {
  const counts: Record<MatchOutcome, number> = {
    created: 0,
    unchanged: 0,
    updated: 0,
    moved: 0,
    renamed: 0,
    'absent-from-source': 0,
  };
  for (const match of matches) counts[match.outcome] += 1;
  return counts;
};

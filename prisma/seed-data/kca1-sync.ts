/**
 * Resolves synchronization logic for a secondary KCA1 data load (no I/O side effects).
 *
 * A simple upsert-based script overwrites edits destructively. This sync
 * handles incremental updates to a course actively taken by candidates.
 *
 * Lesson identity mapping cannot rely on document order (e.g. `P0/M3`) because
 * adding or deleting a lesson shifts subsequent keys, silently breaking student progress.
 * Instead, matching relies on finding the database ID via:
 * 1. Normalized title (resilient to reordering).
 * 2. Module number (resilient to title changes).
 *
 * Outcomes are tracked explicitly to report changes such as renamed or moved lessons.
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
 * Defines the sorting order offset for parking lessons removed from the source.
 *
 * Removed lessons are never deleted to preserve existing `KbsLessonCompletion`
 * records for candidates who already completed them. They are moved to an
 * orphaned range to avoid unique constraint collisions (moduleId + order) with
 * reordered active lessons.
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

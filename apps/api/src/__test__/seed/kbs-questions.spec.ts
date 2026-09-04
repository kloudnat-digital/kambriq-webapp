/* eslint-disable @nx/enforce-module-boundaries -- the seed bank lives in prisma/seed-data, outside any nx project; these tests exist to pin it */
import {
  MODULE_1_QUIZ,
  MODULE_2_QUIZ,
  MODULE_1_EXAM,
  MODULE_2_EXAM,
  orderAnswers,
  POSITION_CYCLE,
  type SeedQuestion,
} from '../../../../../prisma/seed-data/kbs-questions';

/**
 * Seed-integrity assertions.
 *
 * 120 questions cannot be reviewed by eye before a deadline, so the properties
 * that make the bank usable are machine-checked instead. Each of these has a
 * failure it exists to catch:
 *
 *  - one correct answer per question: a question with none is ungradeable, a
 *    question with two makes exact-set grading unsatisfiable
 *  - per-bank position balance: the draws are scoped per bank (a quiz draws 10
 *    from ONE module's 30), so a global 30/30/30/30 can hide a bank at 9/8/8/5.
 *    A grader bug favouring the fourth option would then fail rarely, in the one
 *    bank that would have caught it, and read as flakiness
 *  - no duplicate text and no identical answer sets: otherwise 120 near-identical
 *    questions pass as content
 */

const BANKS: Array<[string, SeedQuestion[]]> = [
  ['quiz module 1', MODULE_1_QUIZ],
  ['quiz module 2', MODULE_2_QUIZ],
  ['exam module 1', MODULE_1_EXAM],
  ['exam module 2', MODULE_2_EXAM],
];

/** Mirrors the seed: a single running index across the banks, in seed order. */
const seededPositions = (): Map<string, number[]> => {
  const out = new Map<string, number[]>();
  let globalIndex = 0;
  for (const [name, bank] of BANKS) {
    const positions: number[] = [];
    for (const q of bank) {
      positions.push(orderAnswers(q, globalIndex).findIndex((a) => a.isCorrect));
      globalIndex++;
    }
    out.set(name, positions);
  }
  return out;
};

const allQuestions = BANKS.flatMap(([, b]) => b);

describe('seed bank: gradeability', () => {
  it('every question has exactly one correct answer', () => {
    let i = 0;
    const offenders: string[] = [];
    for (const [name, bank] of BANKS) {
      for (const q of bank) {
        const correct = orderAnswers(q, i).filter((a) => a.isCorrect).length;
        if (correct !== 1) offenders.push(`${name}: "${q.q}" has ${correct}`);
        i++;
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every question offers exactly four answers', () => {
    expect(allQuestions.filter((q) => q.a.length !== 4)).toEqual([]);
  });

  it('the correct answer text survives the rotation', () => {
    // A rotation that moved text rather than position would decouple every
    // question from its answer while leaving all counts looking perfect.
    let i = 0;
    for (const [, bank] of BANKS) {
      for (const q of bank) {
        const ordered = orderAnswers(q, i);
        expect(ordered.find((a) => a.isCorrect)?.text).toBe(q.a[q.correct]);
        expect(new Set(ordered.map((a) => a.text)).size).toBe(4);
        i++;
      }
    }
  });
});

describe('seed bank: correct-answer position, PER BANK', () => {
  const positions = seededPositions();

  it.each(BANKS.map(([name]) => name))(
    '%s spreads the correct answer within one of a quarter',
    (name) => {
      const p = positions.get(name) as number[];
      const counts = [0, 1, 2, 3].map((pos) => p.filter((x) => x === pos).length);
      const lo = Math.floor(p.length / 4);
      const hi = Math.ceil(p.length / 4);
      // 30 questions over 4 positions cannot be exact: 7 or 8 is the best
      // achievable. A bank at 9/8/8/5 fails here, which is the point.
      for (const c of counts) {
        expect(c).toBeGreaterThanOrEqual(lo);
        expect(c).toBeLessThanOrEqual(hi);
      }
    },
  );

  it.each(BANKS.map(([name]) => name))('%s has no run longer than three', (name) => {
    const p = positions.get(name) as number[];
    let run = 1;
    let longest = 1;
    for (let i = 1; i < p.length; i++) {
      run = p[i] === p[i - 1] ? run + 1 : 1;
      longest = Math.max(longest, run);
    }
    expect(longest).toBeLessThanOrEqual(3);
  });

  it('never places the correct answer at a fixed position', () => {
    for (const [, p] of seededPositions()) {
      expect(new Set(p).size).toBeGreaterThan(1);
    }
    expect(new Set(POSITION_CYCLE).size).toBe(4);
  });
});

describe('seed bank: distinctness', () => {
  it('no two questions share the same text', () => {
    const texts = allQuestions.map((q) => q.q.trim());
    const dupes = texts.filter((t, i) => texts.indexOf(t) !== i);
    expect([...new Set(dupes)]).toEqual([]);
  });

  it('no two questions share an identical answer set', () => {
    const sets = allQuestions.map((q) => [...q.a].sort().join('|'));
    const dupes = sets.filter((t, i) => sets.indexOf(t) !== i);
    expect([...new Set(dupes)]).toEqual([]);
  });

  it('every bank holds the size the seed claims', () => {
    for (const [, bank] of BANKS) expect(bank.length).toBe(30);
  });
});

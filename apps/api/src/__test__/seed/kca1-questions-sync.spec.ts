/* eslint-disable @nx/enforce-module-boundaries -- the sync rules live in prisma/seed-data, outside any nx project; these tests exist to pin them */
import {
  decideQuestionLoad,
  describeQuestionDecision,
} from '../../../../../prisma/seed-data/kca1-sync';

/**
 * Step 4 - what a load does with the question pool, decided here without a
 * database.
 *
 * The lessons half of a replay is implemented and proved in
 * `kca1-replay.dbspec.ts`. The QUESTIONS half is NOT: `KbsQuestion` has no
 * stable key, so matching an edited question against a stored one is the same
 * two-signal problem over question text, and doing half of it quietly would be
 * worse than not doing it at all.
 *
 * So the rule this file pins is deliberately narrow and deliberately loud: a
 * FIRST load creates the pool, and any later load over a pool that already has
 * rows changes NOTHING and says so, naming the counts it found. The failure
 * this forecloses is the silent one - a second load that half-writes a pool a
 * candidate is being examined from.
 */

const decide = (existingQuiz: number, existingExam: number, sourceQuestions = 20) =>
  decideQuestionLoad({ existingQuiz, existingExam, sourceQuestions });

describe('KCA1 question load - a first load creates the pool', () => {
  it('creates when the module carries no questions at all', () => {
    const decision = decide(0, 0);

    expect(decision.outcome).toBe('created');
    expect(decision.sourceQuestions).toBe(20);
  });

  it('reports what it is about to write rather than only that it will write', () => {
    const decision = decide(0, 0);

    expect(describeQuestionDecision(decision)).toContain('20');
  });
});

describe('KCA1 question load - a replay changes nothing and says so', () => {
  it('leaves a fully loaded pool untouched', () => {
    const decision = decide(20, 20);

    expect(decision.outcome).toBe('left-untouched');
  });

  it('counts what is already there instead of asserting it is correct', () => {
    const decision = decide(20, 20);

    expect(decision.existingQuiz).toBe(20);
    expect(decision.existingExam).toBe(20);
  });

  /**
   * The whole point of the outcome: the reason is readable by Visquis, and it
   * says replay is not implemented rather than implying the pool was checked
   * and found correct. A load that says "left untouched" without saying why
   * reads as "verified", which is a claim nothing here makes.
   */
  it('names replay as not implemented, not the pool as verified', () => {
    const rendered = describeQuestionDecision(decide(20, 20));

    expect(rendered).toContain('left untouched');
    expect(rendered).toContain('replay not implemented');
    expect(rendered).not.toMatch(/verified|correct|up to date/i);
  });

  /**
   * A half-written pool is a real state - a first load interrupted between the
   * quiz copy and the exam copy - and it is the one a silent "top it up" would
   * corrupt. It changes nothing either, and the asymmetry is named so a person
   * decides rather than a default.
   */
  it('refuses to top up a half-written pool, and names the asymmetry', () => {
    const decision = decide(20, 0);

    expect(decision.outcome).toBe('left-untouched');
    expect(describeQuestionDecision(decision)).toMatch(/quiz 20.*exam 0|asymmetr|incomplet/i);
  });

  it('treats an exam-only pool the same way', () => {
    expect(decide(0, 20).outcome).toBe('left-untouched');
  });
});

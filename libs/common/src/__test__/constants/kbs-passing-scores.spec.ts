import { EXAM_PASSING_SCORE, MODULE_PASSING_SCORE } from '../../constants/kbs';

/**
 * The two KBS thresholds, and the decision behind each.
 *
 * Decided by Visquis on 18 September 2026: 80 at the exam, 70 at the module
 * quizzes. The reasoning is what makes them two numbers rather than one - the
 * certification document governs what is promised to the candidate, so the exam
 * threshold is the promise; the module quizzes are drilling, and drilling is
 * allowed to be easier than the examination it prepares for.
 *
 * Neither constant had a single test before this file. The exam threshold was
 * changed from 75 to 80 with nothing in the suite noticing, which is the whole
 * reason these assertions exist: a number that governs whether somebody becomes
 * a certified agent should not be editable in silence.
 *
 * Two fields, two meanings, and they must not be allowed to merge. The day
 * somebody decides the quizzes should also be 80, that is a decision to record
 * here - not a tidy-up that collapses them into one constant.
 */
describe('KBS passing scores', () => {
  it('requires 80 at the certification exam', () => {
    expect(EXAM_PASSING_SCORE).toBe(80);
  });

  it('requires 70 at the module quizzes', () => {
    expect(MODULE_PASSING_SCORE).toBe(70);
  });

  it('keeps the two thresholds distinct', () => {
    expect(EXAM_PASSING_SCORE).not.toBe(MODULE_PASSING_SCORE);
  });

  it('holds the exam to the stricter of the two', () => {
    expect(EXAM_PASSING_SCORE).toBeGreaterThan(MODULE_PASSING_SCORE);
  });
});

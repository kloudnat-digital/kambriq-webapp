/**
 * THROWAWAY - proves branch protection refuses a merge when a check fails.
 *
 * Deliberately failing. The pre-commit hooks run eslint and prettier, not the
 * suite, so this commits honestly and fails in CI where it is meant to.
 * Deleted as soon as the refusal is recorded.
 */
describe('throwaway', () => {
  it('fails on purpose so the gate can refuse', () => {
    expect(1 + 1).toBe(3);
  });
});

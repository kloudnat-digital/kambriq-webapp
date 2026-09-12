/** THROWAWAY - a genuinely failing test, so the gate refuses on a real red. */
describe('throwaway', () => {
  it('fails on purpose', () => {
    expect(1 + 1).toBe(3);
  });
});

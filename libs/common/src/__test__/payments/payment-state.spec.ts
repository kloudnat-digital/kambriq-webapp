import {
  assertTransitionAllowed,
  assertTransitionIsDeliberate,
  assertTransitionIsEvidenced,
  AutomaticTransitionForbiddenError,
  COMMITTING_STATES,
  EVIDENCED_STATES,
  EvidenceRequiredError,
  IllegalPaymentTransitionError,
  PAYMENT_TRANSITIONS,
  PaymentState,
  sumReceipts,
  TERMINAL_STATES,
} from '../../index';

/**
 * The transition table, covered edge by edge rather than by sampling.
 *
 * Every ordered pair of states is exercised: 9 x 9 = 81 cases, each asserted to
 * succeed or to throw according to `PAYMENT_TRANSITIONS`. A table-driven test
 * that only walks the happy path proves the path, not the table - and the edges
 * that matter here are the ones nobody thinks to write down, like
 * `VALIDE -> PARTIELLEMENT_RECU`.
 */
const ALL = Object.values(PaymentState);

const pairs = ALL.flatMap((from) => ALL.map((to) => [from, to] as const));
const legal = pairs.filter(([f, t]) => PAYMENT_TRANSITIONS[f].includes(t));
const illegal = pairs.filter(([f, t]) => !PAYMENT_TRANSITIONS[f].includes(t));

describe('the payment transition table', () => {
  it('covers every state, and the arithmetic of the sweep closes', () => {
    // A sweep whose totals do not add up is not evidence about the table.
    expect(ALL).toHaveLength(9);
    expect(pairs).toHaveLength(81);
    expect(legal.length + illegal.length).toBe(81);
    expect(legal.length).toBeGreaterThan(0);
    expect(illegal.length).toBeGreaterThan(0);
  });

  it.each(legal)('%s -> %s is allowed', (from, to) => {
    expect(() => assertTransitionAllowed(from, to)).not.toThrow();
  });

  it.each(illegal)('%s -> %s throws', (from, to) => {
    expect(() => assertTransitionAllowed(from, to)).toThrow(IllegalPaymentTransitionError);
  });

  it('PARTIELLEMENT_RECU loops on itself', () => {
    // Land is paid in instalments. A model that knows only paid-or-unpaid is
    // worked around from the first sale.
    expect(() =>
      assertTransitionAllowed(PaymentState.PARTIELLEMENT_RECU, PaymentState.PARTIELLEMENT_RECU),
    ).not.toThrow();
  });

  it.each([PaymentState.REJETE, PaymentState.EXPIRE, PaymentState.ANNULE])(
    '%s is reachable from every non-terminal state',
    (exit) => {
      const nonTerminal = ALL.filter((s) => !TERMINAL_STATES.has(s));
      expect(nonTerminal.length).toBe(5);
      for (const from of nonTerminal) {
        expect(() => assertTransitionAllowed(from, exit)).not.toThrow();
      }
    },
  );

  it.each([...TERMINAL_STATES])('%s is terminal: nothing is legal from it', (state) => {
    expect(PAYMENT_TRANSITIONS[state]).toEqual([]);
    for (const to of ALL) {
      expect(() => assertTransitionAllowed(state, to)).toThrow(IllegalPaymentTransitionError);
    }
  });

  it('does not allow the happy path to be skipped', () => {
    // The states exist so that verification happens between the client saying
    // they paid and the platform agreeing. Jumping the queue must be refused.
    expect(() => assertTransitionAllowed(PaymentState.INITIE, PaymentState.VALIDE)).toThrow(
      IllegalPaymentTransitionError,
    );
    expect(() => assertTransitionAllowed(PaymentState.ANNONCE_CLIENT, PaymentState.VALIDE)).toThrow(
      IllegalPaymentTransitionError,
    );
    expect(() =>
      assertTransitionAllowed(PaymentState.EN_VERIFICATION, PaymentState.VALIDE),
    ).toThrow(IllegalPaymentTransitionError);
  });
});

describe('no transition that commits money is automatic', () => {
  const ACTOR = '00000000-0000-4000-8000-b00000000001';

  it.each([...COMMITTING_STATES])('%s requires a named actor', (to) => {
    expect(() => assertTransitionIsDeliberate(to, ACTOR, 'receipt checked')).not.toThrow();
  });

  it.each([...COMMITTING_STATES])('%s refuses an empty actor', (to) => {
    expect(() => assertTransitionIsDeliberate(to, '', 'receipt checked')).toThrow(
      AutomaticTransitionForbiddenError,
    );
    expect(() => assertTransitionIsDeliberate(to, null, 'receipt checked')).toThrow(
      AutomaticTransitionForbiddenError,
    );
  });

  it.each(['system', 'JOB', ' worker ', 'cron', 'automatic', 'auto', 'scheduler', 'processor'])(
    'refuses "%s" as the actor on a committing transition',
    (actor) => {
      expect(() => assertTransitionIsDeliberate(PaymentState.VALIDE, actor, 'because')).toThrow(
        AutomaticTransitionForbiddenError,
      );
    },
  );

  it.each([...COMMITTING_STATES])('%s refuses a blank reason', (to) => {
    expect(() => assertTransitionIsDeliberate(to, ACTOR, '   ')).toThrow(
      AutomaticTransitionForbiddenError,
    );
  });

  it('allows EXPIRE without a person, and that is deliberate', () => {
    // The design asks for exactly one automatic transition: "passe en EXPIRE au
    // terme, avec sa raison". The dunning job may make it and nothing else.
    // Recorded here so a later tightening is a decision, not a tidy-up.
    expect(() =>
      assertTransitionIsDeliberate(PaymentState.EXPIRE, 'system', 'validity elapsed'),
    ).not.toThrow();
    expect(COMMITTING_STATES.has(PaymentState.EXPIRE)).toBe(false);
  });

  it('leaves non-committing transitions alone', () => {
    expect(() =>
      assertTransitionIsDeliberate(PaymentState.INSTRUCTIONS_ENVOYEES, 'system', ''),
    ).not.toThrow();
  });
});

describe('the total received is a sum, and only a sum', () => {
  it('sums an empty ledger to zero rather than to null', () => {
    expect(sumReceipts([])).toBe(0n);
  });

  it('sums signed lines, so a correction subtracts without editing anything', () => {
    expect(sumReceipts([{ amount: 500_000n }, { amount: 250_000n }, { amount: -50_000n }])).toBe(
      700_000n,
    );
  });

  it('is exact at magnitudes where a float would not be', () => {
    // 9 007 199 254 740 993 is the first integer a float64 cannot represent.
    // XAF has no minor unit, so land prices reach large integers directly.
    const big = 9_007_199_254_740_993n;
    expect(sumReceipts([{ amount: big }, { amount: 1n }])).toBe(9_007_199_254_740_994n);
    expect(Number(big) + 1).not.toBe(9_007_199_254_740_994);
  });
});

describe('G7 - the states that rest on a receipt', () => {
  it('are the two that say money was seen and proved, and no other', () => {
    // v03 §4: PARTIELLEMENT_RECU "constatee et prouvee", VALIDE "la totalite
    // est constatee et prouvee". Pinned in both directions: a state added here
    // fails, and a state removed fails.
    expect([...EVIDENCED_STATES].sort()).toEqual(
      [PaymentState.PARTIELLEMENT_RECU, PaymentState.VALIDE].sort(),
    );
  });

  it('every evidenced state commits money - the reverse is not true', () => {
    // A state cannot say "proved" without also being one a named person
    // commits. REJETE and ANNULE commit by decision and rest on a reason, not
    // on a receipt, which is why the two sets differ.
    for (const state of EVIDENCED_STATES) expect(COMMITTING_STATES.has(state)).toBe(true);
    expect(COMMITTING_STATES.size).toBeGreaterThan(EVIDENCED_STATES.size);
  });

  it.each([...EVIDENCED_STATES])('refuses %s with no receipt', (to) => {
    expect(() => assertTransitionIsEvidenced(to, undefined)).toThrow(EvidenceRequiredError);
    expect(() => assertTransitionIsEvidenced(to, null)).toThrow(EvidenceRequiredError);
    expect(() => assertTransitionIsEvidenced(to, '   ')).toThrow(EvidenceRequiredError);
  });

  it.each([...EVIDENCED_STATES])('accepts %s with one', (to) => {
    expect(() => assertTransitionIsEvidenced(to, 'r1')).not.toThrow();
  });

  it.each(ALL.filter((s) => !EVIDENCED_STATES.has(s)))(
    '%s carries NULL deliberately and demands nothing',
    (to) => {
      expect(() => assertTransitionIsEvidenced(to, undefined)).not.toThrow();
      // And may still be offered one.
      expect(() => assertTransitionIsEvidenced(to, 'r1')).not.toThrow();
    },
  );
});

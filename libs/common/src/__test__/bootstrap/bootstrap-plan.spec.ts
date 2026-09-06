import { planBootstrap, SUPER_ADMIN_ROLE } from '../../index';
import type { BootstrapIdentity, ExistingAccount } from '../../index';

/**
 * The branch that assigns the super-admin role, which nothing covered.
 *
 * Journey 5 grants `ADMIN_GLOBAL` to its own account before activating it, so it
 * proves that a passwordless account can be activated and **never that the
 * bootstrap assigns the role**. A test that grants the thing it means to verify
 * verifies nothing, and the whole suite was green while that hole was open.
 *
 * The hypothesis that had to be answered when a real administrator turned up
 * with no roles was: _the row already existed, so the update branch ran, and the
 * update branch refreshes the name and never touches the roles - the seed's
 * `update: {}` all over again._ It was not what happened that day. It is,
 * however, exactly the defect this file exists to make impossible, and the
 * second test below is that hypothesis written as an assertion.
 */
const IDENTITY: BootstrapIdentity = {
  firstName: 'Given',
  lastName: 'Family',
  phone: '+237600000000',
  city: 'Paris',
  country: 'France',
};

const existing = (over: Partial<ExistingAccount> = {}): ExistingAccount => ({
  firstName: IDENTITY.firstName,
  lastName: IDENTITY.lastName,
  phone: IDENTITY.phone,
  profile: { city: IDENTITY.city, country: IDENTITY.country },
  roleCodes: [SUPER_ADMIN_ROLE],
  ...over,
});

describe('the bootstrap always assigns the super-admin role', () => {
  it('grants it on the create branch', () => {
    const plan = planBootstrap(null, IDENTITY);

    expect(plan.action).toBe('create');
    expect(plan.grantRole).toBe(true);
  });

  it('grants it on the UPDATE branch when the existing row does not hold it', () => {
    // The hypothesis, as an assertion. An account that already existed on the
    // environment - a prior signup, a reservation-created client - must come out
    // of a bootstrap run holding the role, not merely with a refreshed name.
    const plan = planBootstrap(existing({ roleCodes: [] }), IDENTITY);

    expect(plan.grantRole).toBe(true);
    expect(plan.action).toBe('update');
    expect(plan.changedFields).toContain(`role:${SUPER_ADMIN_ROLE}`);
  });

  it('grants it even when every other field already matches', () => {
    // The dangerous shape: nothing else differs, so a plan that decided
    // "unchanged" from the identity fields alone would skip the grant and report
    // success. `unchanged` must mean the role is there too.
    const plan = planBootstrap(existing({ roleCodes: ['CLIENT'] }), IDENTITY);

    expect(plan.action).not.toBe('unchanged');
    expect(plan.grantRole).toBe(true);
  });

  it('does not re-grant it when the row already holds it', () => {
    const plan = planBootstrap(existing(), IDENTITY);

    expect(plan.grantRole).toBe(false);
    expect(plan.action).toBe('unchanged');
    expect(plan.changedFields).toEqual([]);
  });
});

describe('the bootstrap reconciles identity fields and nothing else', () => {
  it.each([
    ['firstName', { firstName: 'Other' }],
    ['lastName', { lastName: 'Other' }],
    ['phone', { phone: '+237699999999' }],
  ])('reports %s when it differs', (field, over) => {
    const plan = planBootstrap(existing(over as Partial<ExistingAccount>), IDENTITY);

    expect(plan.action).toBe('update');
    expect(plan.changedFields).toContain(field);
  });

  it.each([
    ['city', { city: 'Douala', country: IDENTITY.country }],
    ['country', { city: IDENTITY.city, country: 'Cameroun' }],
  ])('reports %s when the profile differs', (field, profile) => {
    const plan = planBootstrap(existing({ profile } as Partial<ExistingAccount>), IDENTITY);

    expect(plan.action).toBe('update');
    expect(plan.changedFields).toContain(field);
  });

  it('treats a missing profile row as every profile field differing', () => {
    const plan = planBootstrap(existing({ profile: null }), IDENTITY);

    expect(plan.changedFields).toEqual(expect.arrayContaining(['city', 'country']));
  });

  it('never plans to touch the credentials', () => {
    // Structural: the plan has no field that could carry them. By the second run
    // the holder may have set a password, and reconciling it back to the
    // parameter store would lock them out of their own account.
    const plan = planBootstrap(existing({ roleCodes: [] }), IDENTITY);

    expect(Object.keys(plan)).toEqual(['action', 'grantRole', 'changedFields']);
    expect(plan.changedFields).not.toContain('passwordHash');
    expect(plan.changedFields).not.toContain('emailVerified');
    expect(plan.changedFields).not.toContain('isActive');
  });
});

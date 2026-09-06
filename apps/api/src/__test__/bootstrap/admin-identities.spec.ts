/**
 * `prisma/` is not an Nx project, so it has no scope to import by name -
 * `prisma/seed.ts` disables the same rule for the same reason. The
 * alternative is to leave the bootstrap's refusal logic untested, and that
 * logic is the part that decides whether an administrator account is
 * created at all.
 */
/* eslint-disable @nx/enforce-module-boundaries */
import { compare } from 'bcryptjs';
import {
  BootstrapError,
  IDENTITY_FIELDS,
  NO_PASSWORD,
  collectAdmins,
} from '../../../../../prisma/bootstrap-admins.identities';

/**
 * The bootstrap of the permanent administrator accounts reads every identity
 * field from its own SSM parameter. What is tested here is the refusal: a run
 * that cannot see a complete set of identities must stop and say so, because an
 * administrator who was silently not created is indistinguishable from one who
 * was never asked for, and the discovery is somebody unable to log in.
 */
describe('bootstrap admin identities', () => {
  const complete = (slots: number): Map<string, string> => {
    const values = new Map<string, string>([['BOOTSTRAP_ADMIN_COUNT', String(slots)]]);
    for (let slot = 1; slot <= slots; slot++) {
      for (const field of IDENTITY_FIELDS) {
        values.set(`BOOTSTRAP_ADMIN_${slot}_${field}`, `${field.toLowerCase()}-${slot}`);
      }
      values.set(`BOOTSTRAP_ADMIN_${slot}_EMAIL`, `admin${slot}@example.test`);
    }
    return values;
  };

  it('reads a complete set', () => {
    const admins = collectAdmins(complete(2));

    expect(admins).toHaveLength(2);
    expect(admins[0].EMAIL).toBe('admin1@example.test');
    expect(admins[1].CITY).toBe('city-2');
    // Not a default anywhere: every field came from a parameter.
    for (const admin of admins) {
      for (const field of IDENTITY_FIELDS) expect(admin[field]).toBeTruthy();
    }
  });

  it('refuses when the count is absent', () => {
    const values = complete(1);
    values.delete('BOOTSTRAP_ADMIN_COUNT');

    expect(() => collectAdmins(values)).toThrow(BootstrapError);
    expect(() => collectAdmins(values)).toThrow(/BOOTSTRAP_ADMIN_COUNT is not set/);
  });

  it('refuses an empty prefix rather than reporting a successful run of nothing', () => {
    // The failure this guards: SSM returns zero parameters - wrong region,
    // wrong environment, policy denies the read - and a bootstrap with no
    // accounts to create finishes without error and reports success.
    expect(() => collectAdmins(new Map())).toThrow(BootstrapError);
  });

  it.each(IDENTITY_FIELDS)('refuses when %s is missing', (field) => {
    const values = complete(1);
    values.delete(`BOOTSTRAP_ADMIN_1_${field}`);

    expect(() => collectAdmins(values)).toThrow(new RegExp(`BOOTSTRAP_ADMIN_1_${field}\\b`));
  });

  it.each(IDENTITY_FIELDS)('refuses when %s is present but blank', (field) => {
    // A parameter created as an empty string is present as far as SSM is
    // concerned. It is still not an identity.
    const values = complete(1);
    values.set(`BOOTSTRAP_ADMIN_1_${field}`, '   ');

    expect(() => collectAdmins(values)).toThrow(new RegExp(`BOOTSTRAP_ADMIN_1_${field}\\b`));
  });

  it('names every missing parameter at once, not the first', () => {
    const values = complete(2);
    values.delete('BOOTSTRAP_ADMIN_1_PHONE');
    values.delete('BOOTSTRAP_ADMIN_2_ADDRESS');
    values.delete('BOOTSTRAP_ADMIN_2_COUNTRY');

    try {
      collectAdmins(values);
      throw new Error('expected collectAdmins to throw');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('3 required parameter(s)');
      expect(message).toContain('BOOTSTRAP_ADMIN_1_PHONE');
      expect(message).toContain('BOOTSTRAP_ADMIN_2_ADDRESS');
      expect(message).toContain('BOOTSTRAP_ADMIN_2_COUNTRY');
    }
  });

  it.each(['0', '-1', 'two', '1.5', ''])('refuses a count of %p', (count) => {
    const values = complete(1);
    values.set('BOOTSTRAP_ADMIN_COUNT', count);

    expect(() => collectAdmins(values)).toThrow(BootstrapError);
  });

  it('refuses two slots sharing one address', () => {
    // Idempotency is keyed on email. Two slots with one address means the second
    // finds the first already present and does nothing - one account short, and
    // the run reports success.
    const values = complete(2);
    values.set('BOOTSTRAP_ADMIN_2_EMAIL', 'ADMIN1@example.test');

    expect(() => collectAdmins(values)).toThrow(/same email/);
  });

  describe('the placeholder password hash', () => {
    it('cannot be satisfied by any password, including itself', async () => {
      for (const candidate of [NO_PASSWORD, '', '!', 'Test1234!', 'password']) {
        await expect(compare(candidate, NO_PASSWORD)).resolves.toBe(false);
      }
    });

    it('is rejected rather than throwing, so login answers 401 and not 500', async () => {
      // bcrypt compare on an unparseable hash resolves false. If it threw, the
      // login handler would surface a server error for an account that simply
      // has no password yet.
      await expect(compare('anything', NO_PASSWORD)).resolves.toBe(false);
    });
  });
});

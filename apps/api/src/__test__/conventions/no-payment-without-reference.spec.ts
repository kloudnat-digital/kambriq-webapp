import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * G2 - a payment cannot come into existence without its reference.
 *
 * The reference is the only thing tying money that moved outside the platform -
 * a bank transfer, mobile money, cash at a notary - to a payment inside it. A
 * payment that exists for even a moment without one is a payment somebody could
 * be asked to pay against nothing.
 *
 * The column is nullable at the database level and stays that way on purpose:
 * G1 backfilled rows that predate the generator, and inventing references for
 * payments that never had one would be worse than leaving them NULL. So the
 * guarantee cannot be a `NOT NULL`. It is this: **`payment.create` is called in
 * exactly one place, and that place sets `reference`.**
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SERVICE = join(ROOT, 'apps', 'api', 'src', 'lands', 'payments', 'payments.service.ts');

const walk = (dir: string): string[] => {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  return readdirSync(dir).flatMap((e: string) => {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) return walk(f);
    return f.endsWith('.ts') ? [f] : [];
  });
};

describe('no payment is created without a reference', () => {
  const service = readFileSync(SERVICE, 'utf8');

  it('is reading the service it thinks it is', () => {
    expect(service).toContain('class PaymentsService');
    expect(service.length).toBeGreaterThan(2_000);
  });

  it('payment.create appears in exactly one place in the API', () => {
    const callers = walk(join(ROOT, 'apps', 'api', 'src'))
      .filter((f) => !f.includes('__test__'))
      .filter((f) => /\bpayment\.create\(/.test(readFileSync(f, 'utf8')));

    expect(callers).toEqual([SERVICE]);
  });

  it('and that call sets the reference', () => {
    const call = /payment\.create\(\{[\s\S]{0,400}?\}\)/.exec(service)?.[0] ?? '';
    expect(call).toContain('reference');
  });

  it('the reference comes from the generator, not from a caller', () => {
    // `createPayment` takes no `reference` in its input: a caller cannot supply
    // one, so it cannot supply a malformed one either.
    const signature = /async createPayment\(input: \{[\s\S]*?\}\)/.exec(service)?.[0] ?? '';
    expect(signature).toBeTruthy();
    expect(signature).not.toContain('reference');
    expect(service).toContain('buildReference(');
  });

  it('the counter comes from the sequence, not from Math.random', () => {
    // Collision-free by construction. Randomness would be *unlikely* to
    // collide, which is a different property and not the one required.
    expect(service).toContain("nextval('payment_reference_seq')");
    expect(service).not.toContain('Math.random');
  });

  it('the sequence exists in a migration', () => {
    const migration = readFileSync(
      join(
        ROOT,
        'prisma',
        'lands',
        'migrations',
        '20260906230000_g2_payment_reference_sequence',
        'migration.sql',
      ),
      'utf8',
    );
    expect(migration).toContain('CREATE SEQUENCE');
    expect(migration).toContain('payment_reference_seq');
  });
});

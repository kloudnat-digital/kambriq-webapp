import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

/**
 * A12 - a preference that promised a capability that does not exist.
 *
 * `whatsappNotifications` was accepted by `PATCH /users/me`, persisted, and
 * returned by `GET /users/me`. **There is no WhatsApp sender in the API** - not
 * a disabled one, none at all. Every statement the API made about it was true,
 * and the exchange was false, because offering a preference implies the
 * capability behind it.
 *
 * Removed from the API surface and from the web. The column is kept so no
 * stored value is lost, and is marked deprecated in the schema.
 *
 * **Why removal rather than a "not yet available" label.** A disabled control
 * still asks a person to form an intention the system cannot honour, and stores
 * it - so the day a sender exists, the stored values are months-old intentions
 * expressed against a dead control. And a label is honest only if it is read,
 * where an absent control needs nobody to read anything. The same reason a
 * guard belongs in a hook rather than in a test.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue;
    const f = join(dir, e);
    if (statSync(f).isDirectory()) out.push(...walk(f));
    else if (['.ts', '.tsx', '.json'].includes(extname(e))) out.push(f);
  }
  return out;
};

/** The schema keeps the column, and its comment explains why. */
const SCHEMA = join(ROOT, 'prisma', 'core', 'schema.prisma');

describe('no preference is offered without the capability behind it', () => {
  it('is reading the trees it thinks it is', () => {
    expect(walk(join(ROOT, 'apps', 'api', 'src')).length).toBeGreaterThan(50);
    expect(walk(join(ROOT, 'apps', 'web', 'src')).length).toBeGreaterThan(50);
  });

  it('the API neither accepts nor returns the WhatsApp preference', () => {
    const offenders = walk(join(ROOT, 'apps', 'api', 'src'))
      .filter((f) => !f.includes('__test__'))
      .filter((f) => readFileSync(f, 'utf8').includes('whatsappNotifications'));

    expect(offenders).toEqual([]);
  });

  it('the web neither offers nor sends it', () => {
    const offenders = walk(join(ROOT, 'apps', 'web', 'src')).filter((f) =>
      readFileSync(f, 'utf8').includes('whatsappNotifications'),
    );

    expect(offenders).toEqual([]);
  });

  it('and there is still no WhatsApp sender, which is why it went', () => {
    // If somebody builds one, this fails - and that is the moment to bring the
    // preference back with a capability behind it.
    const senders = [...walk(join(ROOT, 'apps', 'api', 'src')), ...walk(join(ROOT, 'libs'))]
      .filter((f) => !f.includes('__test__') && !f.includes('prisma/'))
      .filter((f) => /whatsapp/i.test(readFileSync(f, 'utf8')));

    expect(senders).toEqual([]);
  });

  it('the column is kept, so no stored value is lost', () => {
    const schema = readFileSync(SCHEMA, 'utf8');
    expect(schema).toContain('whatsappNotifications');
    // And it says why it is still there.
    expect(schema).toContain('DEPRECATED by A12');
  });
});

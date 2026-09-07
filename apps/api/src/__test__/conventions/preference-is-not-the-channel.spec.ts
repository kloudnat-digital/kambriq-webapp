import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

/**
 * **Two fields, never one.**
 *
 * v03 section 4c: `preferredChannel` is what the client said would suit them -
 * declared at request time, may be null, binds nothing. `channel` is what the
 * back office chose at send time and is the record.
 *
 * *"Les fusionner ferait qu'un souhait devient silencieusement l'enregistrement
 * de ce qui a servi - et le jour d'un ecart, plus rien ne dirait lequel des deux
 * on lit."*
 *
 * This is the item the brief said was most likely to be got wrong, so it is
 * checked from three directions rather than one:
 *
 *  1. **Sending must not write the preference.** A send that assigned
 *     `preferredChannel` would turn the wish into the record on the way past.
 *  2. **The preference must not be read where the channel is required.** A
 *     `?? preferredChannel` fallback is the same merge, spelled defensively.
 *  3. **Both columns must exist and be distinct** in the schema, so the pair
 *     cannot be quietly collapsed into one.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((e) => {
    if (['node_modules', '.next', 'prisma', '__test__'].includes(e)) return [];
    const f = join(dir, e);
    return statSync(f).isDirectory() ? walk(f) : ['.ts', '.tsx'].includes(extname(e)) ? [f] : [];
  });

const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const FILES = [
  join(ROOT, 'apps', 'api', 'src'),
  join(ROOT, 'apps', 'web', 'src'),
  join(ROOT, 'libs', 'common', 'src'),
]
  .flatMap(walk)
  .map((f) => ({ path: relative(ROOT, f), src: stripComments(readFileSync(f, 'utf8')) }));

const SERVICE = readFileSync(
  join(ROOT, 'apps', 'api', 'src', 'lands', 'payments', 'payments.service.ts'),
  'utf8',
);
const SCHEMA = readFileSync(join(ROOT, 'prisma', 'lands', 'schema.prisma'), 'utf8');

/**
 * The body of one method, from its signature to the `\n  }` that closes it.
 *
 * Brace-counting was tried twice and was wrong twice: these signatures take an
 * **object** parameter, so the first brace belongs to the parameters, and their
 * return types are `Promise<{ ... }>`, so the second belongs to the annotation.
 * Both times the walk returned a type declaration, and assertions against a type
 * declaration would have passed happily on a body doing the forbidden thing.
 *
 * Every method in this class closes at exactly two spaces of indentation, which
 * is a property of the file rather than of TypeScript - so it is asserted below
 * before anything is read from it.
 */
const methodBody = (src: string, signature: string): string => {
  const start = src.indexOf(signature);
  if (start === -1) throw new Error(`no method ${signature}`);
  const end = src.indexOf('\n  }', start);
  if (end === -1) throw new Error(`no close for ${signature}`);
  return src.slice(start, end);
};

describe('a declared preference is never the record of what was used', () => {
  it('is reading the files it thinks it is', () => {
    expect(FILES.length).toBeGreaterThan(50);
    expect(SERVICE).toContain('async sendInstructions(');
    expect(SERVICE).toContain('async setPreferredChannel(');
    // `methodBody` depends on this: a class whose members close at some other
    // indentation would make every sweep below read the wrong text and pass.
    expect(SERVICE).toContain('\n  }');
  });

  // ----- 1. SENDING MUST NOT WRITE THE PREFERENCE ----- //

  it('sendInstructions never writes preferredChannel', () => {
    const body = stripComments(methodBody(SERVICE, 'async sendInstructions('));

    expect(body).toContain('channel: by.channel');
    // Any assignment to the preference from inside the send.
    expect(body).not.toMatch(/preferredChannel\s*[:=]/);
  });

  it('the transition that records a channel cannot touch the preference', () => {
    const body = stripComments(methodBody(SERVICE, 'async transition('));
    expect(body).toMatch(/channel:\s*by\.channel/);
    expect(body).not.toMatch(/preferredChannel/);
  });

  // ----- 2. THE PREFERENCE IS NEVER READ AS THE CHANNEL ----- //

  it('nothing falls back from channel to preferredChannel', () => {
    /**
     * `channel ?? preferredChannel` and `channel || preferredChannel` are the
     * merge written defensively: on the day the two differ, the reader silently
     * gets the wish.
     */
    const banned = [
      /channel\s*\?\?\s*[\w.]*preferredChannel/i,
      /channel\s*\|\|\s*[\w.]*preferredChannel/i,
      /preferredChannel\s*\?\?\s*[\w.]*\bchannel\b/i,
    ];
    const offenders = FILES.filter((f) => banned.some((p) => p.test(f.src))).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('setPreferredChannel writes the preference and never the channel', () => {
    const body = stripComments(methodBody(SERVICE, 'async setPreferredChannel('));

    expect(body).toContain('preferredChannel: preferred');
    // `channel:` as a write target would be the merge in the other direction.
    expect(body).not.toMatch(/data:\s*\{[^}]*[^d]channel:/s);
  });

  it('the client has no route that sets the authoritative channel', () => {
    const controller = stripComments(
      readFileSync(
        join(ROOT, 'apps', 'api', 'src', 'lands', 'controllers', 'lands-client.controller.ts'),
        'utf8',
      ),
    );
    expect(controller).toContain('setPreferredChannel');
    expect(controller).not.toMatch(/dto\.channel\b/);
  });

  // ----- 3. THE TWO COLUMNS EXIST AND ARE DISTINCT ----- //

  it('the schema carries both, separately', () => {
    const model = SCHEMA.slice(
      SCHEMA.indexOf('model Payment {'),
      SCHEMA.indexOf('\n}', SCHEMA.indexOf('model Payment {')),
    );
    expect(model).toMatch(/^\s*preferredChannel\s+PaymentChannel\?/m);
    expect(model).toMatch(/^\s*channel\s+PaymentChannel\?/m);
  });

  it('the send DTO takes a channel and offers no default from the preference', () => {
    const dto = stripComments(
      readFileSync(
        join(ROOT, 'apps', 'api', 'src', 'lands', 'payments', 'dto', 'payments.dto.ts'),
        'utf8',
      ),
    );
    const schema = dto.slice(dto.indexOf('sendInstructionsSchema'));
    expect(schema).toContain('channel: z.nativeEnum(PaymentChannel)');
    // A `.default(...)` here would make accepting the preference the path of
    // least resistance, which v03 asks against explicitly.
    expect(schema.slice(0, schema.indexOf('reason'))).not.toContain('.default(');
    expect(schema.slice(0, schema.indexOf('reason'))).not.toContain('preferredChannel');
  });
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

/**
 * **No channel detail may reach an outbound email body.**
 *
 * v03 section 4d: *"Les coordonnees s'affichent sur l'espace du client, derriere
 * son authentification ; l'email n'est qu'une notification qui dit qu'elles sont
 * disponibles et ne les contient pas."* Three reasons, in the design's order:
 * the whole exchange then sits where the payment is; bank details do not lie
 * around in a forwardable mailbox; and on the day of a dispute what was
 * communicated is established by the system rather than by a screenshot.
 *
 * ---------------------------------------------------------------------------
 * Written so it would have caught the behaviour that shipped
 * ---------------------------------------------------------------------------
 * Until 7 September `templates/index.ts` had a `channelBlock` that rendered the
 * bank name, the account name, the IBAN, the SWIFT code, the mobile money
 * number and the notary's address into **both** the instruction email and the
 * reminder - and G3's own suite asserted that it did, under the name "every
 * channel detail reaches the message". The assertion was the defect, written
 * down and passing.
 *
 * This scans the template source for the field names. It fails on the G3
 * behaviour and passes on the v03 one; `payment-instructions.spec.ts` covers the
 * same rule from the other side, on what a real send actually puts in `args`.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');

/**
 * The fields that are coordinates. Not `supportEmail`/`supportPhone`: a number
 * to call for help is not a place to send money, and it belongs in every message.
 */
const COORDINATE_FIELDS = [
  'bankName',
  'bankAccountName',
  'bankIban',
  'bankSwift',
  'mobileMoneyOperator',
  'mobileMoneyNumber',
  'mobileMoneyName',
  'orangeMoneyNumber',
  'orangeMoneyName',
  'mtnMoneyNumber',
  'mtnMoneyName',
  'notaryName',
  'notaryPhone',
  'notaryAddress',
];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((e) => {
    const f = join(dir, e);
    return statSync(f).isDirectory() ? walk(f) : ['.ts', '.tsx'].includes(extname(e)) ? [f] : [];
  });

/** Comments stripped: prose that names the ban is not the ban being broken. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const EMAIL_SRC = join(ROOT, 'libs', 'common', 'src', 'email');

describe('no payment coordinates can reach an outbound email', () => {
  const files = walk(EMAIL_SRC);

  it('is reading the email templates it thinks it is', () => {
    expect(files.length).toBeGreaterThan(0);
    const all = files.map((f) => readFileSync(f, 'utf8')).join('\n');
    // The sweep can see template code, so an empty result means "clean", not
    // "looked in the wrong place".
    expect(all).toContain('paymentInstructionsAvailable');
    expect(all).toContain("args['reference']");
  });

  it.each(COORDINATE_FIELDS)('no template renders %s', (field) => {
    const offenders = files
      .filter((f) =>
        new RegExp(`args\\[['"\`]${field}['"\`]\\]`).test(stripComments(readFileSync(f, 'utf8'))),
      )
      .map((f) => relative(ROOT, f));

    expect(offenders).toEqual([]);
  });

  it('there is no renderer of channel details left to import by accident', () => {
    // `channelBlock` is deleted rather than left unused: an unused renderer of
    // bank details is one import away from being used again.
    const all = files.map((f) => stripComments(readFileSync(f, 'utf8'))).join('\n');
    expect(all).not.toContain('channelBlock');
  });

  it('the service passes no coordinate field into the email args', () => {
    const service = stripComments(
      readFileSync(
        join(ROOT, 'apps', 'api', 'src', 'lands', 'payments', 'payments.service.ts'),
        'utf8',
      ),
    );
    // `detailsFor` is fetched - it is written to the audit row, which is
    // evidence - but the args object handed to `emailService.send` must not
    // spread it. Asserted on the shape rather than on the absence of the call.
    expect(service).not.toMatch(/args:\s*\{[^}]*\.\.\.details/s);
    expect(service).not.toMatch(/args:\s*\{[^}]*\.\.\.channels/s);
  });
});

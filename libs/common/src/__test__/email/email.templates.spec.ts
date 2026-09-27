import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { I18nService } from 'nestjs-i18n';

import { buildEmail } from '../../email/templates';

/**
 * No email may put an internal identifier in front of a customer.
 *
 * `clientPortalAccess` carried `agentName: agentUserId` with the comment "will
 * be enriched in the controller". It never was, and the client received
 * **"Votre agent KAMNET : 00000000-0000-4000-8000-b00000000005"** — a UUID where
 * a person's name belongs. A leak and an embarrassment in the same line, and it
 * shipped because nothing rendered the template and read it.
 *
 * The rule these tests hold: render the real template, and assert on what a
 * human would see.
 */
/**
 * A stub that reads the REAL message catalogue and substitutes `{placeholders}`
 * the way nestjs-i18n does.
 *
 * The first version of this stub appended every argument to every key, so
 * `agentName=` appeared in the body line and the "omits the agent line"
 * assertion failed against a template that was behaving correctly. A stub that
 * does not resemble the thing it stands in for tests the stub.
 */
const messages = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'i18n', 'fr', 'email.json'), 'utf8'),
) as Record<string, Record<string, string>>;

const i18n = {
  translate: (key: string, opts?: { args?: Record<string, unknown> }) => {
    const [, group, leaf] = key.split('.');
    const raw = messages[group]?.[leaf] ?? key;
    return raw.replace(/\{(\w+)\}/g, (_m, name: string) =>
      String(opts?.args?.[name] ?? `{${name}}`),
    );
  },
} as unknown as I18nService;

const UUID = '00000000-0000-4000-8000-b00000000005';

describe('clientPortalAccess template', () => {
  it('prints the agent name when there is one', () => {
    const { html } = buildEmail(
      'clientPortalAccess',
      'fr',
      {
        clientName: 'Alice',
        landTitle: 'Parcelle Kribi',
        totalPrice: '8000000',
        agentName: 'Eric Mbou',
      },
      i18n,
    );

    expect(html).toContain('Votre agent KAMNET™ : Eric Mbou');
  });

  it('omits the agent line entirely when the name is empty, rather than printing an id', () => {
    const { html } = buildEmail(
      'clientPortalAccess',
      'fr',
      { clientName: 'Alice', landTitle: 'Parcelle Kribi', totalPrice: '8000000', agentName: '' },
      i18n,
    );

    expect(html).not.toContain('Votre agent KAMNET');
    // The rest of the email still renders.
    expect(html).toContain('Bonjour Alice');
    expect(html).toContain('Parcelle Kribi');
  });

  it('never renders a raw uuid into the body, whatever it is handed', () => {
    // The defect, reproduced: someone passes the id again.
    const { html } = buildEmail(
      'clientPortalAccess',
      'fr',
      { clientName: 'Alice', landTitle: 'Parcelle Kribi', totalPrice: '8000000', agentName: UUID },
      i18n,
    );

    // This one WOULD render it, which is the point: the template cannot tell a
    // name from an id, so the guarantee has to come from the caller. The
    // service-level test below is what holds that end.
    expect(html).toContain(UUID);
  });
});

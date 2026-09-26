import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { I18nService } from 'nestjs-i18n';

import { escapeHtml, html, safeUrl, trustedMarkup } from '../../email/html';
import { buildEmail } from '../../email/templates';

/**
 * A value carried by an email is read, never executed.
 *
 * The public contact form takes 5000 unauthenticated characters and the template
 * interpolated them into markup, so a message body could close the paragraph it
 * was in and open an anchor. The mail landed in `contact@`, which means the
 * payload was aimed at staff.
 *
 * These render the real templates and assert on what arrives, because the
 * defect was invisible in the source and obvious in the output.
 */
const messages = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'i18n', 'fr', 'email.json'), 'utf8'),
) as Record<string, Record<string, string>>;

/** Substitutes `{placeholders}` the way nestjs-i18n does, over the real catalogue. */
const i18n = {
  translate: (key: string, opts?: { args?: Record<string, unknown> }) => {
    const [, group, leaf] = key.split('.');
    const raw = messages[group]?.[leaf] ?? key;
    return raw.replace(/\{(\w+)\}/g, (_m, name: string) =>
      String(opts?.args?.[name] ?? `{${name}}`),
    );
  },
} as unknown as I18nService;

const PAYLOAD = '</p><a href="https://phish.example/reset">Reinitialisez votre mot de passe</a><p>';

const CONTACT_ARGS = {
  reference: 'CTC-2609-0001',
  name: 'Alice',
  email: 'alice@example.com',
  phone: '+237600000000',
  subjectLabel: 'Terrains',
  locale: 'fr',
  consentGivenAt: '2026-09-23',
  message: PAYLOAD,
};

describe('a contact message cannot carry markup into the mailbox', () => {
  it('escapes the body of the notification that reaches the back office', () => {
    const { html: body } = buildEmail('contactRequestNotification', 'fr', CONTACT_ARGS, i18n);

    expect(body).not.toContain('<a href="https://phish.example/reset">');
    expect(body).toContain('&lt;a href=&quot;https://phish.example/reset&quot;&gt;');
  });

  it('escapes the body echoed back to the sender', () => {
    const { html: body } = buildEmail('contactRequestReceived', 'fr', CONTACT_ARGS, i18n);

    expect(body).not.toContain('<a href="https://phish.example/reset">');
    expect(body).toContain('&lt;a href=&quot;https://phish.example/reset&quot;&gt;');
  });

  it('escapes the sender name, which lands in a table cell', () => {
    const { html: body } = buildEmail(
      'contactRequestNotification',
      'fr',
      { ...CONTACT_ARGS, message: 'bonjour', name: '<img src=x onerror=alert(1)>' },
      i18n,
    );

    expect(body).not.toContain('<img src=x');
    expect(body).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  /**
   * The second channel. `applicationRejected.reason` is
   * `Note du réviseur : <em>{reason}</em>`, so the value is interpolated by
   * nestjs-i18n into markup the template then emits. Escaping the template's own
   * interpolations would have left this one open.
   */
  it('escapes a value that i18n interpolates into markup of its own', () => {
    const { html: body } = buildEmail(
      'applicationRejected',
      'fr',
      { firstName: 'Alice', reason: PAYLOAD },
      i18n,
    );

    expect(body).not.toContain('<a href="https://phish.example/reset">');
    expect(body).toContain('&lt;a href=&quot;https://phish.example/reset&quot;&gt;');
  });

  it('puts the message in the mail with no whitespace of its own added', () => {
    // The block is `white-space: pre-wrap`, so indentation around the value is
    // rendered. Prettier formats the contents of an `html` tag and gave every
    // contact message a leading blank line and ten spaces before its first word.
    const { html: body } = buildEmail(
      'contactRequestNotification',
      'fr',
      { ...CONTACT_ARGS, message: 'Bonjour,\nje cherche un terrain.' },
      i18n,
    );

    const block = body.match(/pre-wrap;">([\s\S]*?)<\/p>/)?.[1];

    expect(block).toBe('Bonjour,\nje cherche un terrain.');
  });

  it('keeps the markup the catalogue itself carries', () => {
    const { html: body } = buildEmail(
      'applicationRejected',
      'fr',
      { firstName: 'Alice', reason: 'dossier incomplet' },
      i18n,
    );

    // `<em>` comes from the translation, not from the argument, so it survives.
    expect(body).toContain('<em>dossier incomplet</em>');
  });

  it('leaves the subject as plain text, since a subject is never parsed as markup', () => {
    const { subject } = buildEmail(
      'contactRequestNotification',
      'fr',
      { ...CONTACT_ARGS, subject: 'Terrains & VERIFY' },
      i18n,
    );

    expect(subject).toContain('Terrains & VERIFY');
    expect(subject).not.toContain('&amp;');
  });
});

describe('the escaping primitives', () => {
  it('escapes the five characters that break out of text and attributes', () => {
    expect(escapeHtml(`& < > " '`).toString()).toBe('&amp; &lt; &gt; &quot; &#39;');
  });

  it('escapes an interpolated plain value', () => {
    expect(html`<p>${'<b>x</b>'}</p>`.toString()).toBe('<p>&lt;b&gt;x&lt;/b&gt;</p>');
  });

  it('passes trusted markup through untouched, or nothing would ever render', () => {
    const inner = trustedMarkup('<b>x</b>', 'written by this test, not by a caller');
    expect(html`<p>${inner}</p>`.toString()).toBe('<p><b>x</b></p>');
  });

  it('renders nothing for the empty cases a conditional block produces', () => {
    expect(html`<p>${false}${null}${undefined}</p>`.toString()).toBe('<p></p>');
  });

  it('refuses a javascript: link, which escaping alone would not catch', () => {
    expect(() => safeUrl('javascript:alert(1)')).toThrow(/scheme/);
  });

  it('refuses anything that is not an absolute URL', () => {
    expect(() => safeUrl('/reset?token=abc')).toThrow(/absolute URL/);
  });

  it('escapes the quote that would end the href attribute', () => {
    expect(safeUrl('https://kambriq.com/a?x=1"onmouseover="alert(1)').toString()).toBe(
      'https://kambriq.com/a?x=1&quot;onmouseover=&quot;alert(1)',
    );
  });

  it('refuses trusted markup that states no reason', () => {
    expect(() => trustedMarkup('<b>x</b>', '')).toThrow(/reason/);
  });
});

/**
 * P5 - a KAMNET application is written by the applicant and read in the
 * contact inbox, so its motivation and name carry no markup there either.
 */
describe('a KAMNET application cannot carry markup into the contact inbox', () => {
  const args = {
    name: PAYLOAD,
    email: 'ada@example.com',
    phone: '+237600000000',
    kcaNumber: 'KCA-20250101-0001',
    sponsorCode: 'AGT-2025-0001',
    motivation: PAYLOAD,
    receivedAt: '26 septembre 2026',
  };

  it('escapes the motivation and the name', () => {
    const { html: body } = buildEmail('kamnetApplicationNotification', 'fr', args, i18n);
    expect(body).not.toContain('<a href="https://phish.example/reset">');
    expect(body).toContain('&lt;a href=&quot;https://phish.example/reset&quot;&gt;');
  });
});

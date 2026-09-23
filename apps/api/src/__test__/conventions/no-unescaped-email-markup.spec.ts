import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as ts from 'typescript';

/**
 * An email body is built by escaping interpolation, never by concatenation.
 *
 * The contact form accepts 5000 unauthenticated characters and the templates
 * interpolated them straight into markup, so a message body could close its
 * paragraph and open an anchor in the mail that lands in `contact@`. Escaping
 * the sites that existed fixed those sites and said nothing about the next
 * template somebody writes, which is what this is for.
 *
 * The type system carries most of the weight: a template returns `SafeHtml`, and
 * only `html`, `escapeHtml`, `safeUrl` and `trustedMarkup` produce one. What is
 * left to a test is the handful of ways that guarantee can be dismantled without
 * `tsc` objecting.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const TEMPLATES = join(ROOT, 'libs', 'common', 'src', 'email', 'templates', 'index.ts');
const HTML_MODULE = join(ROOT, 'libs', 'common', 'src', 'email', 'html.ts');

const parse = (source: string): ts.SourceFile =>
  ts.createSourceFile('scanned.ts', source, ts.ScriptTarget.Latest, true);

const walk = (node: ts.Node, visit: (n: ts.Node) => void): void => {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
};

/**
 * Every interpolating template literal that is not tagged `html`.
 *
 * The scan is an AST walk rather than a regex because a comment in this
 * repository has already been read as a declaration twice. An AST carries no
 * comments, so the question cannot arise.
 */
const untaggedInterpolations = (source: string): string[] => {
  const found: string[] = [];
  walk(parse(source), (node) => {
    if (!ts.isTemplateExpression(node)) return;

    const parent = node.parent;
    const tagged = ts.isTaggedTemplateExpression(parent) && parent.tag.getText() === 'html';
    // A thrown message is read by a developer in a log, never by a mail client.
    const thrown = ts.isNewExpression(parent) && parent.expression.getText() === 'Error';
    if (!tagged && !thrown) {
      found.push(node.getText().replace(/\s+/g, ' ').slice(0, 80));
    }
  });
  return found;
};

/** The markup argument of every `trustedMarkup(...)` call, in source order. */
const trustedMarkupCalls = (source: string): string[] => {
  const found: string[] = [];
  walk(parse(source), (node) => {
    if (!ts.isCallExpression(node) || node.expression.getText() !== 'trustedMarkup') return;
    found.push((node.arguments[0]?.getText() ?? '').replace(/\s+/g, ' '));
  });
  return found;
};

describe('no unescaped markup can reach an email body', () => {
  const templates = readFileSync(TEMPLATES, 'utf8');

  it('is reading the file it thinks it is', () => {
    // A scan over an empty or moved file would make every assertion below
    // vacuously true, which is the failure this whole file exists to prevent.
    expect(templates).toContain('const templates = defineTemplates({');
    expect(templates.match(/html`/g)?.length ?? 0).toBeGreaterThan(30);
  });

  it('builds every body with the escaping tag', () => {
    expect(untaggedInterpolations(templates)).toEqual([]);
  });

  it('marks markup as trusted in exactly one reviewed place', () => {
    // `trustedMarkup` is the one way past the escaping, so the guard pins the
    // site rather than trying to judge a new one. Adding a call fails here, and
    // so does dropping `escapeArgs` from the one that exists.
    expect(trustedMarkupCalls(templates)).toEqual([
      'i18n.translate(key, { lang, args: escapeArgs(args) })',
    ]);
  });

  it('keeps the return type that makes the tag unavoidable', () => {
    // Widen this back to `string` and a plain literal compiles again, which is
    // the one-line edit that undoes everything above.
    expect(templates).toMatch(/\)\s*=>\s*\{\s*subject:\s*string;\s*html:\s*SafeHtml\s*\};/);
  });

  it('routes a subject through the plain-text translator, not the markup one', () => {
    // A subject is never parsed as markup, so escaping it would print `&amp;`
    // in the recipient's inbox.
    expect(templates).not.toMatch(/subject:\s*t\(/);
    expect(templates).toMatch(/subject:\s*subjectText\(/);
  });

  it('checks a link scheme, which escaping alone cannot do', () => {
    // `javascript:` contains none of the five escaped characters.
    expect(readFileSync(HTML_MODULE, 'utf8')).toContain(
      "new Set(['http:', 'https:', 'mailto:', 'tel:'])",
    );
    expect(templates).not.toMatch(/href="\$\{args\[/);
  });
});

describe('the scan discriminates', () => {
  // Against strings rather than against the repository, so these say something
  // about the scan itself rather than about what happens to be committed today.
  it('catches a plain interpolating literal', () => {
    expect(untaggedInterpolations('const x = `<p>${value}</p>`;')).toEqual(['`<p>${value}</p>`']);
  });

  it('accepts one tagged with html', () => {
    expect(untaggedInterpolations('const x = html`<p>${value}</p>`;')).toEqual([]);
  });

  it('rejects a different tag, since only html escapes', () => {
    expect(untaggedInterpolations('const x = raw`<p>${value}</p>`;')).toEqual([
      '`<p>${value}</p>`',
    ]);
  });

  it('allows a thrown message', () => {
    expect(untaggedInterpolations('throw new Error(`no template ${name}`);')).toEqual([]);
  });

  it('sees a new trustedMarkup call, which is how a value would be laundered', () => {
    expect(trustedMarkupCalls("trustedMarkup(args['message'], 'looks fine')")).toEqual([
      "args['message']",
    ]);
  });
});

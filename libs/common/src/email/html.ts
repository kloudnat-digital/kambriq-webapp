import escapeHtmlEntities from 'escape-html';

/**
 * HTML construction for email bodies, with escaping that cannot be forgotten.
 *
 * The templates used to interpolate values straight into markup. The public
 * contact form accepts 5000 unauthenticated characters, so a message body
 * containing `</p><a href="...">` rendered a live anchor in the mail that lands
 * in `contact@`. Escaping each site by hand fixes the sites that exist today and
 * nothing about the next template somebody writes.
 *
 * So the escape happens in the interpolation itself: `html` escapes every value
 * it is given unless that value is already `SafeHtml`, and `SafeHtml` is
 * produced only by the three functions below.
 *
 * The escaping itself is `escape-html`, which Express already pulls into this
 * tree and which has been unchanged since 2015. What is local is the contract
 * around it - the brand that lets `tsc` tell markup from a value, which is the
 * part no library can supply for this codebase's own template type.
 */

/** Markup that is safe to emit, so `html` passes it through unescaped. */
export class SafeHtml {
  constructor(private readonly markup: string) {}

  toString(): string {
    return this.markup;
  }
}

/** Renders a value as text: it can be read, never parsed as markup. */
export const escapeHtml = (value: string | number): SafeHtml =>
  new SafeHtml(escapeHtmlEntities(String(value)));

/**
 * Marks markup the code itself wrote as safe to emit.
 *
 * The one escape hatch, and the only thing that makes the rest of this module
 * bypassable. It takes the reason as an argument so every call site states at
 * the call site why the markup is trusted.
 */
export const trustedMarkup = (markup: string, reason: string): SafeHtml => {
  if (!reason) {
    throw new Error('trustedMarkup requires a reason: state why this markup is safe to emit');
  }
  return new SafeHtml(markup);
};

/** The schemes a link in an outbound email is allowed to use. */
const ALLOWED_SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Renders a value as a URL for an `href`.
 *
 * Escaping alone would not stop `javascript:` - it contains none of the five
 * escaped characters - so the scheme is checked first, against an allow-list,
 * using the WHATWG parser in Node rather than a pattern.
 *
 * A refusal throws. The sanitiser libraries substitute `about:blank` instead,
 * which would ship an email whose action link silently goes nowhere - a
 * mechanism reporting success by saying nothing, which is the failure this
 * repository spends the most effort refusing.
 */
export const safeUrl = (value: string | number): SafeHtml => {
  const raw = String(value);

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Refusing to emit a link that is not an absolute URL: ${raw}`);
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new Error(`Refusing to emit a link with the scheme "${parsed.protocol}": ${raw}`);
  }

  return escapeHtml(raw);
};

/** What a template may interpolate. The empty cases render nothing. */
type Interpolated = SafeHtml | string | number | false | null | undefined;

const render = (value: Interpolated): string => {
  if (value instanceof SafeHtml) {
    return value.toString();
  }
  if (value === false || value === null || value === undefined) {
    return '';
  }
  return escapeHtml(value).toString();
};

/** Builds markup, escaping every interpolated value that is not already `SafeHtml`. */
export const html = (strings: TemplateStringsArray, ...values: Interpolated[]): SafeHtml =>
  new SafeHtml(
    strings.reduce(
      (acc, chunk, i) => acc + chunk + (i < values.length ? render(values[i]) : ''),
      '',
    ),
  );

/**
 * A paragraph that renders a value's own line breaks.
 *
 * Built as one string rather than as markup inside a template, because the
 * block is `white-space: pre-wrap` - so any indentation a formatter puts around
 * the interpolation is rendered as part of the text. Prettier formats the
 * contents of an `html` tag and did exactly that, giving every contact message
 * a leading blank line and ten spaces before its first word.
 */
export const preservedTextBlock = (value: string | number): SafeHtml =>
  trustedMarkup(
    `<p style="background:#f0f4f8;border-radius:8px;padding:16px;white-space:pre-wrap;">${escapeHtml(value)}</p>`,
    'the markup is fixed here and the only value in it is escaped inline',
  );

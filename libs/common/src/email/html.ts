import escapeHtmlEntities from 'escape-html';

/**
 * HTML construction for email bodies, with automatic escaping for safety.
 *
 * Interpolates template strings. All values are automatically escaped using `escape-html`
 * unless they are already wrapped in `SafeHtml`.
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
 * Bypasses escaping to mark known-safe markup as safe to emit.
 * Requires an explicit reason argument to ensure justification at the call site.
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
 * Validates and escapes a URL for use in an `href` attribute.
 * Only absolute URLs with schemes present in ALLOWED_SCHEMES are permitted.
 * Throws an error on invalid or disallowed URLs to prevent potentially malicious links (e.g. `javascript:`).
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
 * Generates an escaped paragraph that preserves line breaks via `white-space: pre-wrap`.
 * Implemented without a template literal to prevent external code formatters from introducing unintended leading spaces.
 */
export const preservedTextBlock = (value: string | number): SafeHtml =>
  trustedMarkup(
    `<p style="background:#f0f4f8;border-radius:8px;padding:16px;white-space:pre-wrap;">${escapeHtml(value)}</p>`,
    'the markup is fixed here and the only value in it is escaped inline',
  );

/**
 * The brand palette as TypeScript values, for the places a token cannot reach.
 *
 * Step 0 of the agent launch wave bans hex literals in components, and the ban
 * is enforced by `apps/web/src/app/brand-palette.spec.ts`. Two kinds of code
 * cannot obey it by using a Tailwind class:
 *
 * 1. **The Mapbox markers.** `lands-map.tsx` and `land-map.tsx` build DOM nodes
 *    imperatively and set `style.cssText`; `lands-map.tsx` says so in its own
 *    comment - "Tailwind classes don't work here". Mapbox needs a colour
 *    string, not a class name.
 * 2. **`app/global-error.tsx`.** A root error boundary renders its own `<html>`
 *    and `<body>`, replacing the document, so `globals.css` is not in scope and
 *    a `var(--color-...)` reference resolves to nothing. Making the error page
 *    depend on the stylesheet loading is making it depend on the thing that may
 *    have broken.
 *
 * So the values live here, once, and this file is the single exemption in the
 * spec - the same shape as `roles.enum.ts` being the one place a role code may
 * be spelled. Anywhere else, use the token.
 *
 * These MUST stay in step with the anchors in `globals.css`. The spec asserts
 * that they do, so a change in one place fails until it is made in both.
 */

/** Teal, the action colour. `--color-primary-500`. */
export const BRAND_TEAL = '#1a7a6e';

/** Teal one step darker, for hover on an action surface. `--color-primary-600`. */
export const BRAND_TEAL_DARK = '#17665d';

/** Navy, chrome. `--color-accent-800`. */
export const BRAND_NAVY = '#0d1b2a';

/** Antique gold. `--color-gold-500`. */
export const BRAND_GOLD = '#b8972a';

/** Warm cream, the surface anchor. `--color-surface-100`. */
export const BRAND_CREAM = '#eeece5';

/** The lightest surface, used as a page background. `--color-surface-50`. */
export const BRAND_PAPER = '#fefefd';

/** Body text. `--color-surface-950`. */
export const BRAND_INK = '#403e3a';

/** White, named so a component never writes `#fff` to mean "on a dark fill". */
export const BRAND_ON_DARK = '#ffffff';

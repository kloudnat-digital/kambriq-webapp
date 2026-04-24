# ADR-006: Content Strategy - MDX for Long-form + next-intl JSON for UI Copy

Date: 2026-04-18
Status: Accepted
Deciders: Kambriq Engineering Team
Last updated: 2026-04-18 (Phase 1-4 i18n completion)

---

## Context and Problem Statement

The Kambriq web app needs a reliable, reviewable, and maintainable approach for managing page content in two languages (English and French). Content falls into two distinct categories:

1. **Short, structured UI copy** - navigation labels, button text, hero subtitles, error messages, form placeholders. These are typically single sentences or short phrases, always bilingual, and tightly coupled to UI components.
2. **Long-form narrative content** - about page story, mission and vision statements, FAQ answers, legal pages, product descriptions. These require proper prose formatting (headings, paragraphs, lists, bold text) and must be easy to write, proofread, and revise.

The challenge: no single format handles both categories equally well.

- JSON is excellent for structured UI copy but becomes painful for multi-paragraph text (no formatting, no line breaks, escape characters, hard to proofread).
- MDX is excellent for formatted prose but is overly complex for short labels and requires a React render tree, making it unsuitable for dynamic interpolation (e.g. `"Welcome, {name}"`).

---

## Decision Drivers

- **Reviewability**: Content changes should produce clean, readable git diffs
- **Bilingual support**: Both EN and FR must be maintained in parallel
- **Developer experience**: Content should be easy to write and proofread without tooling
- **No new infrastructure**: Avoid introducing a CMS or external service at this stage
- **Next.js App Router compatibility**: Solution must work with server components and Turbopack
- **Separation of concerns**: Content should not be mixed into component logic

---

## Considered Options

1. **MDX + next-intl JSON (hybrid)** ← chosen
2. next-intl JSON only - all content in JSON files
3. Headless CMS (Sanity, Contentful, Strapi)
4. Markdown files only (without MDX)

---

## Decision Outcome

**Chosen option: Hybrid - MDX for long-form content, next-intl JSON for UI copy.**

Each tool is used for what it does best:

| Content type                                                                    | Format                               | Location                               |
| ------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------- |
| Nav labels, button text, hero subtitles, form placeholders, error messages      | `next-intl` JSON                     | `src/i18n/messages/en.json`, `fr.json` |
| Page narratives, mission/vision statements, FAQ answers, legal pages            | MDX                                  | `src/content/{page}/{locale}.mdx`      |
| Structured data arrays (team members, timeline, offices, FAQ items with search) | TypeScript files or `next-intl` JSON | per use case                           |

---

## Implementation

### MDX Infrastructure

- **`@next/mdx`** compiles `.mdx` files as React components at build time (no runtime overhead).
- **`apps/web/mdx-components.tsx`** is the App Router requirement that maps every Markdown element (`h1`, `p`, `ul`, `strong`, etc.) to a styled Tailwind component. This is the single place to control the visual style of all MDX content.
- **`pageExtensions`** in `next.config.ts` is extended with `md` and `mdx` so Next.js treats these files as valid page and component modules.

### Content Directory Convention

```
apps/web/src/content/
  {page}/
    en.mdx      ← English version
    fr.mdx      ← French version
```

Current content directory (all pages live here):

```
src/content/
  about/
    en.mdx
    fr.mdx
  verify/
    en.mdx
    fr.mdx
  methode/
    en.mdx
    fr.mdx
  plan/
    en.mdx
    fr.mdx
  legal/
    mentions/       ← legal notices
      en.mdx
      fr.mdx
    terms/          ← CGU / terms of use
      en.mdx
      fr.mdx
    privacy/        ← privacy policy
      en.mdx
      fr.mdx
    rgpd/           ← GDPR by country
      en.mdx
      fr.mdx
```

### `ContentPage` Type and `loadContent`

The `ContentPage` union type in `src/lib/content.ts` enumerates every registered MDX page. Adding a new page requires updating this type **and** adding a matching `case` in the `loadContent` switch statement. Both steps are intentional: they keep imports statically analyzable by Turbopack (no dynamic `import()` paths) and make missing cases a compile-time error.

```ts
// src/lib/content.ts
export type ContentPage =
  | 'about'
  | 'verify'
  | 'methode'
  | 'plan'
  | 'legal-mentions'
  | 'legal-terms'
  | 'legal-privacy'
  | 'legal-rgpd';
```

### Loading MDX in a Page

The `loadContent(page, locale)` utility in `src/lib/content.ts` loads the locale-appropriate MDX component in any server component:

```tsx
// app/about/page.tsx (server component)
import { getLocale } from 'next-intl/server';
import { loadContent } from '@/lib/content';

export default async function AboutPage() {
  const locale = await getLocale();
  const AboutContent = await loadContent('about', locale);
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <AboutContent />
      </div>
    </section>
  );
}
```

To add a new MDX page:

1. Create `src/content/{page}/en.mdx` and `fr.mdx`
2. Add the key to the `ContentPage` union in `src/lib/content.ts`
3. Add a `case '{page}/en'` and `case '{page}/fr'` in the `loadContent` switch
4. Call `loadContent` in the server component

### next-intl JSON - Namespace Inventory

`src/i18n/messages/en.json` (mirrored by `fr.json`) is organized into top-level namespaces. Each namespace is consumed by a distinct set of components via `useTranslations(namespace)` (client) or `getTranslations(namespace)` (server async).

| Namespace                                                      | Scope                                                                       | Key count (approx.) |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------- |
| `nav`                                                          | Public navbar, mobile sheet, home logo aria-label                           | 10                  |
| `metadata`                                                     | Root layout `generateMetadata` (page title/description)                     | 2                   |
| `a11y`                                                         | Accessibility-only strings: aria-labels, sr-only text across all components | 6                   |
| `hero`, `why`, `process`, `blog`, `plan`, `methode`, `homeCta` | Public home page sections                                                   | ~60                 |
| `landsHero`, `howItWorks`, `whyBuyAtKambriq`, `landTypes`      | Lands public page                                                           | ~30                 |
| `landSearch`, `landsCompare`, `landsAdmin`                     | Lands search, comparison, admin table                                       | ~25                 |
| `products.lands`                                               | LANDS product page                                                          | ~15                 |
| `products.verify`                                              | VERIFY product page (hero card, FAQ, ready-to-verify CTA)                   | ~20                 |
| `products.kbs`                                                 | KBS product page (about, eligibility, chapters, exam, process)              | ~60                 |
| `products.kamnet`                                              | KAMNET product page (agent journey, why-agent features)                     | ~20                 |
| `diaspora`, `partners`, `testimonials`, `faq`                  | Home page supporting sections                                               | ~30                 |
| `footer`                                                       | Footer links and legal                                                      | ~10                 |
| `auth`                                                         | Login, register, forgot-password pages                                      | ~20                 |
| `contact`, `comingSoon`, `help`, `knowledgeBase`               | Utility pages                                                               | ~20                 |
| `about`                                                        | About page UI framing (the prose lives in MDX)                              | ~5                  |
| `legal.nav`                                                    | Legal section sidebar navigation labels                                     | 4                   |
| `quickActions`                                                 | Agent/manager quick-action cards                                            | ~8                  |
| `app.agentDashboard`                                           | Agent dashboard: stats, pipeline, recent clients, sales chart               | ~30                 |
| `app.clientDashboard`                                          | Client dashboard: greeting, empty states                                    | ~10                 |
| `app.managerDashboard`                                         | Manager dashboard: stats, charts, top agents                                | ~25                 |
| `app.reserveForm`                                              | Land reservation form                                                       | ~20                 |
| `app.landDetail`                                               | Land detail page (specs, map, documents)                                    | ~25                 |
| `app.reservations`                                             | Reservations list and detail                                                | ~20                 |
| `app.invite`                                                   | Invite client form and page                                                 | ~10                 |
| `app.myLands`                                                  | Agent's own land listings                                                   | ~10                 |
| `app.network`                                                  | Agent sponsorship network tree                                              | ~10                 |
| `app.mentorship`                                               | Mentorship program page and analytics                                       | ~25                 |
| `app.gamification`                                             | Gamification / badges page                                                  | ~15                 |
| `app.landsPage`                                                | Internal lands browser page                                                 | ~8                  |

The `a11y` namespace deserves special mention: it contains strings that are only consumed by screen readers or assistive technology (aria-labels, `sr-only` spans). These strings are never visible in the UI but must be translated so that bilingual users with assistive tools receive correct output.

---

## Consequences

### Positive

- **Clean diffs**: Markdown changes are line-by-line, making PRs easy to review sentence by sentence
- **No runtime overhead**: MDX is compiled at build time by `@next/mdx`; no filesystem reads at request time
- **Familiar format**: Anyone who can write Markdown can contribute content
- **Server-component native**: MDX components render on the server; no client bundle impact
- **Bilingual by structure**: Locale is encoded in the file path (`en.mdx` vs `fr.mdx`), not in a runtime switch
- **Complete coverage**: All user-facing text - public pages, internal app, legal, accessibility strings - is now bilingual

### Negative / Trade-offs

- **Turbopack constraint**: Remark/rehype plugins with function values are not serializable for Turbopack and cannot be passed to `createMDX`. Standard Markdown syntax (headings, bold, lists, links, blockquotes) covers all current needs without GFM extras (tables, strikethrough, task lists).
- **No live editing**: Content changes require a code commit and CI/CD deployment. Acceptable at the current stage; a headless CMS can be adopted later if non-developer editors need to update content.
- **`loadContent` switch statement**: Adding a new MDX page requires updating both the file system and `src/lib/content.ts`. This is intentional - it keeps imports statically analyzable by Turbopack and avoids dynamic `import()` paths.
- **No interpolation in MDX**: Dynamic values (e.g. user names, prices from the API) cannot be injected into MDX prose. Use next-intl JSON with `t('key', { value })` for those cases.

---

## Rejected Options

### next-intl JSON only

Writing multi-paragraph content in JSON is painful: no formatting, newlines must be escaped, bold/italic are impossible without HTML strings, and git diffs are unreadable for prose changes. This approach does not scale beyond short UI copy.

### Headless CMS (Sanity, Contentful, Strapi)

Adds significant infrastructure: a new external service, API keys, webhook triggers, preview environments, and deployment dependencies. The ROI is justified only when non-developer content editors need to publish without code changes. At the current stage, all content is managed by the engineering team in code.

### Markdown only (without MDX)

Pure `.md` files cannot embed React components, making it impossible to include interactive elements (forms, maps, carousels) within content pages. MDX is a strict superset of Markdown, so all standard Markdown syntax works within `.mdx` files.

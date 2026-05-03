# kambriq-webapp - Agent guide

Nx monorepo: NestJS API (`apps/api`) + Next.js 16 Web (`apps/web`) + shared lib (`libs/common`) + Prisma schemas (`prisma/{core,kbs,kamnet,lands}`).

The sister repo for infra (Terraform / AWS) lives at `../kambriq-infra/`. Production has never been deployed; dev is live at `https://dev.kambriq.com`.

## Code ownership boundaries (workspace rule)

| Path                                                                                                     | Owner        | Agent default                                  |
| -------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------- |
| `apps/api/**`                                                                                            | Ulrich (CTO) | Read-only unless explicit ask                  |
| `apps/web/src/{components,lib,hooks,app/(app),app/(auth)}/**`                                            | Ulrich       | Read-only unless explicit ask                  |
| `apps/web/src/content/**`, `messages/*.json`                                                             | Ops/content  | Free to edit                                   |
| `apps/web/src/app/{about,methode,plan,contact,faq,blog,legal,health,robots.ts,sitemap.ts,layout.tsx}/**` | Ops          | Free to edit (public pages, layout)            |
| `apps/web/mdx-components.tsx`                                                                            | Ops          | Free to edit                                   |
| `apps/web/src/components/{layout,mdx,landing,section}/**`                                                | Ops          | Free to edit (footer, MDX components, landing) |
| `.github/`, Dockerfiles, `.env.example`, root tooling                                                    | Ops          | Free to edit                                   |
| `prisma/seed.ts`                                                                                         | Ops          | Free to edit                                   |
| `prisma/*/schema.prisma`                                                                                 | Ulrich       | Read-only                                      |

If a task crosses into Ulrich's territory (e.g. `apps/api/lands/lands.service.ts`), surface that explicitly to the user and do not modify without confirmation.

## Branch & commit conventions

- Always feature-branch off `develop`. Never commit directly to `develop`. Squash merge via PR.
- Push to `develop` triggers full CI (`ci.yml` quality -> build -> deploy-dev -> Playwright e2e). Don't push without a clean local `pnpm build:web`.
- **Commitlint enforces lowercase subject** (`subject-case` rule). Acronyms must be lowercased. `chore(env): align aws region to eu-central-1, add s3 keys` is fine; `... AWS region ... S3 keys` is rejected by the husky hook.
- Never use `--no-verify`, `--no-gpg-sign`, or `--amend` on pushed commits. Fix the message, create a new commit.

## Locale routing - non-obvious

There is **no `[locale]` route segment** in this app. Pages live at `apps/web/src/app/<route>/page.tsx` directly.

- URLs are `/legal/...`, `/about` - never `/fr/legal/...` or `/en/about`.
- Locale comes from cookie `NEXT_LOCALE` (next-intl 4.x without `localePrefix`). `apps/web/src/i18n/request.ts` reads it and defaults to `fr`.
- In a server component: `const locale = await getLocale()` from `next-intl/server`. For UI strings: `await getTranslations('namespace')`.
- Smoke-test EN by switching the cookie. URL stays the same.

## MDX content layout

Top-level pages live at `apps/web/src/content/<slug>/{fr,en}.mdx` (about, methode, plan, verify). Legal pages live one level deeper at `apps/web/src/content/legal/<slug>/{fr,en}.mdx`. There is no frontmatter - the H1 lives in the markdown.

The loader is `apps/web/src/lib/content.ts`, a hardcoded `switch` on `${page}/${locale}`. Adding a new MDX folder requires updating BOTH the `ContentPage` union AND adding the matching `case`. Default fallback returns `about/en`.

Page slugs use a `legal-` prefix (`legal-mentions`, `legal-cookies`, `legal-rgpd-ue`, etc.).

## MDX components (auto-injected via `mdx-components.tsx`)

- **Tables** are styled (header `bg-gray-50`, body `divide-y divide-gray-200`, padding `px-4 py-3`). Keep markdown pipe-syntax in MDX - do NOT convert tables to JSX. Table styling was a recurring bug fixed in commit `51d2793`.
- **`<Callout type="info|warning|danger|success" title="...">`** - semantic Tailwind colors (blue/amber/red/emerald) with left border + tinted background. Used in legal MDX. Children can be markdown (paragraphs, lists, links). Provided by PR #18 (`feat/legal-content-v01`); available once merged.
- **`<DocumentMeta version effectiveDate docId>`** - footer paragraph with version + effective date + reference, rendered as small grey text with top border. Append to the end of legal MDX files. EN files use date format `May 2, 2026`; FR use `2 mai 2026`. Provided by PR #18.

When writing legal MDX, the gold-standard template is `apps/web/src/content/legal/mentions/fr.mdx` (after PR #18 merges).

## Strict bans

- **Em-dash `—` (U+2014) and en-dash `–` (U+2013)**: zero tolerance. Run before every commit:
  ```bash
  grep -rnP '[–—]' apps/web/src/{content,app,components} apps/web/mdx-components.tsx
  ```
  Must return no matches. Page metadata strings (`metadata.description`) are an easy oversight. Past dedicated commit: `6821ecb fix(content): replace em dashes with standard hyphens throughout`.
- **Banned terms in user-facing content**: `TDT`, `titre mère`, `morcellement`, `en cours de division`. Never appear in MDX, page metadata, i18n strings, or PR descriptions.
- **Brand names - exact form, never translated, ™ preserved**: `KAMBRIQ TFL™`, `KAMBRIQ VEFL™`, `KAMBRIQ VEFIL™`, `KAMBRIQ VERIFY™`, `KAMBRIQ PLAN™`, `KAMNET™`, `KBS`, `KCA`.
- **Label definitions** (do not paraphrase):
  - TFL = immatriculation FAITE + lotissement FAIT -> propriété immédiate
  - VEFL = immatriculation FAITE + lotissement EN COURS -> propriété après lotissement
  - VEFIL = immatriculation EN COURS + lotissement APRÈS -> propriété après immatriculation puis lotissement (le plus long)
- **Coordinates exact**: `contact@kambriq.com` / `+33 7 45 90 98 56` (WhatsApp) / `Fotomena, Dschang, Région de l'Ouest, Cameroun` (FR) / `Fotomena, Dschang, West Region, Cameroon` (EN).
- **Legal status**: SARL en cours de constitution, capital 10 000 000 FCFA, siège Fotomena Dschang, représentation Douala-Dibamba.

## Common commands

```bash
pnpm install                 # postinstall regenerates 4 Prisma clients - slow, expected
pnpm docker:dev              # postgres + redis + pgadmin
pnpm db:setup                # migrate + seed
pnpm start                   # API on :3000
pnpm start:web               # Web on :3001 (Turbopack dev)
pnpm build:web               # web prod build (catches MDX/TSX errors)
pnpm lint:web                # ESLint
pnpm typecheck               # API tsc - currently red on apps/api/lands/* (Ulrich's WIP, not your problem)
pnpm test:web:e2e            # Playwright (cross-browser)
```

## Runtime contract

ECS task definition injects (post PR `feat/s3-media-dev-config` apply):

| Var                            | Source                | Notes                                                         |
| ------------------------------ | --------------------- | ------------------------------------------------------------- |
| `AWS_S3_BUCKET`                | tf var                | `kambriq-media-dev` in dev                                    |
| `AWS_S3_REGION`, `AWS_REGION`  | tf var                | `eu-central-1` everywhere - if you see `eu-west-3` it's a bug |
| `S3_PRESIGNED_URL_TTL_SECONDS` | tf var, default `900` | Read by `StorageService`                                      |
| `S3_MAX_UPLOAD_SIZE_MB`        | tf var, default `100` | Validated at API layer                                        |
| `DATABASE_URL_*`, `JWT_SECRET` | SSM SecureString      | Pulled via `valueFrom` on the task                            |
| `NEXT_PUBLIC_APP_URL`          | build-time ARG        | Defaults to `https://dev.kambriq.com` for sitemap/OG          |

S3 bucket key structure (contract with the API):

- `lands/{landId}/{photos,videos,documents,thumbnails}/`
- `verify/{requestId}/{submitted,results}/`
- `agents/{agentId}/profile/`
- `uploads/tmp/` (auto-expired after 24h via lifecycle rule)

## Pointers

- Active PRs: `gh pr list --repo kloudnat-digital/kambriq-webapp`
- Production bootstrap prerequisites: `../kambriq-infra/docs/adr/ADR-005-production-automation-prerequisites.md`
- Legal source markdowns (Visquis's Drive): `~/Library/CloudStorage/GoogleDrive-visquis.miaffossa@kambriq.com/My Drive/KAMBRIQ-DGT/06_JURIDIQUE/Mentions et CGU/`
- Past dedicated fixes worth knowing: `51d2793` (table styling), `6821ecb` (em-dash purge), `d1643b9` (auth middleware whitelist for static OG assets)

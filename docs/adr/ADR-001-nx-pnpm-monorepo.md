# ADR-001: Nx + pnpm Monorepo for API and Web

Date: 2026-04-17
Status: Accepted
Deciders: Kambriq Engineering Team

---

## Context and Problem Statement

The Kambriq platform has a NestJS API and a Next.js web frontend that share types, validation logic, and utility functions. We need a repository strategy that enables code sharing, consistent tooling, and independent deployability.

---

## Decision Drivers

- **Code sharing**: `@kambriq/common` must be consumable by both API and Web
- **Single CI pipeline**: Lint, test, and build all packages with one workflow
- **Selective builds**: Nx affected — only rebuild what changed
- **Dependency consistency**: One `pnpm-lock.yaml` across all packages
- **Developer experience**: One `pnpm install`, one `pnpm test`

---

## Considered Options

1. **Nx monorepo with pnpm workspaces** ← chosen
2. Separate repositories (polyrepo)
3. Lerna + npm workspaces
4. Turborepo + pnpm

---

## Decision Outcome

**Chosen: Nx v22 with pnpm workspaces**

```
kambriq-webapp/
├── apps/api/          @kambriq/api    — NestJS
├── apps/web/          @kambriq/web    — Next.js
├── libs/common/       @kambriq/common — Shared library
└── prisma/            Shared schema directory
```

pnpm workspace is declared in `pnpm-workspace.yaml`. Nx handles build orchestration, caching, and affected detection.

---

## Pros and Cons

### Option 1: Nx + pnpm ✅

**Good:**

- `nx affected` rebuilds only changed packages — fast CI
- Shared `@kambriq/common` consumed via TypeScript path alias, no publish step
- Nx task pipeline: `build` depends on `^build` — correct dependency order
- pnpm strict hoisting prevents phantom dependencies
- Single `pnpm-lock.yaml` — reproducible installs

**Bad:**

- `nx.json` and `project.json` files add configuration overhead
- First-time setup requires understanding Nx concepts
- Nx Cloud recommended for distributed caching (not currently configured)

### Option 2: Polyrepo

**Good:** Maximum isolation, independent release cycles

**Bad:**

- Shared code requires publishing to npm or a private registry
- Version drift between API and Web common library
- Two CI pipelines to maintain

### Option 3: Lerna + npm

**Good:** Mature, well-documented

**Bad:**

- npm workspaces are slower than pnpm for large monorepos
- Lerna is in maintenance mode (deprecated for active development)
- No built-in affected computation (needs custom scripts)

### Option 4: Turborepo

**Good:** Simple configuration, fast build caching

**Bad:**

- Less mature ecosystem than Nx for NestJS + Next.js together
- No built-in code generation or workspace generators
- Nx has better NestJS plugin support

---

## Consequences

- **`postinstall` hook**: Generates all 4 Prisma clients after every `pnpm install`. If any schema is broken, install fails — keep schemas valid at all times
- **pnpm-workspace.yaml**: Currently only lists `apps/web`. The API is managed exclusively by Nx. This is intentional — adding `apps/api` to pnpm workspace caused conflicts with Nx resolution
- **CI note**: The `deploy-dev.yml` workflow must use `pnpm install --frozen-lockfile`, not `npm ci`. The `ci.yml` was already migrated; `deploy-dev.yml` still uses `npm ci` and must be fixed (see deployment blockers)
- **Nx cache**: Nx task outputs are cached in `.nx/cache`. CI should restore this cache keyed on `pnpm-lock.yaml` for build speed

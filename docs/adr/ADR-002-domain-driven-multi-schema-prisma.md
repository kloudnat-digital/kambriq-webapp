# ADR-002: Domain-Driven Design with Multi-Schema Prisma ORM

Date: 2026-04-17
Status: Accepted
Deciders: Kambriq Engineering Team

---

## Context and Problem Statement

The Kambriq platform spans four bounded contexts: Core (identity), KBS (training), KAMNET (agent network), and Lands (property). Each context has distinct entities, business rules, and change cadences. We need an architecture that enforces domain boundaries at the code and database level, while keeping a single deployable API binary.

---

## Decision Drivers

- **Bounded context isolation**: KBS migration must not touch Core schema
- **Independent schema evolution**: Domain teams can evolve their Prisma schema without reviewing other domains
- **Single API process**: One NestJS app serves all domains (cost efficiency)
- **Type safety**: Each domain gets its own generated Prisma client with correct types
- **Operational simplicity**: One deployment unit, one Docker image

---

## Decision Outcome

**Chosen: Multi-schema Prisma with one client per domain, injected via NestJS DI**

### Schema Structure

```
prisma/
├── core/    schema.prisma  →  kambriq_core    (Users, Roles, Auth tokens)
├── kbs/     schema.prisma  →  kambriq_kbs     (Courses, Exams, Certificates)
├── kamnet/  schema.prisma  →  kambriq_kamnet  (Agents, Commissions, Referrals)
└── lands/   schema.prisma  →  kambriq_lands   (Parcels, Reservations, Labels)
```

### Client Injection Pattern

Each domain has a dedicated Prisma service that wraps the generated client:

```typescript
// libs/common/src/prisma/core-prisma.service.ts
@Injectable()
export class CorePrismaService extends PrismaClient {
  constructor() {
    super({ datasources: { db: { url: process.env.DATABASE_URL_CORE } } });
  }
}
```

NestJS modules import only the service for their domain:

```typescript
// apps/api/src/core/core.module.ts
@Module({ providers: [CorePrismaService, ...] })
export class CoreModule {}
```

### Migration Commands

```bash
# Run a specific domain migration (dev)
pnpm db:migrate:dev:core

# Deploy all migrations (CI/CD)
pnpm db:migrate:deploy     # runs deploy for all 4 domains
```

---

## Pros and Cons

### Chosen Architecture ✅

**Good:**

- Zero cross-domain database JOINs (enforced by separate connection strings)
- Domain teams can add tables without reviewing other schemas
- Prisma generates fully-typed clients per domain - no type pollution
- Independent migration history per domain

**Bad:**

- 4 Prisma clients open 4 connection pools - monitor total Postgres `max_connections`
- Cross-domain queries (e.g., show a user's KBS certificates) require API-level joins
- `postinstall` runs `prisma generate` for all 4 schemas - if one is malformed, install blocks

### Alternative: Single Prisma schema (rejected)

**Good:** One client, one migration history

**Bad:**

- All domain changes in one schema file - merge conflicts at scale
- Prisma multi-schema support (`previewFeatures = ["multiSchema"]`) doesn't provide the same isolation guarantees
- One migration failure blocks all domains

### Alternative: GraphQL Federation per domain (rejected)

**Good:** True microservice isolation

**Bad:**

- Requires multiple deployed services - 4× the ECS cost
- Federation gateway adds latency
- Premature for current team size

---

## Consequences

- **Connection pool sizing**: With 4 clients × default pool size of 5 = 20 connections. RDS `max_connections` for db.t4g.micro is ~60. Monitor and tune `connection_limit` in `DATABASE_URL_*` query params if needed: `?connection_limit=3`
- **Health check**: The `/api/v1/health/ready` endpoint runs `SELECT 1` on the **core** Prisma client only; the full `/health` endpoint checks core + KBS. The KamNet and Lands clients are not yet wired into the health controller (`apps/api/src/health/health.controller.ts`)
- **Cross-domain foreign keys**: Deliberately absent. Use application-level references (store UUIDs, resolve at service layer)
- **Future domains** (Verify, Valuation): Follow the same pattern - create `prisma/{domain}/schema.prisma` and add `DATABASE_URL_{DOMAIN}` to SSM

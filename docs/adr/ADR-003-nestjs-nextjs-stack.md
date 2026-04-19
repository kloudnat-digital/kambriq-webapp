# ADR-003: NestJS v11 (API) + Next.js v16 (Web) Stack

Date: 2026-04-17
Status: Accepted
Deciders: Kambriq Engineering Team

---

## Context and Problem Statement

The Kambriq platform needs a backend API and a frontend web application. Both must be TypeScript-first, maintainable by a small team, and deployable as Docker containers on ECS Fargate.

---

## Backend: NestJS v11

### Decision

NestJS provides a structured, decorator-driven framework built on top of Express (v5). It maps well to domain-driven design via modules, and has first-class support for the libraries in use (Prisma, BullMQ, JWT, i18n, Swagger, Terminus health checks).

### Key Architecture Decisions

```
apps/api/src/
├── app/          Root module, bootstrap (Helmet, CORS, Pino logger, Zod validation)
├── core/         Auth (JWT strategy, refresh tokens), Users, Roles, Profiles
├── kbs/          Courses, Exams (BullMQ processor), Certificates
├── kamnet/       Agents, Applications, Commissions (BullMQ processor)
├── lands/        Parcels, Reservations, Labels
├── health/       NestJS Terminus — checks core + KBS Prisma clients + system resources
└── newsletter/   SES subscription management
```

### Global Setup (main.ts)

```typescript
// Security
app.use(helmet());
app.enableCors({ origin: corsOrigins, credentials: true });

// Validation + exception handling (order matters — most specific first)
app.useGlobalFilters(
  new GlobalExceptionFilter(), // catch-all
  new PrismaExceptionFilter(), // Prisma → HTTP codes
  new ZodExceptionFilter(), // Zod → 400
);
app.useGlobalInterceptors(new TransformResponseInterceptor());

// Logging
app.useLogger(app.get(Logger)); // Pino structured JSON

// Swagger (non-production only)
if (process.env.NODE_ENV !== 'production') {
  setupSwagger(app);
}

// Rate limiting: ThrottlerModule + ThrottlerGuard registered as APP_GUARD in AppModule
// Values from env: THROTTLE_TTL (ms), THROTTLE_LIMIT (req/window)

// Global prefix from env (set to 'api/v1' in ECS via API_PREFIX env var)
app.setGlobalPrefix(process.env.API_PREFIX || 'api');
await app.listen(process.env.PORT || 3000);
```

### Libraries

| Library                        | Purpose                                     |
| ------------------------------ | ------------------------------------------- |
| `@nestjs/jwt` + `passport-jwt` | Stateless JWT auth                          |
| `@nestjs/bullmq` + `bullmq`    | Async job queues (exams, commissions)       |
| `nestjs-i18n`                  | API error messages in fr/en                 |
| `nestjs-pino`                  | Structured JSON logging (CloudWatch)        |
| `@nestjs/swagger`              | Auto-generated OpenAPI docs                 |
| `@nestjs/throttler`            | Rate limiting per IP                        |
| `@nestjs/terminus`             | Health checks for ALB                       |
| `helmet`                       | HTTP security headers                       |
| `nestjs-zod`                   | Request/response validation via Zod schemas |
| `@aws-sdk/client-s3`           | File upload to S3                           |
| `@aws-sdk/client-sesv2`        | Transactional email                         |

---

## Frontend: Next.js v16

### Decision

Next.js v16 with App Router provides SSR, static generation, and a clean route-based architecture. It runs as a standalone Node.js server (`output: 'standalone'`) in a Docker container, enabling ECS deployment identical to the API.

### Key Architecture Decisions

```
apps/web/src/
├── app/           App Router (RSC by default, client components where needed)
│   ├── (auth)/    Login, register, password reset — unauthenticated routes
│   ├── dashboard/ Agent + client dashboards
│   ├── kbs/       Training, exams, certificates
│   ├── kamnet/    Agent network
│   ├── lands/     Property browse + management
│   └── admin/     Admin panels
├── components/    Shared UI components (Radix UI + Tailwind CSS v4)
├── i18n/          next-intl messages (fr/en)
└── auth.ts        NextAuth v5 configuration
```

### Libraries

| Library                      | Purpose                               |
| ---------------------------- | ------------------------------------- |
| `next-intl`                  | i18n routing and translations (fr/en) |
| `next-auth` v5               | Authentication (JWT sessions)         |
| `@tanstack/react-query`      | Server state caching                  |
| `zustand`                    | Client state                          |
| `react-hook-form` + `zod`    | Form validation                       |
| `tailwindcss` v4             | Styling                               |
| `@radix-ui/*`                | Accessible headless components        |
| `mapbox-gl` + `react-map-gl` | Interactive maps for Lands            |
| `recharts`                   | Analytics dashboards                  |
| `next-themes`                | Dark/light mode                       |

### Docker Build

```dockerfile
# Build-time args (must be passed during docker build)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL

# Output mode: standalone (includes server.js + all dependencies)
# next.config.ts: output: 'standalone'
```

**Important**: `NEXT_PUBLIC_*` variables are baked into the JavaScript bundle at build time. They cannot be changed at runtime. Pass them as `--build-arg` to `docker build`.

---

## Consequences

- **ECS port mapping**: The web container listens on port 3001 (`ENV PORT=3001` in `Dockerfile.web`). The ALB target group is set to `port=3000` in Terraform to avoid forced recreation; ECS registers IP targets at the actual container port (3001), overriding the TG default. The ECS security group explicitly allows both 3000 (API) and 3001 (web) from the ALB security group.
- **Standalone output size**: ~120–200 MB Docker image for Next.js standalone. Use multi-stage builds (already implemented) to avoid including `node_modules` in the final image.
- **Swagger in dev**: Swagger UI is served at `/api/docs` in non-production environments. Do not expose in production.
- **React 19**: Using React 19 RC with Next.js 16 — some third-party libraries may have compatibility issues. Pin versions in `pnpm-lock.yaml`.

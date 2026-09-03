# ADR-004: CI/CD - Separated Build, Quality, and Deploy Pipelines

Date: 2026-04-17
Last updated: 2026-04-17
Status: Accepted
Deciders: Kambriq Engineering Team

---

## Context and Problem Statement

We need a CI/CD pipeline for the Kambriq monorepo that:

- Enforces code quality before any artifact is produced
- Builds and pushes a Docker image exactly once per commit
- Deploys both the NestJS API and the Next.js web frontend to ECS Fargate
- Runs database migrations safely before the new code goes live
- Uses no long-lived AWS credentials
- Supports rollback to a previous image in under 5 minutes

---

## Decision Outcome

**Chosen: Three-workflow separation - quality gate / image build / pure deploy**

### Workflow Responsibilities

| File                 | Trigger                                            | Responsibility                                                                                              |
| -------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `ci.yml`             | push/PR to `develop` or `main`                     | Quality gate (lint, typecheck, test in parallel) + Docker build on `develop` push + auto-trigger deploy-dev |
| `deploy-dev.yml`     | `workflow_call` from ci.yml or `workflow_dispatch` | Deploy API + web to dev - no build step                                                                     |
| `deploy-prd.yml`     | push `v*` tag or `workflow_dispatch`               | Build with cache + deploy API to prd                                                                        |
| `release-please.yml` | push to `main`                                     | Create/update release PR, bump version, create tag                                                          |

`migrate-dev.yml` and `migrate-prd.yml` have been removed - migrations are embedded in every deploy.

---

## Infrastructure Prerequisites

The deployment pipeline depends on AWS infrastructure provisioned by Terraform (`kambriq-infra`).
**Terraform must be applied before any deployment can succeed.**

### Required infrastructure (Terraform modules)

| Module                       | What it creates                                             |
| ---------------------------- | ----------------------------------------------------------- |
| `modules/ecr-repository`     | ECR registries for API and web images                       |
| `modules/ecs-cluster`        | ECS Fargate cluster + task execution IAM role               |
| `modules/alb`                | ALB with HTTPS listener, API target group, web target group |
| `modules/ecs-service`        | ECS service + task definition for API and web               |
| `modules/rds-postgres`       | PostgreSQL RDS instance                                     |
| `modules/elasticache-redis`  | Redis ElastiCache cluster                                   |
| `modules/ssm-app-parameters` | SSM Parameter Store entries for secrets and config          |
| `modules/iam-roles-ecs`      | Task IAM roles for API and web containers                   |
| `envs/dev/main.tf`           | GitHub OIDC IAM role scoped to `environment:dev`            |

### First-time infrastructure setup order

```
1. Apply shared stack (kambriq-infra/envs/shared/)
   → VPC, subnets, Route 53 zone, GitHub OIDC provider, ACM certificate

2. Apply dev stack (kambriq-infra/envs/dev/)
   → All modules above
   → Outputs: ECR URLs, ECS cluster/service names, subnet IDs, SG IDs

3. Populate GitHub Actions environment variables (see table below)

4. Push to develop - automated pipeline takes over
```

---

## GitHub Actions Environment Variables

Both `deploy-dev.yml` and `deploy-prd.yml` read all configuration from GitHub Environment variables and secrets. **No values are hard-coded in workflow files.**

Set these in the **`dev`** GitHub Environment (Settings → Environments → dev):

### Variables (`vars.*`)

| Variable                  | Example value                                                 | Description                              |
| ------------------------- | ------------------------------------------------------------- | ---------------------------------------- |
| `AWS_REGION`              | `eu-central-1`                                                | AWS region                               |
| `ECR_REPO`                | `051551940370.dkr.ecr.eu-central-1.amazonaws.com/kambriq-api` | API ECR repository URL                   |
| `ECR_WEB_REPO`            | `051551940370.dkr.ecr.eu-central-1.amazonaws.com/kambriq-web` | Web ECR repository URL                   |
| `ECS_CLUSTER`             | `kambriq-dev-cluster`                                         | ECS cluster name                         |
| `ECS_SERVICE`             | `kambriq-dev-api`                                             | API ECS service name                     |
| `ECS_WEB_SERVICE`         | `kambriq-dev-web`                                             | Web ECS service name                     |
| `ECS_TASK_DEFINITION`     | `kambriq-dev-api`                                             | API task definition family name          |
| `ECS_WEB_TASK_DEFINITION` | `kambriq-dev-web`                                             | Web task definition family name          |
| `ECS_SUBNETS`             | `subnet-0e568ae408ff7358d,subnet-0ee39246b7854399e`           | Private subnet IDs (comma-separated)     |
| `ECS_SECURITY_GROUPS`     | `sg-00ba8c5c0cb644858`                                        | ECS task security group ID               |
| `CONTAINER_NAME`          | `api`                                                         | Container name in API task definition    |
| `WEB_CONTAINER_NAME`      | `web`                                                         | Container name in web task definition    |
| `ASSIGN_PUBLIC_IP`        | `DISABLED`                                                    | ECS tasks use private subnets            |
| `SMOKE_TEST_URL`          | `https://dev.kambriq.com/api/v1/health/ready`                 | URL polled after deploy to verify health |
| `NEXT_PUBLIC_API_URL`     | `https://dev.kambriq.com`                                     | Baked into web image at build time       |
| `NEXT_PUBLIC_APP_URL`     | `https://dev.kambriq.com`                                     | Baked into web image at build time       |

### Secrets (`secrets.*`)

| Secret          | Description                                                                          |
| --------------- | ------------------------------------------------------------------------------------ |
| `AWS_ROLE_ARN`  | ARN of the GitHub Actions IAM role (from Terraform output `github_actions_role_arn`) |
| `CODECOV_TOKEN` | Codecov upload token (optional; upload is non-blocking)                              |

Repeat for the **`prd`** environment with production values.

---

## Pipeline Flow

### Pull Request

```
push to PR targeting develop / main
  └─► ci.yml
        commitlint (validates commit message format, PR only)
        quality: lint     ─┐
        quality: typecheck ├─ parallel, fail-fast: false
        quality: test      ┘  (coverage uploaded to Codecov)
        (no build, no deploy)
```

### Push to `develop`

```
push to develop
  └─► ci.yml
        quality: lint ─┐
        quality: type  ├─ parallel (must all pass)
        quality: test  ┘
              │
        build-api ─────────────────────────────────────────────────┐
          Login to ECR                                              │
          docker buildx build --platform linux/amd64               │
            --file docker/Dockerfile.api                           │
            --cache-from type=gha,scope=api                        │
            --cache-to   type=gha,mode=max,scope=api               │
          Push tags: sha-{7char}, dev-latest                       │
                                                                   │
        build-web ─────────────────────────────────────────────────┤
          Login to ECR                                             │
          docker buildx build --platform linux/amd64              │
            --file docker/Dockerfile.web                          │
            --build-arg NEXT_PUBLIC_API_URL                       │
            --build-arg NEXT_PUBLIC_APP_URL                       │
            --cache-from type=gha,scope=web                       │
            --cache-to   type=gha,mode=max,scope=web              │
          Push tags: sha-{7char}, web-dev-latest                  │
              │                                                    │
              └────────────────────── both complete ──────────────┘
                                            │
                                    deploy-dev.yml (workflow_call)
                                    inputs:
                                      api_image_tag: sha-{7char}
                                      web_image_tag: sha-{7char}
```

### `deploy-dev.yml` steps

```
Configure AWS credentials (OIDC)
  │
Set image URIs
  API_IMAGE_URI = ECR_REPO:api_image_tag
  WEB_IMAGE_URI = ECR_WEB_REPO:web_image_tag
  │
Register API task definition
  describe-task-definition kambriq-dev-api (latest revision)
  replace container image → new revision N+1
  → NEW_TASK_DEF_ARN
  │
Run Prisma migrations (blocking)
  ecs run-task (one-off Fargate, new task def revision)
    command: node prisma/run-migrations.js
  ecs wait tasks-stopped
  check exit code == 0  ─── non-zero → workflow fails, service NOT updated
  │
[optional] Run database seed
  only when run_seed=true (workflow_dispatch input)
  ecs run-task with --seed flag
  never runs automatically
  │
Deploy API service
  ecs update-service --task-definition NEW_TASK_DEF_ARN
  ecs wait services-stable  (rolling replace, circuit breaker enabled)
  │
Register Web task definition
  (skipped if ECS_WEB_SERVICE or ECS_WEB_TASK_DEFINITION not set)
  describe-task-definition kambriq-dev-web (latest revision)
  replace web container image → new revision M+1
  → NEW_WEB_TASK_DEF_ARN
  │
Deploy Web service
  ecs update-service --task-definition NEW_WEB_TASK_DEF_ARN
  ecs wait services-stable
  │
Smoke test
  curl -fsS --retry 5 SMOKE_TEST_URL (https://dev.kambriq.com/api/v1/health/ready)
  fallback: ALB DNS health check if vanity domain fails
  │
Deployment summary → GitHub Step Summary
```

### Push tag `v1.2.3` (release)

```
release-please merges to main → creates tag v1.2.3
  └─► deploy-prd.yml
        Validate: git tag == package.json version
        │
        build (uses GHA cache from develop - fast, most layers hit)
          docker buildx build --file docker/Dockerfile.api
          Push tags: v1.2.3, latest
          (note: prd deploy is API-only today; web prd to be added)
          │
        deploy (same sequence as deploy-dev above, prd environment)
          Register API task definition
          Run Prisma migrations (blocking)
          Deploy API service
          Smoke test
```

---

## Docker Build Details

### API (`docker/Dockerfile.api`)

Multi-stage build: `node:24.13.1-bookworm` → `node:24.13.1-bookworm-slim`

```
builder stage:
  corepack enable (activates pnpm from packageManager field)
  pnpm install --frozen-lockfile              (all workspace deps)
  pnpm --filter @kambriq/api run build        (NestJS webpack bundle → dist/)
  pnpm deploy --filter @kambriq/api --prod    (production deps only → /app/deploy)

production stage:
  Copy /app/deploy (node_modules + dist + prisma schemas)
  Non-root user: appuser (uid 1001)
  EXPOSE 3000
  CMD ["node", "dist/apps/api/main.js"]
  HEALTHCHECK: wget http://localhost:3000/api/v1/health/ready
```

Key: `pnpm deploy --prod` creates a minimal closure of production dependencies.
`prisma` is in `dependencies` (not `devDependencies`) so `run-migrations.js` is available in the production image.

### Web (`docker/Dockerfile.web`)

Multi-stage build: `node:24.13.1-bookworm` → `node:24.13.1-bookworm-slim`

```
builder stage:
  corepack enable
  pnpm install --frozen-lockfile --ignore-scripts
    (--ignore-scripts skips the postinstall prisma generate, which would
     fail because prisma schemas from apps/api are not in the web build context)
  Copy: tsconfig.base.json, apps/web/, libs/
  ARG NEXT_PUBLIC_API_URL, NEXT_PUBLIC_APP_URL (baked into bundle at build time)
  cd apps/web && next build
    (NOT `npx nx build web`: NX spawns next build as a child process and
     withNx in next.config.ts tries to re-create the project graph inside
     that subprocess, which fails with "Could not create project graph".
     Calling next build directly bypasses this double-graph creation.)

production stage:
  Copy .next/standalone  (minimal server, includes only used node_modules)
  Copy .next/static      (hashed static assets)
  Copy public/           (favicon, images)
  Non-root user: appuser (uid 1001)
  EXPOSE 3001
  ENV PORT=3001 HOSTNAME=0.0.0.0
  CMD ["node", "apps/web/server.js"]
  HEALTHCHECK: wget http://localhost:3001
```

Key: Next.js `output: 'standalone'` in `next.config.ts` is required for the production copy to work correctly.

---

## Image Tagging Strategy

| Event              | API ECR tags                | Web ECR tags                    | Mutable?                                |
| ------------------ | --------------------------- | ------------------------------- | --------------------------------------- |
| `develop` push     | `sha-abc1234`, `dev-latest` | `sha-abc1234`, `web-dev-latest` | mutable: `dev-latest`, `web-dev-latest` |
| `v*` tag (release) | `v1.2.3`, `latest`          | _(prd web build not yet added)_ | mutable: `latest`                       |
| Manual redeploy    | supply existing tag         | supply existing tag             | no new push                             |

Immutable SHA tags allow exact rollback: trigger `deploy-dev.yml` via `workflow_dispatch` with `api_image_tag: sha-abc1234`.

---

## Database Migration Strategy

### How `prisma/run-migrations.js` works

```
ensureDatabases()
  For each DB connection string (core, kbs, kamnet, lands):
    CREATE DATABASE IF NOT EXISTS (idempotent)

runMigrations()
  For each schema (core, kbs, kamnet, lands):
    If migrations/ directory exists and is non-empty:
      → prisma migrate deploy   (applies pending SQL files, safe for prod)
    Else (no migration history yet):
      → exits non-zero (explicit failure)
      → unless ALLOW_DB_PUSH=true is set by hand, which then runs
        prisma db push --accept-data-loss
```

`ALLOW_DB_PUSH` is **no longer set by the workflow**. All four modules were baselined on 2026-09-02 with a `0_init` migration (`prisma/<module>/migrations/0_init/migration.sql`), so every deploy now takes the `migrate deploy` path and `db push` is never reached.

The `db push` branch is kept as a guard rather than removed. If a module is added later with no `migrations/` directory, the deploy fails loudly with a named error. Removing the branch would instead let that module fall through to `migrate deploy`, find zero migrations, apply nothing and report success, leaving the service to start against a database whose tables were never created. Setting `ALLOW_DB_PUSH=true` by hand on a one-off task remains available as a deliberate escape hatch.

### First deployment

```
1. Terraform apply → RDS created (empty databases)
2. CI push to develop → migration task runs
   ensureDatabases() creates: kambriq_core, kambriq_kbs, kambriq_kamnet, kambriq_lands
   prisma migrate deploy applies 0_init to each empty database
3. API and web services updated
4. Seed: trigger deploy-dev.yml manually with run_seed=true
```

### Schema update (normal development)

```
1. Developer modifies a .prisma file
2. pnpm db:migrate:dev:core   (or :kbs, :kamnet, :lands)
   → Prisma generates a new SQL migration file in prisma/core/migrations/
3. Commit both the .prisma change and the migration file
4. Push to develop → migration task runs
   prisma migrate deploy → applies only the new migration file
   → Service update proceeds after successful migration
5. If migration task exits non-zero → deployment aborted
   → Previous containers keep running
   → Fix the migration, push again
```

### Local development

```bash
pnpm db:migrate:dev     # create + apply migrations for all 4 schemas
pnpm db:seed            # seed test data (idempotent)
pnpm db:setup           # db:migrate:dev + db:seed combined
pnpm docker:dev:init    # start Docker Compose + db:setup
pnpm db:studio          # open Prisma Studio on ports 5555-5558
```

---

## Security: GitHub OIDC

No long-lived AWS credentials anywhere. Each GitHub Environment has its own IAM role:

```
Condition:
  token.actions.githubusercontent.com:sub =
    repo:kloudnat-digital/kambriq-webapp:environment:dev
```

The IAM role grants only what deployment needs:

| Permission set | Actions                                                                | Scope                               |
| -------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| `EcrAuth`      | `ecr:GetAuthorizationToken`                                            | `*`                                 |
| `EcrPushPull`  | `ecr:BatchCheckLayerAvailability`, `ecr:PutImage`, etc.                | API ECR repo + Web ECR repo         |
| `EcsDeploy`    | `ecs:RegisterTaskDefinition`, `ecs:UpdateService`, `ecs:RunTask`, etc. | `*`                                 |
| `ElbDescribe`  | `elasticloadbalancing:DescribeLoadBalancers`, `DescribeTargetGroups`   | `*`                                 |
| `IamPassRole`  | `iam:PassRole`                                                         | Task execution role + API task role |

---

## Networking: ECS Task Routing

ECS tasks run in **private subnets** (`ASSIGN_PUBLIC_IP=DISABLED`). Traffic flows:

```
Internet
  → ALB (public subnets, port 443 HTTPS)
      → /api/*  → API target group → ECS API task (port 3000)
      → /*      → Web target group → ECS Web task (port 3001)
               ↓
         Private subnets
           ECS tasks → NAT Gateway → Internet (ECR pull, SES, etc.)
           ECS tasks ↔ RDS (PostgreSQL, port 5432)
           ECS tasks ↔ Redis (port 6379)
```

ECS security group ingress rules (from ALB SG only):

- Port 3000: API container
- Port 3001: Web container

The web target group is configured with `port=3000` in Terraform to avoid target group recreation when changing container ports. ECS registers IP targets at the actual container port (3001), overriding the TG default.

---

## ALB Health Checks

| Service | Path                   | Expected response          |
| ------- | ---------------------- | -------------------------- |
| API     | `/api/v1/health/ready` | HTTP 200                   |
| Web     | `/health`              | HTTP 200 `{"status":"ok"}` |

The web `/health` route (`apps/web/src/app/health/route.ts`) is excluded from the NextAuth middleware matcher in `apps/web/src/proxy.ts`:

```
matcher: ['/((?!api|health|_next/static|_next/image|favicon.ico|assets).*)']
```

Without this exclusion, unauthenticated ALB health checks get redirected to `/login` (307), causing the target to appear unhealthy.

---

## Concurrency

| Workflow     | Group        | cancel-in-progress                         |
| ------------ | ------------ | ------------------------------------------ |
| `deploy-dev` | `deploy-dev` | `false` - never interrupt a running deploy |
| `deploy-prd` | `deploy-prd` | `false`                                    |

---

## Rollback Procedure

### Rollback to a previous image (< 5 min)

1. Go to GitHub Actions → Deploy Dev → Run workflow
2. Enter `api_image_tag: sha-abc1234` and `web_image_tag: sha-xyz5678` (the previous known-good SHAs)
3. The workflow registers new task definition revisions pointing to the old images and redeploys

No rebuild required. The SHA tags in ECR are immutable.

### Emergency manual rollback

```bash
# Find the previous good task definition revision
aws ecs describe-task-definition --task-definition kambriq-dev-api --query 'taskDefinition.revision'

# Roll back to revision N-1
aws ecs update-service \
  --cluster kambriq-dev-cluster \
  --service kambriq-dev-api \
  --task-definition kambriq-dev-api:<previous-revision>

aws ecs wait services-stable --cluster kambriq-dev-cluster --services kambriq-dev-api
```

---

## Expected Runtimes

| Scenario                                 | Wall clock                                                  |
| ---------------------------------------- | ----------------------------------------------------------- |
| PR quality check                         | ~2-3 min                                                    |
| `develop` push (full path, warm cache)   | ~8-14 min (quality 3 min + builds 4-6 min + deploy 3-5 min) |
| `develop` push (cold cache, first build) | ~15-25 min (Docker layers not yet cached)                   |
| Manual redeploy (existing image)         | ~3-5 min (migrate + 2× ECS rolling update)                  |
| Rollback to previous SHA                 | ~3-5 min                                                    |
| Production release (`v*` tag)            | ~6-10 min (cached build fast + API deploy)                  |

---

## Path to Full Production Automation

The `develop → dev` pipeline is fully automated today. The `develop → production` pipeline
requires a one-time bootstrap before it becomes fully automated. This section documents every
remaining step.

> The full infrastructure prerequisites are documented in
> [kambriq-infra/docs/adr/ADR-005](../../kambriq-infra/docs/adr/ADR-005-production-automation-prerequisites.md).

### Current state

| Pipeline leg                            | Status       | Notes                                               |
| --------------------------------------- | ------------ | --------------------------------------------------- |
| push `develop` → quality gate           | ✅ Automated | lint, typecheck, test in parallel                   |
| push `develop` → build API + web images | ✅ Automated | ECR: `sha-{7char}`, `dev-latest` / `web-dev-latest` |
| push `develop` → deploy dev             | ✅ Automated | migrations + ECS rolling update + smoke test        |
| merge to `main` → Release PR            | ✅ Automated | release-please creates PR with version bump         |
| merge Release PR → `v*` tag             | ✅ Automated | release-please creates tag                          |
| tag → build + deploy API to prd         | ✅ Automated | once prd GitHub env is configured                   |
| tag → build + deploy **web** to prd     | ❌ Not yet   | web steps missing in `deploy-prd.yml`               |
| prd Terraform stack applied             | ❌ Not yet   | `envs/prd/` never applied                           |
| GitHub `prd` environment configured     | ❌ Not yet   | variables and secrets not yet set                   |

---

### Step 1 - Apply prd Terraform (kambriq-infra)

The ECS cluster, RDS, Redis, ALB, ECR, and IAM roles for production do not yet exist.

```bash
cd kambriq-infra/envs/prd
terraform apply \
  -var db_password="$(openssl rand -base64 24)" \
  -var jwt_secret="$(openssl rand -base64 64)" \
  -var redis_auth_token="$(openssl rand -base64 32)"
```

Collect outputs for Step 2:

```bash
terraform output github_actions_role_arn
terraform output ecr_api_url
terraform output ecr_web_url
terraform output ecs_cluster_name
terraform output ecs_api_service_name
terraform output ecs_web_service_name
terraform output private_subnet_ids
terraform output ecs_security_group_id
```

See [infra ADR-005](../../kambriq-infra/docs/adr/ADR-005-production-automation-prerequisites.md)
for the complete infrastructure bootstrap procedure.

---

### Step 2 - Create GitHub Environment `prd`

In **Settings → Environments → New environment** → name: `prd`:

- Add 1 required reviewer (prevents accidental production triggers)
- Restrict to `main` branch only

**Variables** (`vars.*`):

| Variable                  | Value                                                   |
| ------------------------- | ------------------------------------------------------- |
| `AWS_REGION`              | `eu-central-1`                                          |
| `ECR_REPO`                | `terraform output ecr_api_url`                          |
| `ECR_WEB_REPO`            | `terraform output ecr_web_url`                          |
| `ECS_CLUSTER`             | `terraform output ecs_cluster_name`                     |
| `ECS_SERVICE`             | `terraform output ecs_api_service_name`                 |
| `ECS_WEB_SERVICE`         | `terraform output ecs_web_service_name`                 |
| `ECS_TASK_DEFINITION`     | `kambriq-prd-api`                                       |
| `ECS_WEB_TASK_DEFINITION` | `kambriq-prd-web`                                       |
| `ECS_SUBNETS`             | `terraform output private_subnet_ids` (comma-separated) |
| `ECS_SECURITY_GROUPS`     | `terraform output ecs_security_group_id`                |
| `CONTAINER_NAME`          | `api`                                                   |
| `WEB_CONTAINER_NAME`      | `web`                                                   |
| `ASSIGN_PUBLIC_IP`        | `DISABLED`                                              |
| `SMOKE_TEST_URL`          | `https://kambriq.com/api/v1/health/ready`               |
| `NEXT_PUBLIC_API_URL`     | `https://kambriq.com`                                   |
| `NEXT_PUBLIC_APP_URL`     | `https://kambriq.com`                                   |

**Secrets** (`secrets.*`):

| Secret         | Value                                      |
| -------------- | ------------------------------------------ |
| `AWS_ROLE_ARN` | `terraform output github_actions_role_arn` |

---

### Step 3 - Add web service to `deploy-prd.yml`

`deploy-prd.yml` currently builds and deploys only the API. Add the following blocks:

**After the API image push step - add web image build:**

```yaml
- name: Build and push web image
  uses: docker/build-push-action@v3
  with:
    context: .
    file: docker/Dockerfile.web
    push: true
    platforms: linux/amd64
    tags: |
      ${{ vars.ECR_WEB_REPO }}:${{ github.ref_name }}
      ${{ vars.ECR_WEB_REPO }}:web-prd-latest
    build-args: |
      NEXT_PUBLIC_API_URL=${{ vars.NEXT_PUBLIC_API_URL }}
      NEXT_PUBLIC_APP_URL=${{ vars.NEXT_PUBLIC_APP_URL }}
    cache-from: type=gha,scope=web
    cache-to: type=gha,mode=max,scope=web
```

**After the API service is stable - add web service deploy:**

```yaml
- name: Render web task definition
  id: task-def-web
  uses: aws-actions/amazon-ecs-render-task-definition@v1
  with:
    task-definition-arn: ${{ vars.ECS_WEB_TASK_DEFINITION }}
    container-name: ${{ vars.WEB_CONTAINER_NAME }}
    image: ${{ vars.ECR_WEB_REPO }}:${{ github.ref_name }}

- name: Deploy web service
  uses: aws-actions/amazon-ecs-deploy-task-definition@v1
  with:
    task-definition: ${{ steps.task-def-web.outputs.task-definition }}
    service: ${{ vars.ECS_WEB_SERVICE }}
    cluster: ${{ vars.ECS_CLUSTER }}
    wait-for-service-stability: true
```

---

### Step 4 - First production deployment

Once steps 1-3 are complete, the pipeline is fully automated. Trigger the first production deploy:

```
1. Open PR: develop → main
2. Merge PR
3. release-please automatically opens a "Release PR" (bumps version, writes CHANGELOG)
4. Review and merge the Release PR
   → release-please creates tag v0.1.0
   → deploy-prd.yml triggers automatically
5. Pipeline runs:
   - Build API image → ECR: v0.1.0, latest
   - Build web image → ECR: v0.1.0, web-prd-latest
   - Migrations (blocking Fargate task)
   - Deploy API → wait stable
   - Deploy web → wait stable
   - Smoke test: GET https://kambriq.com/api/v1/health/ready
6. Production is live at kambriq.com ✅
```

For all subsequent releases: merge the release-please PR. No other manual step required.

---

### Summary checklist

**Infrastructure (kambriq-infra)**

- [ ] Collect secrets: `db_password`, `jwt_secret`, `redis_auth_token`
- [ ] Update `api_acm_certificate_arn` in `envs/prd/terraform.tfvars`
- [ ] Run `terraform apply` for `envs/prd/`
- [ ] Enable `lifecycle { prevent_destroy = true }` on RDS after first apply

**CI/CD (kambriq-webapp)**

- [ ] Create GitHub Environment `prd` with 1 required reviewer
- [ ] Populate all `prd` environment variables (from Terraform outputs)
- [ ] Add `AWS_ROLE_ARN` secret
- [ ] Add web image build + deploy steps to `deploy-prd.yml`

**Launch**

- [ ] PR `develop → main` + release-please PR + merge → automated from here

---

## Consequences

- **Build once, deploy many**: Images are built once per commit. SHA tags are immutable. Rollback never rebuilds.
- **Migrations gate the deploy**: If `run-migrations.js` exits non-zero, the service is not updated. Broken migrations keep old containers running.
- **No automatic post-deploy rollback**: If the smoke test fails after the ECS update, the new containers are already running. Roll back manually via `workflow_dispatch`.
- **Web build args are baked in**: `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_APP_URL` are embedded at build time (Next.js requirement for `NEXT_PUBLIC_*` env vars). Changing these values requires a rebuild.
- **Seed is one-time and opt-in**: `run_seed=true` via `workflow_dispatch` only. Seeds never run automatically in CI to prevent accidental data injection.
- **prd web deploy not yet automated**: `deploy-prd.yml` currently only deploys the API. Step 3 above adds the web deploy. This is the final blocker for full production automation.

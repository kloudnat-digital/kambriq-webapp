# Dev Deployment

This document describes the one-off migration workflow and deployment to ECS Fargate.

## Required environment variables

Set these before running `scripts/deploy-dev.sh`:

- `AWS_REGION`
- `ECR_REPO` (example: `051551940370.dkr.ecr.eu-central-1.amazonaws.com/kambriq-api`)
- `ECS_CLUSTER`
- `ECS_SERVICE`
- `ECS_TASK_DEFINITION`
- `ECS_SUBNETS` (comma-separated subnet IDs)
- `ECS_SECURITY_GROUPS` (comma-separated security group IDs)

Optional:
- `CONTAINER_NAME` (default: `api`)
- `ASSIGN_PUBLIC_IP` (default: `DISABLED`)
- `SMOKE_TEST_URL` (example: `https://dev.kambriq.com/api/v1/health/ready`)

## Required tools

- `aws` (AWS CLI)
- `docker`
- `git`
- `jq`
- `npm`
- `curl` (only if `SMOKE_TEST_URL` is set)

## One-off migration command (ECS task override)

The script and CI/CD use this command:

```
node prisma/run-migrations.js
```

## Seed data (dev only)

Dev CI/CD runs `npm run db:seed` as a one-off ECS task after migrations.
It requires the following secrets on the task definition:
- `DATABASE_URL_CORE`
- `DATABASE_URL_KBS`
- `DATABASE_URL_KAMNET`
- `DATABASE_URL_LANDS`

Note: the core schema no longer includes `Permission` or `RolePermission` tables,
so they should not be expected during verification.

## Local dev deploy

Notes:
- The script tags and pushes both `vX.Y.Z` and `latest` images.
- If the smoke test URL fails, it falls back to the ALB DNS health check.

```
./scripts/deploy-dev.sh
```

## End-to-end sequence (infra → API)

Infra must be applied and GitHub env vars must be populated before this deploy.
See `kambriq-infra/docs/deployment-sequence.md` for the complete order.

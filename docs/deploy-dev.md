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

## One-off migration command (ECS task override)

The script and CI/CD use this command:

```
npx prisma migrate deploy --schema prisma/core/schema.prisma && \
npx prisma migrate deploy --schema prisma/kbs/schema.prisma
```

## Local dev deploy

```
./scripts/deploy-dev.sh
```

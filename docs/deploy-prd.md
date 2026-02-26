# Prd Deployment

This document describes the production deployment workflow for ECS Fargate.

## Required environment variables

Set these in the `prd` GitHub Environment:

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
- `SMOKE_TEST_URL` (example: `https://api.kambriq.com/api/v1/health/ready`)

## Image tagging

- Images are tagged with release tags `vX.Y.Z` and also pushed as `latest`.
- The workflow validates that the Git tag matches `package.json` version.

## Prd prerequisites

- Complete and validate dev deployments before promoting to prd.
- Ensure the prd ACM certificate ARN is configured in Terraform (ALB HTTPS listener).

## One-off migration command (ECS task override)

The workflow uses this command:

```
npx prisma migrate deploy --schema prisma/core/schema.prisma --config prisma/core/prisma.config.ts && \
npx prisma migrate deploy --schema prisma/kbs/schema.prisma --config prisma/kbs/prisma.config.ts
```

## Production deploy flow

- Trigger: push a `vX.Y.Z` Git tag.
- Steps: quality checks -> build/push image -> run migrations -> update ECS -> smoke test.
- If the vanity domain is unavailable, the smoke test falls back to the ALB DNS health check.

## End-to-end sequence (infra → API)

Infra must be applied and GitHub env vars must be populated before this deploy.
See `kambriq-infra/docs/deployment-sequence.md` for the complete order.

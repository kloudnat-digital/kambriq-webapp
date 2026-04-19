# Dev Deployment

> Full process documented in [ADR-004](./adr/ADR-004-cicd-github-actions-ecs.md).

## Quick reference

### Automated (normal flow)

Push to `develop` — the CI pipeline handles everything:

1. Quality checks (lint + typecheck + test)
2. Build API image → `kambriq-api:sha-{7char}` + `kambriq-api:dev-latest`
3. Build web image → `kambriq-web:sha-{7char}` + `kambriq-web:web-dev-latest`
4. Run Prisma migrations (one-off Fargate task, blocking)
5. Update API ECS service → wait for stability
6. Update web ECS service → wait for stability
7. Smoke test `https://dev.kambriq.com/api/v1/health/ready`

### Manual redeploy (no rebuild)

Go to **Actions → Deploy Dev → Run workflow**, then set:

- `api_image_tag`: existing ECR tag (e.g. `sha-abc1234` or `dev-latest`)
- `web_image_tag`: existing ECR tag (e.g. `sha-abc1234` or `web-dev-latest`)
- `run_seed`: `true` only on first deploy

### Rollback

Same as manual redeploy — supply the previous known-good SHA tags.

## Required GitHub Environment variables

Set in **Settings → Environments → dev**. See [ADR-004](./adr/ADR-004-cicd-github-actions-ecs.md#github-actions-environment-variables) for the full table.

Key variables: `AWS_REGION`, `ECR_REPO`, `ECR_WEB_REPO`, `ECS_CLUSTER`, `ECS_SERVICE`, `ECS_WEB_SERVICE`, `ECS_TASK_DEFINITION`, `ECS_WEB_TASK_DEFINITION`, `ECS_SUBNETS`, `ECS_SECURITY_GROUPS`, `SMOKE_TEST_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`.

Key secrets: `AWS_ROLE_ARN` (from Terraform output `github_actions_role_arn`).

## First deployment checklist

- [ ] Terraform applied for `envs/shared/` and `envs/dev/`
- [ ] GitHub environment `dev` created with all variables and secrets populated
- [ ] At least one image pushed to ECR (either via CI or manually)
- [ ] Trigger deploy with `run_seed: true` to populate initial data

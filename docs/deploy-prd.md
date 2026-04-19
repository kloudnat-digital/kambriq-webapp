# Production Deployment

> Full process documented in [ADR-004](./adr/ADR-004-cicd-github-actions-ecs.md).

## Quick reference

### Automated (normal flow)

Create a release via release-please, which pushes a `v*` tag to `main`.
The `deploy-prd.yml` workflow triggers automatically:

1. Validate Git tag matches `package.json` version
2. Build API image → `kambriq-api:v1.2.3` + `kambriq-api:latest` (GHA cache from develop, fast)
3. Run Prisma migrations (one-off Fargate task, blocking)
4. Update API ECS service → wait for stability
5. Smoke test

> **Note:** Web service production automation is not yet wired. Add the web deploy steps
> to `deploy-prd.yml` following the same pattern as `deploy-dev.yml` before launching production.

### Manual redeploy (no rebuild)

Go to **Actions → Deploy Prd → Run workflow**, then set:

- `image_tag`: existing ECR tag (e.g. `v1.2.3` or `sha-abc1234`)

Leave empty to rebuild from current commit.

### Rollback

Supply the previous version tag (e.g. `v1.1.0`) via `workflow_dispatch`.

## Required GitHub Environment variables

Set in **Settings → Environments → prd**. Same set of variables as `dev` but with production values.

Key secrets: `AWS_ROLE_ARN` (from `prd` Terraform output `github_actions_role_arn`).

## Production deployment checklist

- [ ] Terraform applied for `envs/prd/` (prd has never been deployed)
- [ ] GitHub environment `prd` created with all variables and secrets populated
- [ ] Smoke test passes on `dev` with the same commit
- [ ] No pending schema changes without corresponding migration files
- [ ] Web deploy steps added to `deploy-prd.yml` before public launch

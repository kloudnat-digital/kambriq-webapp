#!/usr/bin/env bash
#
# The dev deployment pipeline.
#
# THIS FILE IS THE PIPELINE. `.github/workflows/deploy-dev.yml` is intended to
# become a trigger that checks out, authenticates, and calls it.
#
# It is written this way round on purpose, and the file it replaces is the
# argument for doing so. The previous `scripts/deploy-dev.sh` was a second
# implementation of the workflow, written 2026-02-26 and never run since: it
# built `docker/Dockerfile`, which no longer exists; it ran `npm ci` in a pnpm
# repository; it tagged images `v0.0.0` while the pipeline moved to `sha-<short>`;
# and it had no notion of the web service, the bootstrap, the seed, the rollout
# poll, or the version gate. Nothing referenced it and nothing noticed. That is
# what a duplicated pipeline decays into, and it is the same defect as two role
# lists that must agree.
#
# `apps/api/src/__test__/conventions/deploy-script-covers-workflow.spec.ts` is
# what stops this copy going the same way: every step the workflows declare must
# carry a `# workflow-step:` marker here, and every marker here must name a real
# step. Add a step without implementing it and the test fails; delete an
# implementation and it fails; rename either side and it fails.
#
# Usage:
#   scripts/deploy-dev.sh              check, build, deploy, verify - in order
#   scripts/deploy-dev.sh check        the quality gate (ci.yml `quality` matrix)
#   scripts/deploy-dev.sh build        build and push both images to ECR
#   scripts/deploy-dev.sh deploy       task definitions, migrations, services, bootstrap
#   scripts/deploy-dev.sh verify       smoke test and both version gates
#
# Flags:
#   --allow-dirty      deploy with uncommitted changes (refused by default)
#   --allow-branch     deploy from a branch other than develop (refused by default)
#   --seed             run the database seed (ci.yml never passes this; see A9)
#   --with-suites      also run the post-deploy journeys and e2e suites
#   --sha <sha>        deploy a specific commit rather than HEAD
#
# Credentials: read from the environment or the AWS profile, exactly as the
# workflow reads them from OIDC. Nothing secret is stored in this file.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\n\033[31mFAILED: %s\033[0m\n' "$*" >&2; exit 1; }

# ------------------------------------------------------------------------------
# Configuration - read from the same place the workflow reads it
# ------------------------------------------------------------------------------
#
# The workflow gets these from `vars.*` in the `dev` GitHub environment. So does
# this script, through `gh`, rather than keeping a second copy that can disagree
# with the first - the whole point of the file. An environment variable already
# set wins, so a caller (or the workflow itself, where `vars.*` is already
# expanded into `env:`) supplies them directly and `gh` is never consulted.

GH_VARS_LOADED=false
load_gh_vars() {
  ${GH_VARS_LOADED} && return 0
  GH_VARS_LOADED=true
  command -v gh >/dev/null 2>&1 || return 0

  # Ask for the variables, rather than asking whether `gh` is happy.
  #
  # This used to probe `gh auth status` first. That command exits **1** when ANY
  # configured account has a stale token - including an inactive one nobody is
  # using - while the active account works and the call below succeeds. So the
  # probe refused a working setup, the script fell through to "AWS_REGION is not
  # set", and the message pointed at the wrong thing entirely.
  #
  # A readiness check that is not the operation is a guess about the operation.
  local name value out
  out="$(gh variable list --env dev 2>/dev/null || true)"
  [[ -n "${out}" ]] || return 0
  while IFS=$'\t' read -r name value _; do
    [[ -z "${name}" ]] && continue
    if [[ -z "${!name:-}" ]]; then export "${name}=${value}"; fi
  done <<< "${out}"
}

require_var() {
  local n="$1"
  [[ -n "${!n:-}" ]] || die "${n} is not set. It comes from the 'dev' GitHub environment; either export it or run 'gh auth login' so this script can read it."
}

config() {
  load_gh_vars
  local v
  for v in AWS_REGION ECR_REPO ECR_WEB_REPO ECS_CLUSTER ECS_SERVICE ECS_TASK_DEFINITION \
           ECS_SUBNETS ECS_SECURITY_GROUPS; do require_var "$v"; done

  # Defaults copied from deploy-dev.yml's `env:` block, with its fallbacks.
  : "${CONTAINER_NAME:=api}"
  : "${WEB_CONTAINER_NAME:=web}"
  : "${ASSIGN_PUBLIC_IP:=DISABLED}"
  : "${BOOTSTRAP_SSM_PREFIX:=/kambriq/dev/api/bootstrap}"
  : "${WEB_HEALTH_URL:=${NEXT_PUBLIC_APP_URL:-}}"
  export AWS_DEFAULT_REGION="${AWS_REGION}"
}

# ------------------------------------------------------------------------------
# Guards
# ------------------------------------------------------------------------------

ALLOW_DIRTY=false
ALLOW_BRANCH=false
RUN_SEED=false
WITH_SUITES=false
PIN_SHA=""

# The branch name, correct in both places this runs.
#
# `actions/checkout` leaves a DETACHED HEAD, where `git rev-parse --abbrev-ref
# HEAD` answers "HEAD" - so a naive guard refuses every run inside the very
# workflow that calls it, and the refusal reads as the guard working. GitHub
# puts the real name in GITHUB_REF_NAME; it wins where it exists.
current_branch() {
  if [[ -n "${GITHUB_REF_NAME:-}" ]]; then
    printf '%s' "${GITHUB_REF_NAME}"
  else
    git rev-parse --abbrev-ref HEAD
  fi
}

guard() {
  local branch; branch="$(current_branch)"
  if [[ "${branch}" != "develop" ]] && ! ${ALLOW_BRANCH}; then
    die "on branch '${branch}', not develop. Pass --allow-branch if that is deliberate."
  fi
  if [[ -n "$(git status --porcelain)" ]] && ! ${ALLOW_DIRTY}; then
    git status --short >&2
    die "the working tree is dirty. The image would match no commit. Pass --allow-dirty if that is deliberate."
  fi
}

resolve_sha() {
  GIT_SHA="${PIN_SHA:-$(git rev-parse HEAD)}"
  # Same convention as ci.yml, so /health/version stays traceable to a commit.
  IMAGE_TAG="sha-${GIT_SHA:0:7}"
  GIT_REF="$(current_branch)"
  BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  APP_VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo unknown)"
  API_IMAGE_URI="${ECR_REPO}:${IMAGE_TAG}"
  WEB_IMAGE_URI="${ECR_WEB_REPO}:${IMAGE_TAG}"
}

announce() {
  log "Shipping ${IMAGE_TAG}"
  info "commit    : ${GIT_SHA}"
  info "subject   : $(git log -1 --format=%s "${GIT_SHA}")"
  info "branch    : ${GIT_REF}"
  info "api image : ${API_IMAGE_URI}"
  info "web image : ${WEB_IMAGE_URI}"
  info "cluster   : ${ECS_CLUSTER} (${AWS_REGION})"
  info "identity  : $(aws sts get-caller-identity --query Arn --output text)"
}

# ------------------------------------------------------------------------------
# check - ci.yml `quality`
# ------------------------------------------------------------------------------

cmd_check() {
  log "Quality gate"
  # workflow-step: Install dependencies
  pnpm install --frozen-lockfile
  # workflow-step: Lint
  pnpm run lint
  # workflow-step: Typecheck
  pnpm run typecheck
  # workflow-step: Typecheck web
  pnpm run typecheck:web
  # workflow-step: Test with coverage
  NX_SKIP_NX_CACHE=true pnpm run test:cov
  # workflow-step: Upload coverage to Codecov
  # Not reproduced, deliberately. Codecov is a reporting sink rather than a gate
  # - the workflow itself sets `fail_ci_if_error: false` - and a developer
  # machine has no CODECOV_TOKEN. Uploading a local run as though it were a CI
  # measurement would corrupt the trend line it exists to draw. Named here
  # rather than dropped silently, which is what the anti-drift test is for.
  info "Codecov upload: skipped on purpose (reporting sink, not a gate)"
}

# ------------------------------------------------------------------------------
# build - ci.yml `build-api` and `build-web`
# ------------------------------------------------------------------------------

ecr_login() {
  # workflow-step: Login to ECR
  local registry="${ECR_REPO%%/*}"
  aws ecr get-login-password --region "${AWS_REGION}" \
    | docker login --username AWS --password-stdin "${registry}" >/dev/null
  info "logged in to ${registry}"
}

# The pushed manifest must be amd64.
#
# Fargate is amd64 and this machine may not be. A default build on arm64
# produces an image the task cannot start, and the failure surfaces only after
# the service has been told to use it - as a task that stops with an
# exec-format error, minutes later, looking like a runtime defect in the
# application. Asserted against the REGISTRY rather than against the build
# flags, because a flag being present in the command is not proof the manifest
# that arrived carries it.
assert_amd64() {
  local uri="$1" arch
  # `--verbose`, because the plain output cannot answer this.
  #
  # A single-platform push returns a v2 image manifest: no `.manifests` array,
  # and no top-level `.architecture` either - the platform lives in the config
  # blob the manifest points at, not in the manifest. Reading `.architecture`
  # there yields null for every correctly built image. `--verbose` returns the
  # descriptor with its resolved `platform`, for one entry or for a list.
  arch="$(docker manifest inspect --verbose "${uri}" 2>/dev/null \
    | jq -r '[ (if type == "array" then .[] else . end)
               | .Descriptor.platform
               | select(.os == "linux")
               | .architecture ] | unique | join(" ")')"
  info "${uri##*/} -> architecture: ${arch:-<unreadable>}"
  [[ "${arch}" == *"amd64"* ]] || die "${uri} is not linux/amd64 (got '${arch:-unreadable}'). Fargate cannot start it."
}

build_one() {
  local dockerfile="$1" uri="$2" floating="$3"; shift 3
  docker buildx build \
    --platform linux/amd64 \
    --file "${dockerfile}" \
    --tag "${uri}" \
    --tag "${floating}" \
    --build-arg "GIT_SHA=${GIT_SHA}" \
    --build-arg "GIT_REF=${GIT_REF}" \
    --build-arg "BUILD_TIME=${BUILD_TIME}" \
    --build-arg "IMAGE_TAG=${IMAGE_TAG}" \
    --build-arg "APP_VERSION=${APP_VERSION}" \
    "$@" \
    --push \
    .
}

cmd_build() {
  log "Build and push"
  # workflow-step: Resolve image tag and build metadata
  info "tag=${IMAGE_TAG} build_time=${BUILD_TIME} version=${APP_VERSION}"
  # workflow-step: Set up Docker Buildx
  docker buildx inspect --bootstrap >/dev/null 2>&1 || docker buildx create --use --name kambriq >/dev/null
  ecr_login

  # workflow-step: Build and push
  log "API image"
  build_one docker/Dockerfile.api "${API_IMAGE_URI}" "${ECR_REPO}:dev-latest"
  assert_amd64 "${API_IMAGE_URI}"

  log "Web image"
  # NEXT_PUBLIC_* are baked in at build time by Next, so they are build args
  # rather than runtime environment. Same values ci.yml passes.
  build_one docker/Dockerfile.web "${WEB_IMAGE_URI}" "${ECR_WEB_REPO}:web-dev-latest" \
    --build-arg "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-}" \
    --build-arg "NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-}"
  assert_amd64 "${WEB_IMAGE_URI}"
}

# ------------------------------------------------------------------------------
# deploy - deploy-dev.yml
# ------------------------------------------------------------------------------

register_task_def() {
  local family="$1" container="$2" image="$3" drop_healthcheck="$4" json new
  json="$(aws ecs describe-task-definition --task-definition "${family}")"
  new="$(echo "${json}" | jq --arg IMAGE "${image}" --arg NAME "${container}" --argjson DROPHC "${drop_healthcheck}" '
    .taskDefinition
    | .containerDefinitions |= map(
        if .name == $NAME
        then (.image = $IMAGE | if $DROPHC then del(.healthCheck) else . end)
        else . end)
    | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities,
          .registeredAt, .registeredBy, .deregisteredAt)
  ')"
  aws ecs register-task-definition --cli-input-json "${new}" \
    --query "taskDefinition.taskDefinitionArn" --output text
}

# Runs a one-off Fargate task on the new task definition. Reads the exit code of
# the TASK, not of the pipeline that printed it.
run_one_off() {
  local label="$1" overrides="$2" arn code
  arn="$(aws ecs run-task \
    --cluster "${ECS_CLUSTER}" \
    --launch-type FARGATE \
    --task-definition "${NEW_TASK_DEF_ARN}" \
    --network-configuration "awsvpcConfiguration={subnets=[${ECS_SUBNETS}],securityGroups=[${ECS_SECURITY_GROUPS}],assignPublicIp=${ASSIGN_PUBLIC_IP}}" \
    --overrides "${overrides}" \
    --query "tasks[0].taskArn" --output text)"
  [[ -n "${arn}" && "${arn}" != "None" ]] || die "failed to start ${label} task"
  info "${label} task ${arn##*/} - waiting"
  aws ecs wait tasks-stopped --cluster "${ECS_CLUSTER}" --tasks "${arn}"
  code="$(aws ecs describe-tasks --cluster "${ECS_CLUSTER}" --tasks "${arn}" \
    --query "tasks[0].containers[0].exitCode" --output text)"
  LAST_TASK_EXIT="${code}"
  info "${label} exit code: ${code}"
  [[ "${code}" == "0" ]] || die "${label} task failed with exit code ${code}"
}

dump_stopped_task() {
  local service="$1" stopped
  stopped="$(aws ecs list-tasks --cluster "${ECS_CLUSTER}" --service-name "${service}" \
    --desired-status STOPPED --query "taskArns[0]" --output text 2>/dev/null || true)"
  [[ -n "${stopped}" && "${stopped}" != "None" ]] || return 0
  echo "--- most recent stopped task ---" >&2
  aws ecs describe-tasks --cluster "${ECS_CLUSTER}" --tasks "${stopped}" \
    --query "tasks[0].{stopCode:stopCode,stoppedReason:stoppedReason,containers:containers[*].{name:name,exitCode:exitCode,reason:reason}}" \
    --output json >&2
}

wait_for_service() {
  local service="$1" timeout="$2" elapsed=0 svc rollout running desired
  info "waiting for ${service} to stabilise (max $((timeout / 60)) min)"
  while [[ ${elapsed} -lt ${timeout} ]]; do
    svc="$(aws ecs describe-services --cluster "${ECS_CLUSTER}" --services "${service}" --query "services[0]" --output json)"
    rollout="$(echo "${svc}" | jq -r '.deployments[] | select(.status=="PRIMARY") | .rolloutState')"
    running="$(echo "${svc}" | jq -r '.runningCount')"
    desired="$(echo "${svc}" | jq -r '.desiredCount')"
    info "[${elapsed}s] ${service}: running=${running}/${desired} rollout=${rollout}"
    if [[ "${rollout}" == "COMPLETED" ]]; then info "${service} stable"; return 0; fi
    if [[ "${rollout}" == "FAILED" ]]; then
      echo "${svc}" | jq -r '.events[:5][] | .message' >&2
      dump_stopped_task "${service}"
      die "${service} rollout FAILED"
    fi
    sleep 15; elapsed=$((elapsed + 15))
  done
  aws ecs describe-services --cluster "${ECS_CLUSTER}" --services "${service}" \
    --query "services[0].events[:8]" --output table >&2
  dump_stopped_task "${service}"
  die "timed out waiting for ${service} after ${timeout}s"
}

cmd_deploy() {
  log "Deploy"
  # workflow-step: Configure AWS credentials
  # From the environment or the profile. The workflow assumes a role through
  # OIDC and arrives at the same place: an identity the AWS CLI can use.
  info "identity: $(aws sts get-caller-identity --query Arn --output text)"

  # workflow-step: Set image URIs
  info "api=${API_IMAGE_URI}"
  info "web=${WEB_IMAGE_URI}"

  # workflow-step: Register API task definition
  NEW_TASK_DEF_ARN="$(register_task_def "${ECS_TASK_DEFINITION}" "${CONTAINER_NAME}" "${API_IMAGE_URI}" false)"
  info "api task definition: ${NEW_TASK_DEF_ARN##*/}"

  # workflow-step: Run Prisma migrations
  log "Prisma migrations"
  run_one_off "migration" "$(jq -nc --arg name "${CONTAINER_NAME}" '{
    containerOverrides: [{ name: $name, command: ["node", "prisma/run-migrations.js"] }] }')"
  MIGRATION_EXIT_CODE="${LAST_TASK_EXIT}"

  # workflow-step: Run database seed
  if ${RUN_SEED}; then
    log "Database seed"
    # Passed exactly as the workflow passes it, including the defect:
    # run-migrations.js never reads process.argv, so `--seed` is inert and this
    # runs the migrations again and seeds nothing. Reproduced rather than fixed,
    # because a fallback that quietly behaves better than the pipeline it stands
    # in for is a second implementation again. Open as the H2 follow-up.
    run_one_off "seed" "$(jq -nc --arg name "${CONTAINER_NAME}" '{
      containerOverrides: [{ name: $name, command: ["node", "prisma/run-migrations.js", "--seed"] }] }')"
  else
    info "seed: not requested (--seed to run it)"
  fi

  # workflow-step: Deploy API to ECS
  log "API service"
  aws ecs update-service --cluster "${ECS_CLUSTER}" --service "${ECS_SERVICE}" \
    --task-definition "${NEW_TASK_DEF_ARN}" >/dev/null
  wait_for_service "${ECS_SERVICE}" 720

  if [[ -n "${ECS_WEB_SERVICE:-}" && -n "${ECS_WEB_TASK_DEFINITION:-}" ]]; then
    # workflow-step: Register Web task definition
    # `del(.healthCheck)` mirrors the workflow: the web container's own health
    # check is dropped and the ALB target group is the authority.
    NEW_WEB_TASK_DEF_ARN="$(register_task_def "${ECS_WEB_TASK_DEFINITION}" "${WEB_CONTAINER_NAME}" "${WEB_IMAGE_URI}" true)"
    info "web task definition: ${NEW_WEB_TASK_DEF_ARN##*/}"

    # workflow-step: Deploy Web to ECS
    log "Web service"
    aws ecs update-service --cluster "${ECS_CLUSTER}" --service "${ECS_WEB_SERVICE}" \
      --task-definition "${NEW_WEB_TASK_DEF_ARN}" >/dev/null
    wait_for_service "${ECS_WEB_SERVICE}" 1200
  else
    info "web: ECS_WEB_SERVICE or ECS_WEB_TASK_DEFINITION unset, skipping (as the workflow does)"
  fi

  # workflow-step: Bootstrap super-admin accounts
  # LAST, and deliberately - the reasoning is in deploy-dev.yml. It still fails
  # the deploy when it fails; it no longer holds the application hostage.
  log "Bootstrap super-admin accounts"
  run_one_off "bootstrap" "$(jq -nc --arg name "${CONTAINER_NAME}" --arg prefix "${BOOTSTRAP_SSM_PREFIX}" '{
    containerOverrides: [{
      name: $name,
      command: ["npx", "tsx", "--tsconfig", "tsconfig.base.json", "prisma/bootstrap-admins.ts"],
      environment: [{ name: "BOOTSTRAP_SSM_PREFIX", value: $prefix }]
    }] }')"
}

# ------------------------------------------------------------------------------
# verify - the gates
# ------------------------------------------------------------------------------

# A rollout reporting COMPLETED means ECS started the new tasks. It does not
# mean the ALB is serving them. This asks the running service what image it is.
# The tag is baked into the image at build time, so an image cannot claim a tag
# it was not built as.
version_gate() {
  local label="$1" url="$2" expected="$3" jqpath="$4" elapsed=0 served body strict=true
  case "${expected}" in dev-latest|web-dev-latest|latest) strict=false ;; esac
  info "verifying ${url} - expecting imageTag=${expected} (strict=${strict})"
  while [[ ${elapsed} -lt 300 ]]; do
    body="$(curl -fsS --max-time 10 "${url}" 2>/dev/null || true)"
    served="$(printf '%s' "${body}" | jq -r "${jqpath}" 2>/dev/null || true)"
    info "[${elapsed}s] ${label} served imageTag=${served:-<unreachable>}"
    if { ! ${strict} && [[ -n "${served}" && "${served}" != "unknown" ]]; } || [[ "${served}" == "${expected}" ]]; then
      info "${label} is serving ${served}"
      return 0
    fi
    sleep 10; elapsed=$((elapsed + 10))
  done
  die "${label} version gate failed after 300s - expected ${expected}, served ${served:-<endpoint unreachable>}"
}

# The suites ci.yml runs after a deploy, as their own jobs.
#
# Off unless --with-suites. They are not what proves the deploy landed - the
# version gates above do that - and a Playwright browser install takes longer
# than the deployment it follows. Off by default is a decision about cost, not a
# quiet omission: both are named here, both are runnable, and the anti-drift
# test is what requires that distinction to be made in the open.
post_deploy_suites() {
  if ! ${WITH_SUITES}; then
    # workflow-step: Run the delivery journeys
    # workflow-step: Install Playwright browsers
    # workflow-step: Run E2E tests
    # workflow-step: Upload Playwright report
    info "post-deploy suites: not requested (--with-suites to run them)"
    return 0
  fi

  log "Delivery journeys"
  # EXPECTED_SHA is the gate. A live proof taken against the wrong build proves
  # nothing about the change it was meant to certify: a deploy was once gated on
  # an ECS revision counter, the counter advanced for an unrelated merge, and a
  # fix appeared to fail against a build that did not contain it.
  KAMBRIQ_API_URL="${KAMBRIQ_API_URL:-https://dev.kambriq.com/api/v1}" \
    EXPECTED_SHA="${GIT_SHA}" CI=true pnpm test:journeys

  log "E2E suite"
  npx playwright install --with-deps chromium firefox webkit
  BASE_URL="${NEXT_PUBLIC_APP_URL:-}" CI=true pnpm test:e2e
  # playwright.config.ts writes the report under dist/.playwright/. The workflow
  # uploads it as an artifact; locally it is already on disk, which is the same
  # thing without the round trip.
  info "playwright report: dist/.playwright/apps/web-e2e/playwright-report/"
}

cmd_verify() {
  log "Verify"

  # workflow-step: Smoke test
  if [[ -n "${SMOKE_TEST_URL:-}" ]]; then
    info "smoke: ${SMOKE_TEST_URL}"
    if ! curl -fsS --retry 5 --retry-delay 5 --retry-all-errors "${SMOKE_TEST_URL}" >/dev/null; then
      info "smoke test failed on the public URL - trying the ALB DNS fallback"
      local tg lb dns
      tg="$(aws ecs describe-services --cluster "${ECS_CLUSTER}" --services "${ECS_SERVICE}" \
        --query "services[0].loadBalancers[0].targetGroupArn" --output text)"
      lb="$(aws elbv2 describe-target-groups --target-group-arns "${tg}" \
        --query "TargetGroups[0].LoadBalancerArns[0]" --output text)"
      dns="$(aws elbv2 describe-load-balancers --load-balancer-arns "${lb}" \
        --query "LoadBalancers[0].DNSName" --output text)"
      curl -fsS --retry 5 --retry-delay 5 --retry-all-errors "http://${dns}/api/v1/health/ready" >/dev/null
    fi
    info "smoke test passed"
  fi

  # workflow-step: Verify API version
  # Not guarded by a condition, deliberately: an unprovable deploy must fail
  # rather than skip, because skipping is the silent pass this gate closes.
  if [[ -z "${VERSION_CHECK_URL:-}" && -z "${SMOKE_TEST_URL:-}" ]]; then
    die "neither VERSION_CHECK_URL nor SMOKE_TEST_URL is set, so the deployed version cannot be verified. Refusing to report success."
  fi
  version_gate "API" "${VERSION_CHECK_URL:-${SMOKE_TEST_URL%/health/*}/health/version}" \
    "${IMAGE_TAG}" '.data.imageTag // .imageTag // empty'

  # workflow-step: Verify Web version
  [[ -n "${WEB_HEALTH_URL:-}" ]] || die "neither WEB_HEALTH_URL nor NEXT_PUBLIC_APP_URL is set, so the deployed frontend cannot be verified. Refusing to report success."
  version_gate "Web" "${WEB_HEALTH_URL%/}/health" "${IMAGE_TAG}" '.imageTag // empty'

  post_deploy_suites

  # workflow-step: Deployment summary
  log "Deployment summary"
  printf '    %-22s %s\n' \
    "commit"              "${GIT_SHA}" \
    "image tag"           "${IMAGE_TAG}" \
    "API image"           "${API_IMAGE_URI}" \
    "API task definition" "${NEW_TASK_DEF_ARN:-n/a}" \
    "Web image"           "${WEB_IMAGE_URI}" \
    "Web task definition" "${NEW_WEB_TASK_DEF_ARN:-n/a}" \
    "migration exit code" "${MIGRATION_EXIT_CODE:-n/a}" \
    "smoke test"          "${SMOKE_TEST_URL:-n/a}"
}

# ------------------------------------------------------------------------------

main() {
  local cmd="" tool
  while [[ $# -gt 0 ]]; do
    case "$1" in
      check|build|deploy|verify) cmd="$1" ;;
      --allow-dirty)  ALLOW_DIRTY=true ;;
      --allow-branch) ALLOW_BRANCH=true ;;
      --seed)         RUN_SEED=true ;;
      --with-suites)  WITH_SUITES=true ;;
      --sha)          PIN_SHA="$2"; shift ;;
      -h|--help)      sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
      *)              die "unknown argument: $1" ;;
    esac
    shift
  done

  for tool in aws jq docker git; do
    command -v "${tool}" >/dev/null 2>&1 || die "${tool} is not installed"
  done

  config
  guard
  resolve_sha

  case "${cmd}" in
    check)  cmd_check ;;
    build)  announce; cmd_build ;;
    deploy) announce; cmd_deploy ;;
    verify) cmd_verify ;;
    "")     announce; cmd_check; cmd_build; cmd_deploy; cmd_verify ;;
  esac

  log "Done - ${IMAGE_TAG}"
}

main "$@"

#!/usr/bin/env bash
set -euo pipefail

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env var: ${name}" >&2
    exit 1
  fi
}

require_cmd() {
  local name="$1"
  if ! command -v "${name}" >/dev/null 2>&1; then
    echo "Missing required command: ${name}" >&2
    exit 1
  fi
}

require_cmd aws
require_cmd docker
require_cmd git
require_cmd jq
require_cmd npm

require_env AWS_REGION
require_env ECR_REPO
require_env ECS_CLUSTER
require_env ECS_SERVICE
require_env ECS_TASK_DEFINITION
require_env ECS_SUBNETS
require_env ECS_SECURITY_GROUPS

CONTAINER_NAME="${CONTAINER_NAME:-api}"
ASSIGN_PUBLIC_IP="${ASSIGN_PUBLIC_IP:-DISABLED}"
SMOKE_TEST_URL="${SMOKE_TEST_URL:-}"
IMAGE_TAG="v$(node -p "require('./package.json').version")"
IMAGE_URI="${ECR_REPO}:${IMAGE_TAG}"
LATEST_URI="${ECR_REPO}:latest"

echo "Installing dependencies"
npm ci

echo "Running quality checks"
npm run lint
npm run typecheck
npm run test

echo "Building image: ${IMAGE_URI}"
docker buildx build --platform linux/amd64 -f docker/Dockerfile -t "${IMAGE_URI}" --load .
docker tag "${IMAGE_URI}" "${LATEST_URI}"

echo "Logging in to ECR"
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${ECR_REPO%/*}"

echo "Pushing image"
docker push "${IMAGE_URI}"
docker push "${LATEST_URI}"

echo "Preparing new task definition with updated image"
TASK_DEF_JSON="$(aws ecs describe-task-definition --task-definition "${ECS_TASK_DEFINITION}")"
NEW_TASK_DEF="$(echo "${TASK_DEF_JSON}" | jq --arg IMAGE "${IMAGE_URI}" --arg NAME "${CONTAINER_NAME}" '
  .taskDefinition
  | .containerDefinitions |= map(if .name == $NAME then .image = $IMAGE else . end)
  | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)
')"

NEW_TASK_DEF_ARN="$(aws ecs register-task-definition --cli-input-json "${NEW_TASK_DEF}" \
  --query "taskDefinition.taskDefinitionArn" --output text)"

echo "Running Prisma migrations as one-off task"
TASK_ARN="$(aws ecs run-task \
  --cluster "${ECS_CLUSTER}" \
  --launch-type FARGATE \
  --task-definition "${NEW_TASK_DEF_ARN}" \
  --network-configuration "awsvpcConfiguration={subnets=[${ECS_SUBNETS}],securityGroups=[${ECS_SECURITY_GROUPS}],assignPublicIp=${ASSIGN_PUBLIC_IP}}" \
  --overrides "$(cat <<EOF
{
  "containerOverrides": [
    {
      "name": "${CONTAINER_NAME}",
      "command": [
        "sh",
        "-c",
        "node prisma/ensure-databases.js && npx prisma migrate deploy --schema prisma/core/schema.prisma --config prisma/core/prisma.config.ts && npx prisma migrate deploy --schema prisma/kbs/schema.prisma --config prisma/kbs/prisma.config.ts && npx prisma migrate deploy --schema prisma/kamnet/schema.prisma --config prisma/kamnet/prisma.config.ts && npx prisma migrate deploy --schema prisma/lands/schema.prisma --config prisma/lands/prisma.config.ts"
      ]
    }
  ]
}
EOF
)" \
  --query "tasks[0].taskArn" \
  --output text)"

if [[ -z "${TASK_ARN}" || "${TASK_ARN}" == "None" ]]; then
  echo "Failed to start migration task" >&2
  exit 1
fi

echo "Waiting for migration task to stop: ${TASK_ARN}"
aws ecs wait tasks-stopped --cluster "${ECS_CLUSTER}" --tasks "${TASK_ARN}"

EXIT_CODE="$(aws ecs describe-tasks --cluster "${ECS_CLUSTER}" --tasks "${TASK_ARN}" \
  --query "tasks[0].containers[0].exitCode" --output text)"

if [[ "${EXIT_CODE}" != "0" ]]; then
  echo "Migration task failed with exit code ${EXIT_CODE}" >&2
  exit 1
fi

echo "Updating ECS service to ${NEW_TASK_DEF_ARN}"
aws ecs update-service \
  --cluster "${ECS_CLUSTER}" \
  --service "${ECS_SERVICE}" \
  --task-definition "${NEW_TASK_DEF_ARN}"

echo "Waiting for service stability"
aws ecs wait services-stable --cluster "${ECS_CLUSTER}" --services "${ECS_SERVICE}"

if [[ -n "${SMOKE_TEST_URL}" ]]; then
  require_cmd curl
  TARGET_URL="${SMOKE_TEST_URL}"
  echo "Running smoke test: ${TARGET_URL}"
  if ! curl -fsS --retry 5 --retry-delay 5 --retry-all-errors "${TARGET_URL}"; then
    echo "Smoke test failed for ${TARGET_URL}, trying ALB DNS fallback."
    TG_ARN="$(aws ecs describe-services \
      --cluster "${ECS_CLUSTER}" \
      --services "${ECS_SERVICE}" \
      --query "services[0].loadBalancers[0].targetGroupArn" \
      --output text)"
    LB_ARN="$(aws elbv2 describe-target-groups \
      --target-group-arns "${TG_ARN}" \
      --query "TargetGroups[0].LoadBalancerArns[0]" \
      --output text)"
    LB_DNS="$(aws elbv2 describe-load-balancers \
      --load-balancer-arns "${LB_ARN}" \
      --query "LoadBalancers[0].DNSName" \
      --output text)"
    TARGET_URL="http://${LB_DNS}/api/v1/health/ready"
    curl -fsS --retry 5 --retry-delay 5 --retry-all-errors "${TARGET_URL}"
  fi
fi

echo "Dev deploy complete."

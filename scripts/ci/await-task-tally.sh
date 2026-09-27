#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# H2 follow-up 2 - a one-off task that exits 0 has declared success, not
# achieved it (the family of A9 and A54). After the exit code, read the task's
# own log stream and require the line it prints only when its work is done.
#
# Usage: await-task-tally.sh <task-definition-arn> <container> <task-arn> <line> [timeout-seconds]
#
# The log group and the stream prefix are read from the task definition, not
# assumed: the stream is <awslogs-stream-prefix>/<container>/<task id>.
# Prints the line when found; exits 1, saying so, when it never appears.
# -----------------------------------------------------------------------------
set -euo pipefail

TASK_DEF="$1"; CONTAINER="$2"; TASK_ARN="$3"; LINE="$4"; TIMEOUT="${5:-60}"

OPTIONS="$(aws ecs describe-task-definition --task-definition "${TASK_DEF}" \
  --query "taskDefinition.containerDefinitions[?name=='${CONTAINER}'] | [0].logConfiguration.options" \
  --output json)"
GROUP="$(jq -r '."awslogs-group" // empty' <<<"${OPTIONS}")"
PREFIX="$(jq -r '."awslogs-stream-prefix" // empty' <<<"${OPTIONS}")"
if [[ -z "${GROUP}" || -z "${PREFIX}" ]]; then
  echo "Cannot tell where container ${CONTAINER} logs: no awslogs group or stream prefix in ${TASK_DEF}" >&2
  exit 1
fi
STREAM="${PREFIX}/${CONTAINER}/${TASK_ARN##*/}"

# The awslogs driver ships a stopped task's last lines within seconds; wait a
# bounded while for them rather than reading once and calling absence a failure.
deadline=$(( $(date +%s) + TIMEOUT ))
while :; do
  found="$(aws logs filter-log-events --log-group-name "${GROUP}" --log-stream-names "${STREAM}" \
    --filter-pattern "\"${LINE}\"" --query 'events[0].message' --output text 2>/dev/null || true)"
  if [[ -n "${found}" && "${found}" != "None" ]]; then
    echo "${found}"
    exit 0
  fi
  if (( $(date +%s) >= deadline )); then
    echo "The task exited 0 but never printed '${LINE}' (${GROUP} ${STREAM}). A zero exit is a claim, not a result." >&2
    exit 1
  fi
  sleep "${POLL_SECONDS:-5}"
done

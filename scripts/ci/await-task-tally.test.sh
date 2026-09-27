#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# H2 follow-up 2 - await-task-tally.sh against a fake `aws`.
#
# The fake answers `ecs describe-task-definition` with a log configuration and
# `logs filter-log-events` from a fixture file, and records the stream it was
# asked for. Cases: the line is there; it never comes (the defect: exit 0, no
# work); the task definition names no log group; and the stream is built from
# the task definition's prefix, not assumed.
#
# Usage: bash scripts/ci/await-task-tally.test.sh [script]
# -----------------------------------------------------------------------------
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${1:-${here}/await-task-tally.sh}"
command -v jq >/dev/null || { echo "await-task-tally.test.sh needs jq" >&2; exit 2; }

work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
mkdir -p "${work}/bin"
cat >"${work}/bin/aws" <<'STUB'
#!/usr/bin/env bash
set -uo pipefail
case "$1 $2" in
  "ecs describe-task-definition") cat "${FIXTURES}/options.json" ;;
  "logs filter-log-events")
    while [ $# -gt 0 ]; do
      case "$1" in --log-stream-names) echo "$2" >>"${FIXTURES}/streams"; shift 2 ;; *) shift ;; esac
    done
    cat "${FIXTURES}/message" 2>/dev/null || echo None ;;
  *) echo "fake aws: $1 $2 not faked" >&2; exit 2 ;;
esac
STUB
chmod +x "${work}/bin/aws"

fail=0
check() { # name expected-status expected-words
  local name="$1" want="$2" words="$3" out status
  out="$(PATH="${work}/bin:${PATH}" FIXTURES="${work}/fx" POLL_SECONDS=0 \
    bash "${SCRIPT}" arn:td api arn:aws:ecs:eu-central-1:1:task/c/abc123 "bootstrap complete" 0 2>&1)"
  status=$?
  if [[ "${status}" != "${want}" || "${out}" != *"${words}"* ]]; then
    echo "FAIL ${name}: status ${status} (want ${want}), output: ${out}"; fail=1
  else
    echo "ok   ${name}"
  fi
}
fixture() { rm -rf "${work}/fx"; mkdir -p "${work}/fx"; echo "$1" >"${work}/fx/options.json"; }

fixture '{"awslogs-group":"/ecs/kambriq-dev-api","awslogs-stream-prefix":"api"}'
echo "Kambriq super-admin bootstrap complete: 0 created, 0 updated, 2 unchanged" >"${work}/fx/message"
check "the tally is there" 0 "2 unchanged"
if [[ "$(cat "${work}/fx/streams")" != "api/api/abc123" ]]; then
  echo "FAIL the stream: asked for $(cat "${work}/fx/streams"), want api/api/abc123"; fail=1
else
  echo "ok   the stream is <prefix>/<container>/<task id>"
fi

fixture '{"awslogs-group":"/ecs/kambriq-dev-api","awslogs-stream-prefix":"api"}'
check "exit 0 and no tally is a failure" 1 "never printed 'bootstrap complete'"

fixture '{}'
check "no log configuration is a failure, not a pass" 1 "Cannot tell where container api logs"

exit "${fail}"

#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# A32 - the develop gate, proven against a stubbed GitHub API.
#
# Each case writes down what GitHub would answer, runs the gate with a fake
# `gh` first on PATH, and checks the exit status and the words. The fake
# applies the query filters the way the server does - `head_sha` and `status`
# select runs, everything else keeps the order the fixture lists - so a gate
# that asks the wrong question gets the wrong answer, as it did in production.
#
# THE DEFECT that shipped is the second case: develop's completed runs, newest
# first, begin with a stale green build while the head is still being verified.
# The first version of the gate passed it. Run this file against that version
# to see it: bash scripts/ci/develop-gate.test.sh <old-gate.sh>
#
# Usage: bash scripts/ci/develop-gate.test.sh [gate-script]
# -----------------------------------------------------------------------------
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATE="${1:-${here}/develop-gate.sh}"
command -v jq >/dev/null || { echo "develop-gate.test.sh needs jq for its fake gh" >&2; exit 2; }

work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
mkdir -p "${work}/bin"

cat >"${work}/bin/gh" <<'STUB'
#!/usr/bin/env bash
# A fake `gh api PATH [--jq EXPR]`, answering from the files in $FIXTURES.
set -uo pipefail
[ "${1:-}" = "api" ] || { echo "fake gh: only 'gh api' is faked" >&2; exit 2; }
path="$2"; shift 2
expr="."
while [ $# -gt 0 ]; do
  case "$1" in --jq) expr="$2"; shift 2 ;; *) shift ;; esac
done
echo "${path}" >>"${FIXTURES}/calls"

answer() { # fixture-file [server-side filter]
  local file="${FIXTURES}/$1"
  if [ -f "${file}.fail" ]; then cat "${file}.fail" >&2; exit 1; fi
  if [ ! -f "${file}" ]; then echo "gh: Not Found (HTTP 404)" >&2; exit 1; fi
  jq -r "${2:-.} | ${expr}" "${file}"
}
query=""
case "${path}" in *\?*) query="${path#*\?}" ;; esac
param() { tr '&' '\n' <<<"${query}" | sed -n "s/^$1=//p" | head -n 1; }

case "${path%%\?*}" in
  */pulls/*) answer pull.json ;;
  */commits/develop) answer head.json ;;
  */actions/workflows/*/runs)
    sha="$(param head_sha)"; status="$(param status)"
    answer runs.json ".workflow_runs |= map(select((\"${sha}\" == \"\" or .head_sha == \"${sha}\") and (\"${status}\" == \"\" or .status == \"${status}\")))" ;;
  */actions/runs/*/jobs)
    id="${path#*/actions/runs/}"; answer "jobs-${id%%/*}.json" ;;
  */check-runs/*/annotations)
    id="${path#*/check-runs/}"; answer "annotations-${id%%/*}.json" ;;
  *) echo "fake gh: no route for ${path}" >&2; exit 2 ;;
esac
STUB
chmod +x "${work}/bin/gh"

sha() { printf '%s%0*d' "$1" $((40 - ${#1})) 0; }
HEAD_SHA="$(sha 1145add)"
STALE_SHA="$(sha 3734818)"

FIXTURES=""
RUNS=()
new_case() {
  FIXTURES="${work}/case-$1"
  mkdir -p "${FIXTURES}"
  echo '{"labels":[]}' >"${FIXTURES}/pull.json"
  printf '{"sha":"%s"}\n' "${HEAD_SHA}" >"${FIXTURES}/head.json"
  RUNS=()
  echo '{"workflow_runs":[]}' >"${FIXTURES}/runs.json"
}
label() { printf '{"labels":[{"name":"%s"}]}\n' "$1" >"${FIXTURES}/pull.json"; }
add_run() { # id sha status - in the order GitHub lists them, newest first
  RUNS+=("{\"id\":$1,\"head_sha\":\"$2\",\"status\":\"$3\",\"html_url\":\"https://github.test/runs/$1\"}")
  local IFS=,
  echo "{\"workflow_runs\":[${RUNS[*]}]}" >"${FIXTURES}/runs.json"
}
journeys() { # run-id conclusion steps-that-ran
  local steps='{"conclusion":null}' i
  for ((i = 0; i < $3; i++)); do
    [ "${i}" -eq 0 ] && steps=""
    steps+="${steps:+,}{\"conclusion\":\"success\"}"
  done
  local c="\"$2\""
  [ "$2" = "null" ] && c=null
  echo "{\"jobs\":[{\"id\":9$1,\"name\":\"Delivery journeys (dev)\",\"conclusion\":${c},\"steps\":[${steps}]}]}" \
    >"${FIXTURES}/jobs-$1.json"
}

passed=0
failed=0
expect() { # description exit-status words...
  local what="$1" want="$2" out code w ok=1
  shift 2
  out="$(PATH="${work}/bin:${PATH}" FIXTURES="${FIXTURES}" REPO=o/r PR_NUMBER=7 \
    OVERRIDE_LABEL=merge-on-red-develop JOURNEYS_JOB='Delivery journeys (dev)' bash "${GATE}" 2>&1)"
  code=$?
  [ "${code}" = "${want}" ] || ok=0
  for w in "$@"; do grep -qF -- "${w}" <<<"${out}" || ok=0; done
  if [ "${ok}" = 1 ]; then
    passed=$((passed + 1))
    echo "  ok    ${what}"
  else
    failed=$((failed + 1))
    echo "  FAIL  ${what} - exit ${code}, wanted ${want} and: $*"
    printf '        | %s\n' "${out//$'\n'/$'\n'        | }"
  fi
}

echo "develop gate under test: ${GATE}"

new_case green
add_run 200 "${HEAD_SHA}" completed
journeys 200 success 9
expect "head verified green: pass" 0 "is green on the delivery journeys"
if grep -qF "runs?head_sha=${HEAD_SHA}&" "${FIXTURES}/calls"; then
  passed=$((passed + 1))
  echo "  ok    the runs are asked for by develop's head sha"
else
  failed=$((failed + 1))
  echo "  FAIL  the runs were not asked for by develop's head sha. Calls made:"
  while read -r call; do echo "        | ${call}"; done <"${FIXTURES}/calls"
fi

new_case stale-list
add_run 200 "${HEAD_SHA}" in_progress
add_run 100 "${STALE_SHA}" completed
journeys 100 success 9
expect "THE DEFECT - a stale green run in the list, the head still building: refuse" 1 \
  "UNKNOWN" "still being built" "blocks merges for the ~20 minutes"

new_case no-run
add_run 100 "${STALE_SHA}" completed
journeys 100 success 9
expect "no run yet for the head, an older green one exists: refuse" 1 "UNKNOWN" "has no CI run"

new_case red
add_run 200 "${HEAD_SHA}" completed
journeys 200 failure 4
expect "head red: refuse" 1 "develop is red on the delivery journeys"

new_case unstarted
add_run 200 "${HEAD_SHA}" completed
journeys 200 failure 0
echo '[{"message":"The job was not started because recent account payments have failed."}]' \
  >"${FIXTURES}/annotations-9200.json"
expect "head's journeys never started: refuse as UNVERIFIED, quoting GitHub" 1 \
  "never started, so no test ran" "GitHub said: The job was not started" "Look at Actions billing"

new_case skipped
add_run 200 "${HEAD_SHA}" completed
journeys 200 skipped 0
expect "head's journeys skipped (deploy failed): refuse" 1 "UNKNOWN" "= skipped, which is no verdict"

new_case unreadable
echo "gh: Server Error (HTTP 502)" >"${FIXTURES}/head.json.fail"
expect "develop's head unreadable: refuse" 1 "UNKNOWN" "could not be read" "HTTP 502"

new_case runs-unreadable
echo "gh: Server Error (HTTP 502)" >"${FIXTURES}/runs.json.fail"
expect "develop's runs unreadable: refuse" 1 "UNKNOWN" "could not be listed"

new_case label-red
label merge-on-red-develop
add_run 200 "${HEAD_SHA}" completed
journeys 200 failure 4
expect "the label releases a red head" 0 "::warning::" "RED" "Proceeding by a person's decision"

new_case label-building
label merge-on-red-develop
add_run 200 "${HEAD_SHA}" in_progress
expect "the label releases a head still being verified" 0 "::warning::" "still being built"

new_case label-unstarted
label merge-on-red-develop
add_run 200 "${HEAD_SHA}" completed
journeys 200 failure 0
expect "the label releases a head whose journeys never started" 0 "::warning::" "never started"

echo "develop gate: ${passed} passed, ${failed} failed"
[ "${failed}" -eq 0 ]

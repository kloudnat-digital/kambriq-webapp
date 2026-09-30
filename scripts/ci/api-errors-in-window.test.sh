#!/usr/bin/env bash
# Proves api-errors-in-window.sh against a stubbed aws: it must fail on a P2028,
# fail on a 5xx, pass on a clean window, and fail closed when the log cannot be
# read or answers in a shape it does not know.
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${1:-${here}/api-errors-in-window.sh}"
command -v jq >/dev/null || { echo "api-errors-in-window.test.sh needs jq" >&2; exit 2; }

work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
mkdir -p "${work}/bin"
cat >"${work}/bin/aws" <<'STUB'
#!/usr/bin/env bash
[ -f "${FIXTURES}/fail" ] && { echo "AccessDeniedException: not authorized to perform logs:FilterLogEvents" >&2; exit 254; }
cat "${FIXTURES}/answer"
STUB
chmod +x "${work}/bin/aws"

fail=0
check() { # name expected-exit answer-json [fail]
  local name="$1" want="$2" answer="$3" f="${4:-}"
  rm -f "${work}/fail"; printf '%s' "${answer}" >"${work}/answer"; [ -n "${f}" ] && touch "${work}/fail"
  FIXTURES="${work}" PATH="${work}/bin:${PATH}" bash "${SCRIPT}" /ecs/test 1000 61000 >"${work}/out" 2>&1
  local got=$?
  if [ "${got}" = "${want}" ]; then echo "  ok    ${name}"; else echo "  FAIL  ${name}: exit ${got}, wanted ${want}"; cat "${work}/out"; fail=1; fi
}

p2028='{"events":[{"timestamp":1790000000000,"message":"{\"level\":40,\"code\":\"P2028\",\"path\":\"/api/v1/lands/client/purchases\",\"status\":500,\"msg\":\"Prisma Error\"}"}]}'
five='{"events":[{"timestamp":1790000000000,"message":"{\"level\":30,\"res\":{\"statusCode\":502},\"msg\":\"request errored\"}"}]}'
check "a P2028 in the window fails"          1 "${p2028}"
check "a 5xx in the window fails"            1 "${five}"
check "a clean window passes"                0 '{"events":[]}'
check "an unreadable log fails closed"       2 '{"events":[]}' fail
check "an unknown answer shape fails closed" 2 '{"nothing":true}'

[ "${fail}" = 0 ] && echo "api-errors-in-window: 5 passed, 0 failed" || { echo "api-errors-in-window: FAILED"; exit 1; }

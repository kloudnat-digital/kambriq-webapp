#!/usr/bin/env bash
# api-errors-in-window.sh <log-group> <start-epoch-ms> <end-epoch-ms>
#
# A72 - counts the API log lines, inside a time window, that carry Prisma's P2028
# (no connection within the transaction wait) or a response status of 500 or
# more, and lists each one. The browser's data layer retries a failed query once,
# so a transient 500 is invisible to the page and to the browser tests; the API
# log is the only place it is recorded, and this is what reads it for a run.
#
# Exit 0: none in the window. Exit 1: at least one, listed.
# Exit 2: the log could not be read. It fails closed on purpose: a step that finds
# nothing because it could not look must not read as a window with no errors.
#
# It counts every such line in the window, not only the run's own requests.
set -uo pipefail

group="${1:?log group}"
start="${2:?start, epoch milliseconds}"
end="${3:?end, epoch milliseconds}"
pattern='{ ($.code = "P2028") || ($.res.statusCode >= 500) }'

if ! out="$(aws logs filter-log-events --log-group-name "${group}" \
  --start-time "${start}" --end-time "${end}" \
  --filter-pattern "${pattern}" --output json 2>&1)"; then
  echo "REFUSED: the API log could not be read, so nothing is known about this window:" >&2
  echo "  ${out}" >&2
  exit 2
fi

if ! count="$(printf '%s' "${out}" | jq -e '.events | if type == "array" then length else error("no events array") end' 2>/dev/null)"; then
  echo "REFUSED: the answer from the API log was not the expected shape - nothing is known." >&2
  exit 2
fi

echo "API log ${group}, $(( (end - start) / 1000 )) s window: ${count} line(s) with P2028 or a 5xx."
if [ "${count}" -gt 0 ]; then
  printf '%s' "${out}" | jq -r '.events[] | (.message | fromjson? // {}) as $m |
    "  \(.timestamp / 1000 | floor | todate)  \($m.code // "-")  \($m.res.statusCode // $m.status // "-")  \($m.path // $m.req.url // "-")  \($m.msg // "")"'
  exit 1
fi
exit 0

#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# A32 - a pull request merges only onto a develop whose HEAD was verified.
#
# Run by the CI Gate job in .github/workflows/ci.yml, proven by
# develop-gate.test.sh next to it. Reads through the API; writes nothing.
#
# THE VERDICT is the delivery journeys of the CI run on develop's head commit,
# asked for BY SHA:
#
#   GET /repos/{repo}/commits/develop                               -> head sha
#   GET /repos/{repo}/actions/workflows/ci.yml/runs?head_sha={sha}&event=push
#
#   journeys success                        -> pass
#   journeys failure, a step ran            -> refuse: develop is RED
#   journeys failure, no step ran           -> refuse: UNVERIFIED, never started
#   no run, run not completed, no verdict,
#   or any call that fails                  -> refuse: UNKNOWN
#
# THE OVERRIDE is the label `merge-on-red-develop`, applied by a person, then
# this job re-run. It releases every refusal. Labels are read live through the
# API, not from the event: a re-run replays the original event, whose label
# list predates the label.
#
# WHY BY SHA. The first version listed develop's completed push runs and took
# the newest one with a journeys verdict. On 15 September #134's gate read that
# list, got back a run of 3734818 from the night before - older than six merges
# - and passed. A list is what GitHub had indexed when asked, not what develop
# is. A question about the head commit by name cannot be answered with another
# commit's verdict: the only wrong answer left is "no run", and that refuses.
#
# NEVER STARTED IS NOT RED. A job GitHub refuses to start (billing, no runner)
# also reports `failure`, with no step carrying an outcome. Counted, reported as
# NEVER STARTED with GitHub's annotation, and still refused - an unrun develop
# is not a green one - but the message points at Actions, not at the code.
#
# THE COST, stated rather than discovered: every push to develop blocks merges
# until its run has built, deployed and run the journeys - 14 to 19 minutes on
# the seven runs of 15 September, ~20 to plan on. A documentation push is no
# exception: on develop every job runs, so the deployed sha keeps matching.
#
# WHAT IT DOES NOT CATCH: the merge that breaks the journeys. They need a
# deployed build, so that merge is only seen after deploy. This stops merges
# stacking on an unverified build; it does not prevent the red.
# -----------------------------------------------------------------------------
set -uo pipefail

: "${REPO:?REPO is required, owner/name}"
: "${PR_NUMBER:?PR_NUMBER is required}"
OVERRIDE_LABEL="${OVERRIDE_LABEL:-merge-on-red-develop}"
JOURNEYS_JOB="${JOURNEYS_JOB:-Delivery journeys (dev)}"
WORKFLOW_FILE="${WORKFLOW_FILE:-ci.yml}"

COST="Every push to develop blocks merges for the ~20 minutes its run takes to build, deploy and run the journeys."
echo "A32 reads the delivery journeys of develop's HEAD. ${COST}"

override=0
if labels="$(gh api "repos/${REPO}/pulls/${PR_NUMBER}" --jq '[.labels[].name] | join(",")' 2>&1)"; then
  case ",${labels}," in
    *",${OVERRIDE_LABEL},"*) override=1 ;;
  esac
else
  echo "  could not read this pull request's labels: ${labels}"
fi

verdict="unknown" # success | failure | unstarted | unknown
why=""            # for unknown: what is missing, in words
short="?"
run_url=""
detail=""

if ! head_sha="$(gh api "repos/${REPO}/commits/develop" --jq '.sha' 2>&1)" ||
  ! [[ "${head_sha}" =~ ^[0-9a-f]{40}$ ]]; then
  why="develop's head could not be read: ${head_sha}"
else
  short="${head_sha:0:7}"
  echo "  develop's head is ${short}"
  if ! runs="$(gh api "repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?head_sha=${head_sha}&event=push&per_page=10" \
    --jq '.workflow_runs[] | "\(.id) \(.status) \(.html_url)"' 2>&1)"; then
    why="the runs of develop's head ${short} could not be listed: ${runs}"
  elif [ -z "${runs}" ]; then
    why="develop's head ${short} has no CI run - pushed moments ago, or its run was never created"
  else
    # One push makes one run; a re-run is a new attempt of that same run.
    read -r id status url <<<"$(head -n 1 <<<"${runs}")"
    run_url="${url}"
    if [ "${status}" != "completed" ]; then
      why="develop's head ${short} is still being built, deployed and verified (run ${status})"
    elif ! job="$(gh api "repos/${REPO}/actions/runs/${id}/jobs?filter=latest&per_page=100" \
      --jq ".jobs[] | select(.name == \"${JOURNEYS_JOB}\") | \"\(.conclusion // \"none\") \([.steps[]? | select(.conclusion != null)] | length) \(.id)\"" 2>&1)"; then
      why="the jobs of develop's run ${id} could not be read: ${job}"
    else
      read -r conclusion steps_run job_id <<<"${job}"
      case "${conclusion}" in
        success)
          verdict="success" ;;
        failure)
          if [ "${steps_run:-0}" -gt 0 ]; then
            verdict="failure"
            echo "  develop ${short}: ${JOURNEYS_JOB} = failure, ${steps_run} step(s) ran"
          else
            verdict="unstarted"
            detail="$(gh api "repos/${REPO}/check-runs/${job_id}/annotations" --jq '.[0].message // empty' 2>/dev/null || true)"
            echo "  develop ${short}: ${JOURNEYS_JOB} NEVER STARTED - no step has an outcome"
          fi ;;
        *)
          why="develop's head ${short}: ${JOURNEYS_JOB} = ${conclusion:-absent}, which is no verdict on this build" ;;
      esac
    fi
  fi
fi

# The label releases every refusal, and says so where it is seen.
release_if_labelled() {
  if [ "${override}" = "1" ]; then
    echo "::warning::$1 This pull request carries '${OVERRIDE_LABEL}'. Proceeding by a person's decision."
    exit 0
  fi
}

case "${verdict}" in
  success)
    echo "Develop's head ${short} is green on the delivery journeys (${run_url})."
    exit 0 ;;
  failure)
    release_if_labelled "Develop's head ${short} is RED on the delivery journeys (${run_url})."
    echo "  REFUSED  develop is red on the delivery journeys: ${run_url}" >&2
    echo "           Merging now stacks this change on a build nobody has verified." >&2
    echo "           If this pull request is the repair, add the label '${OVERRIDE_LABEL}' and re-run this job." >&2
    exit 1 ;;
  unstarted)
    release_if_labelled "Develop is UNVERIFIED - its delivery journeys never started (${run_url})."
    echo "  REFUSED  develop is UNVERIFIED, not red: its delivery journeys job never started, so no test ran: ${run_url}" >&2
    if [ -n "${detail}" ]; then echo "           GitHub said: ${detail}" >&2; fi
    echo "           Look at Actions billing and runners, not at the code. Re-run the journeys once jobs start, or add '${OVERRIDE_LABEL}' and re-run this job." >&2
    exit 1 ;;
  *)
    release_if_labelled "Develop's state is UNKNOWN: ${why}."
    echo "  REFUSED  develop's state is UNKNOWN: ${why}${run_url:+ (${run_url})}" >&2
    echo "           An unverified develop is not a green one." >&2
    echo "           ${COST}" >&2
    echo "           Re-run this job once that run has finished; or, if a person has checked develop, add '${OVERRIDE_LABEL}' and re-run it." >&2
    exit 1 ;;
esac

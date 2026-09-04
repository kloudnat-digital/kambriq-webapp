# kambriq-webapp — Agent guide

Deliberately narrow: the chantier register and the rules that keep it honest.
Not an architecture guide; do not infer conventions from its silence.

**This file is the master.** The KAMBRIQ project copy is the archive. On
disagreement, this file wins.

---

## Rules

1. **The closing PR updates this register in the same commit**, moving the entry
   to `PROUVE` with its proof quoted. Not a follow-up commit. A chantier closed
   in code and open here teaches people to distrust the register.
2. **Every chantier states its cost impact, and every added resource carries its
   own.** `None` is a valid answer and must be written down. A resource with no
   stated cost is not finished.
3. **Work the order.** Do not reorder for convenience.

### States

| State             | Meaning                                                               |
| ----------------- | --------------------------------------------------------------------- |
| `A DECIDER`       | Arbitration missing. **Stop and report.** Do not choose.              |
| `DECIDE, A FAIRE` | The arbitration is in the entry. **Execute it without asking again.** |
| `EN COURS`        | Started, not proven                                                   |
| `PROUVE`          | Closed, proof quoted                                                  |

### Order

`S1` → `V1` → `B3` → `C2` → `C1` → `T1` → `N1`. `C2` and `C1` are already
`PROUVE`. `L2` runs alongside; it is a prerequisite for trusting any other
proof, since it is why proofs went unseen.

---

## Open

### S1 — Storage: S3 dead behind a credential gate — `DECIDE, A FAIRE`

`storage.service.ts` gates `S3Client` on `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`,
never set on Fargate. All uploads and downloads are dead on dev.

**Decision — option 1.** An explicit `STORAGE_TRANSPORT`. Outside it, a missing
bucket or region fails at startup, and `getUploadUrl` / `getDownloadUrl` /
`deleteObject` throw instead of returning success-shaped values. Drop
`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from `env.validation.ts` once
nothing reads them.

**Reasoning, so nobody relitigates it:** two patterns for one problem is twice as
much to remember; and `getUploadUrl` returning HTTP 200 with an unsigned URL
against a bucket whose four public-access blocks are all `true` is the most
expensive of the three lies — the API says yes and the browser fails alone.

**Proof:** a file genuinely uploaded through a presigned URL, present in the
bucket; a download URL returning 200; plus the mutation check.
**Cost: none.** The IAM grants already exist (`iam-media.tf`).

### V1 — Commissions and job names — `DECIDE, A FAIRE`, promoted above every garde-fou

`kamnet.processor.ts:44` — a completed sale whose user lookup fails logs an
error, returns `null`, and BullMQ marks the job **completed**. A commission is
silently not created. Both processors also return `null` on an unknown job name,
so a renamed constant drops work while reporting success.

**Decision:** an unrecoverable failure must fail the job; an unknown job name
must throw.
**Reasoning:** no amount of manual testing would ever reveal this, and it is money.
**Proof:** by mutation, on both. **Cost: none.**

### L2 — Logging drops metadata at 106 call sites — `DECIDE, A FAIRE`

`nestjs-pino`'s `Logger.call` takes the **last** optional param as context and
passes the rest as pino format arguments. Nest's `Logger` appends the class name
last, so the metadata object lands in pino's interpolation slot and is discarded
when the message carries no placeholder. Proven:

```
logger.info({context}, 'Email sent',    {messageId})  ->  "msg":"Email sent"
logger.info({context}, 'Email sent %o', {messageId})  ->  "msg":"Email sent {\"messageId\":\"abc-123\"}"
```

94 calls in `apps/api/src`, 9 in `libs/common`, 3 in `apps/web`. Worst two:
`global-exception.filter.ts:40` discards **every unhandled exception's message
and stack**; `grading-processor.ts:92` discards the error when marking an exam
FAILED.

**Decision:** fix the pattern, not the line. **Proof:** a log line carrying its
metadata, and a re-probe. **Cost: none.**

### B3 — Seed: KBS not demonstrable — `DECIDE, A FAIRE`

Seed ran once, 2026-02-26. `KbsQuestion` and `KbsExam` are empty, so the largest
module (21 routes) cannot be exercised. `LandMedia` / `LandDocument` are empty too.

**Decision:** extend `prisma/seed.ts` to cover `KbsQuestion` and `KbsExam`. Leave
`LandMedia` and `LandDocument` alone — they need real files, which S1 unblocks.
**Show the diff and what it would write before running anything against dev.**
**Proof:** a tester logging in can take a quiz and an exam. **Cost: none.**

### T1 — Guards and roles untested — `DECIDE, A FAIRE`

`lands` and `kamnet`: 18 files, 1 026 uncovered lines, zero tests.

**Decision:** one auth-required check and one wrong-role check **per controller** —
13 controllers, not 133 routes. `lands` and `kamnet` first.
**Proof:** adding a route without `@Roles` fails a test.
**Cost:** seconds of CI. Deliberate FinOps choice — at the API layer rather than
e2e, where three browsers over 133 routes would cost 40 minutes of runner time
nobody waits for.

### N1 — Response envelope contract — `DECIDE, A FAIRE`

The API answers `{success, data}`, the web answers flat. That gap broke the smoke
test's health-body check and nobody saw it.
**Decision:** one representative route per module. **Cost: none.**

### W1 — `/reactivate` 404 — `A DECIDER`

Listed in `PUBLIC_PATHS`, has no page. `lib/actions/auth.ts:30` redirects there on
`REACTIVATION_REQUIRED`, so a user in the soft-delete grace period hits a 404.

**Open question.** The instruction was "fix or remove `/reactivate` and `/legal`
from `PUBLIC_PATHS`". Investigation says remove **neither**: `isPublic` matches
`p` or `p + '/'`, so `/legal` is what makes `/legal/privacy`, `/terms`,
`/mentions` and `/rgpd` public — removing it sends four legal pages to the login
screen. Same for `/products` and `/verify-certificate`. `/reactivate`'s entry is
correct; the missing **page** is the bug, and it is app work. Awaiting
confirmation before any removal. **Cost: none.**

### F1 — Coverage ratchet — `A DECIDER`

No threshold yet: one that fails on arrival teaches everyone to ignore it. Add
once the number is rising. Current: api 29.8%, common 51.1%, web 0.9%. **Cost: none.**

### P1 — SES contact list, one per account per region — `A DECIDER`

If prd shares this account and region, dev test subscriptions mix with real
subscribers. Options in `kambriq-infra` ADR-005 §1.1.
**Cost:** depends on the option; a separate prd account is the largest.

### X1 — Cost note rebase — `A DECIDER`

The note rests on February–April bills, so on infrastructure that no longer
exists. Needs a recent bill before any decision, including the Scaleway comparison.

### X2 — NAT gateway — `A DECIDER` by Ulrich, on his own PR

Largest remaining line. Removing it means Fargate tasks on public subnets:
changes the security posture, lives in shared state, and would break ECS Exec.

---

## Proven

| ID  | Chantier                                                                                                          | Closed by                         | Proof                                                                                                                                                                          | Cost                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| B1  | SES: the API had never sent an email. Static-credential gate, no `ses:` grant, and the MessageId was never logged | infra #16 #17 #18; webapp #39 #41 | `messageId=010701a06a9fd24c-51cc2bd1-7d70-4715-a7a0-ee582c49ea1e-000000`; `AWS/SES Send` 1.0 and `Delivery` 1.0 at 03:43 and 04:14, `Bounce` none, from zero datapoints before | Contact list free; two IAM policies free; one SSM parameter removed |
| C2  | Middleware decision untested. A redirect loop shipped May 2026, fixed by accident in August, unnoticed            | webapp #38                        | 101 tests; removing `!isPublic(pathname)` fails 18. e2e public routes 5 → 20                                                                                                   | None                                                                |
| C1  | Coverage measured only over files a test already imported; `apps/web` never ran in CI                             | webapp #37                        | api 70.8% → **29.8%** (16 of 60 files were measured); four modules at 0.0%                                                                                                     | None                                                                |
| D1  | Prisma baseline: four dev databases under Migrate, `db push --accept-data-loss` unreachable                       | webapp #34 #35 #36                | `migrate deploy` ×4, "No pending migrations" ×4, no `db push`                                                                                                                  | None                                                                |
| A1  | e2e uploaded an empty report every run while reporting green                                                      | webapp #32                        | `playwright-report` 207 530 bytes, was absent                                                                                                                                  | None                                                                |
| A2  | `scripts/smoke-test.sh` died on its first passing check under `set -e`                                            | infra #15                         | 8 passed / 0 failed under the CI OIDC role                                                                                                                                     | None                                                                |
| L1  | The SES MessageId was logged in a metadata object that `nestjs-pino` drops                                        | webapp #41                        | Mutation: restoring the object form fails 1 of 30 tests                                                                                                                        | None                                                                |

---

## Two habits this register enforces

**Prove it, do not infer it.** A green deploy concealed the SES failure from
February to September. Verify against the external system — the SES `Send`
metric, the live IAM policy, the running task definition — never the CI result.
Note `SentLast24Hours` is **not** a real-time witness: it stayed at `0.0` through
two sends that `Send` and `Delivery` both recorded.

**A failure must be loud.** Every chantier here began as something returning
success while doing nothing. A degraded path must be an explicit setting
(`EMAIL_TRANSPORT=console`), never an inference from absent configuration.

# kambriq-webapp — Agent guide

Deliberately narrow: the chantier register and the rules that keep it honest.
Not an architecture guide; do not infer conventions from its silence.

**This file is the master.** The KAMBRIQ project copy is the archive. On
disagreement, this file wins.

---

## Rules

1. **The closing PR moves the entry to its TRUE state in the same commit.**
   Where the proof requires a deployed environment, that state is `EN COURS`
   with the pending proof named explicitly; a follow-up register commit then
   moves it to `PROUVE` with the proof quoted. **A chantier is never marked
   `PROUVE` by anticipation.** A chantier closed in code and open here teaches
   people to distrust the register; one marked proven before the proof exists
   destroys it outright.
2. **Every chantier states its cost impact, and every added resource carries its
   own.** `None` is a valid answer and must be written down. A resource with no
   stated cost is not finished.
3. **Work the order.** Do not reorder for convenience. Measurements (`X*`) are
   not sequential items: run them during deploy waits.
4. **Cheapest wins.** Standing direction from Visquis: on every infrastructure
   choice, take the cheapest option. The bill is already considered too high. We
   are dev-only; prd does not exist yet, and dev and future prd should share
   resources wherever sharing is cheaper. The trade must be written down, never
   defaulted into.

### States

| State             | Meaning                                                               |
| ----------------- | --------------------------------------------------------------------- |
| `A DECIDER`       | Arbitration missing. **Stop and report.** Do not choose.              |
| `DECIDE, A FAIRE` | The arbitration is in the entry. **Execute it without asking again.** |
| `EN COURS`        | Started, not proven                                                   |
| `PROUVE`          | Closed, proof quoted                                                  |

### Order

`S1` live proof → `B3` → `V1` → the remaining garde-fous (`T1`, `N1`).

S1 and B3 are the two blockers to a tester. V1 is money-correctness. The
garde-fous protect what comes after. `X1`, `X2` and `M1` are measurements and
decisions, run during deploy waits rather than queued behind builds.

---

## Open

### V1 — Commissions and job names — `DECIDE, A FAIRE`, promoted above every garde-fou

`kamnet.processor.ts:44` — a completed sale whose user lookup fails logs an
error, returns `null`, and BullMQ marks the job **completed**. A commission is
silently not created. Both processors also return `null` on an unknown job name,
so a renamed constant drops work while reporting success.

**Decision:** an unrecoverable failure must fail the job; an unknown job name
must throw.
**Reasoning:** no amount of manual testing would ever reveal this, and it is money.
**Proof:** by mutation, on both. **Cost: none.**

### L2 — Logging drops metadata at 106 call sites — `EN COURS`

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

**Code landed in webapp #43.** 102 call sites in `apps/api` and `libs/common`
now carry `%o`. `apps/web/src/lib/logger.ts` is deliberately untouched: it uses
winston, which formats metadata itself, so those 3 were a false positive in the
inventory. A repo-wide invariant test fails if any call passing an object loses
its placeholder; mutation-verified by removing `%o` from the exception filter.

**Privacy review, the one real risk in an otherwise mechanical change.** These
payloads have been discarded for months; enabling them writes them to CloudWatch
for the first time. 34 of 106 mentioned something sensitive-looking; 9 were
genuinely dangerous and are redacted in the same PR: the refresh-token hash on
logout is no longer logged at all; five email addresses are masked
(`al***@kambriq.com`); and two full DTOs (`Admin updated user`, `Lead updated` —
the latter carries clientName, clientEmail and clientPhone) are reduced to their
changed key names. Helpers live in `libs/common/src/utils/log-redact.ts`.

The global exception filter's message and stack are kept: they are the whole
point of the chantier, and it logs no URL.

The Prisma filter takes a third option rather than either of mine. It now logs
**the pathname only**, `request.url.split('?')[0]`, because query strings carry
search terms and password-reset tokens while the diagnostic value is in the path.
The Prisma error message is kept deliberately: it names **columns, not values**.
The response body still returns the full URL, which is the caller's own request
and part of the API contract. Landed in webapp #45.

### L3 — Migrate logging to PinoLogger structured fields — `DECIDE, A FAIRE`

`%o` makes payloads **readable** but not **queryable**: the object is serialised
into the message string, so CloudWatch Insights cannot filter on `userId` or
`examId` as fields. Migrating to `PinoLogger`'s `info(obj, msg)` puts them at the
top level of the JSON, which is what the migration buys.

**Decision:** do it later, as its own chantier. Roughly 102 call sites plus DI
changes, and it should not ride along with a change whose value is that it is
mechanical. **Cost: none.**

### Q1 — `CERTIFIED` with no certificate — `A DECIDER`

Observed while taking the B3 proof. Passing the exam sets the candidate to
`CERTIFIED` and issues nothing. `GET /kbs/certificate/me` answered
`{"success":true,"data":null}` to a candidate the system had just called
certified. Issuance is a separate admin action,
`POST /kbs/admin/certificates/:candidateId`, and the certificate only appeared
when I called it.

That may well be deliberate — a human check before a credential is issued is a
defensible product decision, and it is what the five seeded certificates
represent. But **the two facts disagree in the API today**: one endpoint says
certified, another says there is nothing. Whoever builds the candidate screen
will have to decide what to show, and guessing is how a "your certificate is
being prepared" becomes a "you are not certified".

**Not decided here.** Either issuance follows a pass automatically, or the status
distinguishes "passed, awaiting issuance" from "certified". The first is a
product call, the second is a schema change. **Cost: none either way.**

**Also noticed:** `generateKcaNumber`'s comment says `KCA-YYYYMMDD-NNNN
(sequential per day)`, and it produced `KCA-20260904-N4OY` — a random suffix, not
a sequence. The seeded numbers follow the documented form (`KCA-20250101-0001`),
so the two do not match. Harmless today; it will not be harmless the first time
somebody sorts or parses them.

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

### W1 — `/reactivate` 404 — `DECIDE, A FAIRE`

Listed in `PUBLIC_PATHS`, has no page. `lib/actions/auth.ts:30` redirects there on
`REACTIVATION_REQUIRED`, so a user in the soft-delete grace period hits a 404.

**Decision: keep both entries. The missing pages are the bug, not the entries.
Build the missing `/reactivate` page.**

**Instruction withdrawn, recorded so nobody re-issues it.** The original
instruction was "fix or remove `/reactivate` and `/legal` from `PUBLIC_PATHS`".
It was withdrawn once the investigation showed that `isPublic` matches `p` or
`p + '/'`, so the `/legal` entry is what makes `/legal/privacy`, `/terms`,
`/mentions` and `/rgpd` public. Removing it would send four legal pages to the
login screen. `/products` and `/verify-certificate` are prefixes in the same way.

`/reactivate`'s entry is correct; there is simply no page behind it, so a user in
the soft-delete grace period hits a 404 after `lib/actions/auth.ts:30` redirects
them. **Cost: none.**

### F1 — Coverage ratchet — `A DECIDER`

No threshold yet: one that fails on arrival teaches everyone to ignore it. Add
once the number is rising. Current: api 29.8%, common 51.1%, web 0.9%. **Cost: none.**

### P1 — SES contact list, one per account per region — `A DECIDER`

If prd shares this account and region, dev test subscriptions mix with real
subscribers. Options in `kambriq-infra` ADR-005 §1.1.
**Cost:** depends on the option; a separate prd account is the largest.

### X1 — Cost note rebased on July and August — `PROUVE`

The February–April note described infrastructure that no longer exists: no
bastion, no EBS volume, Container Insights off. `EBS:VolumeUsage.gp3` is now
**$0.17/month**. Rebuilt from Cost Explorer, USD, excluding tax:

| Service             | Jul        | **Aug**    | Detail                                    |
| ------------------- | ---------- | ---------- | ----------------------------------------- |
| **NAT Gateway**     | 39.04      | **39.06**  | hours 38.69 + bytes 0.37, **one** gateway |
| ECS Fargate         | 31.72      | **31.69**  | vCPU 25.99 + GB 5.70                      |
| ALB                 | 20.11      | **20.13**  | usage 20.09, LCU 0.04                     |
| RDS                 | 16.88      | **16.88**  | `db.t4g.micro`, 20 GB, single-AZ          |
| CloudWatch          | 15.90      | **14.55**  | almost all `MetricMonitorUsage`           |
| ElastiCache         | 13.39      | **13.39**  | `cache.t4g.micro`, 1 node                 |
| Public IPv4         | 12.55      | **12.37**  | ~3.3 addresses at 3.72                    |
| Route 53            | 7.59       | 7.59       |                                           |
| KMS                 | 6.00       | 5.99       |                                           |
| EC2 compute         | 3.31       | 2.87       |                                           |
| ECR                 | 0.05       | 0.09       |                                           |
| Registrar           | 17.00      | 0.00       | annual, July only                         |
| **Total excl. tax** | **183.54** | **164.83** | incl. tax: 220.24 / 197.79                |

**Where the money goes: the NAT gateway is the single largest line, ~24% of the
bill excluding tax, and it exists to give two Fargate tasks outbound internet.**
Nothing else is close.

### X2 — NAT gateway — `DECIDE, A FAIRE`, option 2

Priced against the X1 baseline. One NAT gateway, two private subnets in
`eu-central-1a` / `1b`, **zero VPC endpoints today**.

| Option                        | Monthly                                | Delta       |
| ----------------------------- | -------------------------------------- | ----------- |
| 1. Keep NAT                   | **$39.06** + ~$3.72 EIP                | baseline    |
| **2. Public subnets, no NAT** | 2 task IPs × 3.72 = **$7.44**          | **−$35.34** |
| 3. VPC endpoints              | 6 interface × 2 AZ × 8.18 = **$98.20** | **+$59.14** |

Option 3's arithmetic rather than the assumption: `ecr.api`, `ecr.dkr`, `logs`,
`ssm`, `ssmmessages`, `email-smtp` are billed **per AZ** at $0.011/hr in
eu-central-1 = $8.18/AZ/month. S3's gateway endpoint is free and does not help.
**Six endpoints across two AZs cost 2.5× the NAT gateway.** The NAT rate is
verified against the bill itself: 38.69 ÷ 744h = $0.052/hr, exactly one gateway
at list. The endpoint figure is list price, not observed, since the account has
none.

**ECS Exec survives option 2.** It reaches SSM over `ssmmessages` outbound; a
public IP with an IGW route provides that. Exec breaks under option 3 done
badly, not under option 2.

**Blast radius, written down rather than defaulted into:** tasks become directly
addressable at the network layer. Today the security group admits only the ALB,
so effective exposure is unchanged, but a future SG mistake goes from
"unreachable" to "internet-reachable". That is the trade for $35/month.
Implementation is Ulrich's, on his own PR.

### M1 — Mutualisation of dev and future prd — `DECIDE, A FAIRE`

Cheapest wins, per the standing direction. Priced per resource against the
August baseline. "Saving" is shared versus duplicated, per month.

| Resource                                | Saving                      | Blast radius: what a dev incident does to prd                                                                                                                                                                                                 |
| --------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VPC, subnets, **NAT**                   | **$39.06** (already shared) | dev saturating NAT bandwidth throttles prd egress                                                                                                                                                                                             |
| **ALB**, host-based routing             | **$20.13**                  | a bad dev listener rule can misroute prd traffic; shared access logs                                                                                                                                                                          |
| **RDS**, one instance, database per env | **$16.88**                  | a dev migration or runaway query starves prd; dev filling the 20 GB volume takes prd down                                                                                                                                                     |
| **ElastiCache**, key prefixes           | **$13.39**                  | a dev job flood evicts prd keys; `FLUSHALL` in dev wipes prd                                                                                                                                                                                  |
| ECR, shared repos, per-env tags         | ~$0.05                      | a lifecycle policy deleting a tag prd still runs                                                                                                                                                                                              |
| **SES**, already shared                 | no fixed cost               | **largest of all, and already live**: one contact list per account per region, so dev test subscriptions mix with real prd subscribers; and dev bounces damage the shared sending reputation, which can throttle or sandbox the whole account |

**Total if everything is shared rather than duplicated: ~$89.46/month, about 54%
of the August bill excluding tax.**

Recommendation: share VPC/NAT, ALB and ECR. RDS and ElastiCache are the two
where the blast radius is a real production risk rather than an inconvenience —
share them only if prd traffic is genuinely small, and revisit at the first sign
of contention. SES is already shared and its constraint (`P1`) needs resolving
before prd sends anything, independently of cost.

---

## Proven

| ID  | Chantier                                                                                                                                                                                                                                            | Closed by                         | Proof                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Cost                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| B1  | SES: the API had never sent an email. Static-credential gate, no `ses:` grant, and the MessageId was never logged                                                                                                                                   | infra #16 #17 #18; webapp #39 #41 | `messageId=010701a06a9fd24c-51cc2bd1-7d70-4715-a7a0-ee582c49ea1e-000000`; `AWS/SES Send` 1.0 and `Delivery` 1.0 at 03:43 and 04:14, `Bounce` none, from zero datapoints before                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Contact list free; two IAM policies free; one SSM parameter removed |
| B3  | KBS not demonstrable: `KbsQuestion` and `KbsExamQuestion` empty since the seed's single run on 2026-02-26, so the largest module (21 routes) could not be exercised                                                                                 | webapp #47 #49 #50 #51            | Live on dev, `kambriq-dev-api:105`: quiz serves **10**, scores 100/10 and passes; exam serves **20**, `totalQuestions` 20, scores 100, `PASSED`; candidate `CERTIFIED`; **certificates 5 → 6** (`KCA-20260904-N4OY`), earned rather than seeded; `/kbs/public/verify` returns `valid: true`. Idempotency: two local runs, identical counts. Distribution guard **demonstrated, not asserted**: forcing `9/8/8/5` fails all four banks on `<= 8`; `9/9/9/3`, the per-bank shape of a `31/31/29/10` skew, fails the same way; and `8/8/8/6` — upper bound satisfied — fails all four on `>= 7`, so both tails are observed rather than inferred. 235 tests | None                                                                |
| K2  | A candidate who passed every module was told to "finish all the modules". `checkAndTransitionToExamPending` returned silently on a null `activeCourseId` that the seed never set; `me/overview` answered `course: null` for the same reason         | webapp #51                        | `EXAM_PENDING` and `eligible: true` on dev after the fix; `me/overview` returns the course. Mutation: removing the log fails 1, reverting the seed's `update` branch fails 1. `kbsCandidate.updateMany` was absent from the shared mock — the defect was shielding the gap in its own coverage                                                                                                                                                                                                                                                                                                                                                           | None                                                                |
| K1  | A perfect quiz scored **33%**. The grader divided by the module pool (30) instead of the quiz length (10), so nobody could pass a quiz or reach the exam                                                                                            | webapp #50                        | `{"score":100,"correctCount":10,"totalQuestions":10,"passed":true}` on dev, both modules. Mutation: restoring `questions.length` fails 2, removing the completeness check fails 1. Fixtures now hold pool 30 against quiz 10 — the old ones used 2 against 2                                                                                                                                                                                                                                                                                                                                                                                             | None                                                                |
| S2  | Every seeded identifier — 47 literals, 480 generated — was rejected by the API's own `z.uuid()`: version and variant nibbles both `0`. 23 request-body fields across KBS, KAMNET and LANDS were unreachable with seeded data                        | webapp #49                        | Quiz and exam submission accepted on dev after a clean reset and re-seed of the four databases. A test runs all 600 emitted ids through the controllers' own validator, and asserts the literal count is above 40 so an empty match cannot read as a pass                                                                                                                                                                                                                                                                                                                                                                                                | None                                                                |
| N2  | `GlobalExceptionFilter` never executed, in any environment. `PrismaExceptionFilter` is `@Catch()`, wins as last-registered, and rethrew — escaping Nest into Express's HTML error page. Every 401/403/404/500 leaked a stack and broke the envelope | webapp #49                        | On dev: `GET /users/me` 401, `GET /nope` 404, wrong password 400 — all `application/json`, enveloped, no stack, no `node_modules`. Mutation: restoring the rethrow fails 5 chain tests while the 57 filter unit tests stay green                                                                                                                                                                                                                                                                                                                                                                                                                         | None                                                                |
| E1  | Stack traces in HTTP response bodies, gated on `NODE_ENV`                                                                                                                                                                                           | webapp #47, closed by #49         | Mutation: restoring the `NODE_ENV` branch fails 1. The larger half was N2 — my first attribution of this leak to the filter's dev branch was wrong, and the not-found middleware I added in #48 deployed and never fired                                                                                                                                                                                                                                                                                                                                                                                                                                 | None                                                                |
| A3  | Every verification email carried `?token=[object Promise]`. `createVerificationToken` called without `await` on the registration path only. No user had ever been able to verify an address                                                         | webapp #48                        | Live on dev: signup → mail received at maildrop → `token=d5163844cd9a11ec…` (64 hex) → verify 200 → login 200. Login before verifying correctly refused. `EmailService.send` now throws on any `[object …]` argument, covering every template including ones not written yet                                                                                                                                                                                                                                                                                                                                                                             | None                                                                |
| S1  | Storage: `S3Client` gated on `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, never set on Fargate. Every upload and download dead on dev since February                                                                                              | webapp #44                        | Round-trip on dev, `8003ddb` / task def `:100`: presigned URL signed with `ASIAQYAF4F4JDB6N4PDM` — STS credentials from the **task role**, the thing the gate was blocking; PUT 200; `head-object kambriq-media-dev` size 35, etag `333c6389…`; download URL 200; content identical. Mutation: restoring the gate fails 7 of 47 tests in `libs/common`                                                                                                                                                                                                                                                                                                   | None — the IAM grants already existed in `iam-media.tf`             |
| C2  | Middleware decision untested. A redirect loop shipped May 2026, fixed by accident in August, unnoticed                                                                                                                                              | webapp #38                        | 101 tests; removing `!isPublic(pathname)` fails 18. e2e public routes 5 → 20                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | None                                                                |
| C1  | Coverage measured only over files a test already imported; `apps/web` never ran in CI                                                                                                                                                               | webapp #37                        | api 70.8% → **29.8%** (16 of 60 files were measured); four modules at 0.0%                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | None                                                                |
| D1  | Prisma baseline: four dev databases under Migrate, `db push --accept-data-loss` unreachable                                                                                                                                                         | webapp #34 #35 #36                | `migrate deploy` ×4, "No pending migrations" ×4, no `db push`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | None                                                                |
| A1  | e2e uploaded an empty report every run while reporting green                                                                                                                                                                                        | webapp #32                        | `playwright-report` 207 530 bytes, was absent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | None                                                                |
| A2  | `scripts/smoke-test.sh` died on its first passing check under `set -e`                                                                                                                                                                              | infra #15                         | 8 passed / 0 failed under the CI OIDC role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | None                                                                |
| L1  | The SES MessageId was logged in a metadata object that `nestjs-pino` drops                                                                                                                                                                          | webapp #41                        | Mutation: restoring the object form fails 1 of 30 tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | None                                                                |

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

The set so far: the null SES client returning `{delivered:false}` on a resolved
BullMQ job; the unsigned S3 URL returned with HTTP 200 against a bucket with all
four public-access blocks `true`; `deleteObject` warning and returning void while
the row was deleted; a completed sale returning `null` so no commission is
created; a short question pool silently shrinking a certification exam.

**The sharpest of that set is a test.** The existing quiz test asserted
`toBeLessThanOrEqual(10)` against a fixture of 5. It passed while the service
served a five-question quiz. The test written to cover that path was itself
accepting the shortfall it existed to catch — so the defect and its guard were
both absent, and the suite reported green. An upper bound is not a length
assertion. Assert the exact number.

**An assertion whose failure has never been observed is a claim.**
The per-bank distribution bounds were written, and then described as something
that _"would have rejected 9/8/8/5"_ and _"would have rejected 31/31/29/10"_.
Would-have is a statement about an assertion, not a run of one. Both were then
forced and both fired — and forcing them showed that Jest stops at the first
failing expectation, so those two skews only ever exercised the **upper** bound.
The lower bound needed its own shape, `8/8/8/6`, where nothing exceeds 8 and one
position falls to 6, before it was seen failing at all. An assertion nobody has
watched fail is in the same family as the `toBeLessThanOrEqual(10)` that sat over
a five-question fixture: written to catch something, never once shown catching it.

**Measure the measurement.** Every wrong number this week was a defect in the
measurement, not in the thing measured: the coverage denominator counted only
files a test already imported; `SentLast24Hours` read `0.0` through two delivered
sends; the answer-position tally came to 101 for a population of 100 because the
regex `/correct: (\d)/` matched the **type declaration** `correct: 0 | 1 | 2 | 3;`.
A distribution report that does not sum to the population is not evidence about
the distribution. Check that the totals close before reading anything into them.

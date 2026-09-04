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

### S1 — Storage: S3 dead behind a credential gate — `EN COURS`

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

**Code landed in webapp #44.** Mutation check done: restoring the credential
gate fails 7 of 47 tests in `libs/common`; `storage.service.ts` at 97.2% line
coverage. `EN COURS` rather than `PROUVE` because the remaining proof — a real
file uploaded through a presigned URL and a download URL returning 200 — can
only be taken against a deployed environment, so it follows the merge. Rule 1
asks the closing PR to move the entry to `PROUVE`; here that is impossible in
the same commit, and the gap is deliberate rather than an oversight.

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

#### How much of this bill is even ours

**The account is shared with other projects. About $12.89/month of August is not
KAMBRIQ**, so our true run rate is roughly **$151.94** excluding tax.

| Line            | Aug         | Ours?                                                                                                                                                                                                                                                             |
| --------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route 53        | 7.59        | **11 hosted zones, 1 is `kambriq.com`.** The rest: `kloudnat.com/.net`, `fotomena.net`, `gentlyevents.com`, `vehluxe.com`, `sotso.net`, `rexho.net`, `saatch.net`, `dorigine.net`, `skodaz.com`. **~$6.90 not ours**                                              |
| KMS             | 5.99        | **None of it.** All three customer-managed keys are `production-fotomena-eks cluster encryption key`. No EKS cluster and no EC2 instance exists, so they are **orphaned keys from a deleted cluster**. None found in eu-west-1, eu-west-3, us-east-1 or us-west-2 |
| Registrar       | 17.00 (Jul) | `kloudnat.com` and `kloudnat.net` expire 2027-07-07, so they renewed in July 2026. The four KAMBRIQ domains expire 2027-08-20. **The July charge was almost certainly kloudnat's**                                                                                |
| S3              | 0.00        | `kloudnat-infra-shared-store` is not ours, but S3 costs nothing                                                                                                                                                                                                   |
| Everything else |             | **KAMBRIQ**, verified by inventory: one ALB, one RDS, one ECS cluster, one non-default VPC, all `kambriq-*`; zero EC2 instances                                                                                                                                   |

Deleting none of this is ours to decide. But ~$12.89/month is counted against a
bill considered too high, and it is somebody else's.

#### Container Insights: the fix worked, verified against the bill

August CloudWatch was **$14.55**, almost all `MetricMonitorUsage`. Container
Insights was disabled on 2026-09-02. September 1-5:

```
AmazonCloudWatch  0.00   (only EUC1-TimedStorage-ByteHrs and DataProcessing-Bytes, both 0.00)
```

`MetricMonitorUsage` is **gone entirely**. Container Insights was the source, and
removing it saved the full **$14.55/month**, about 9% of the bill. Checked rather
than assumed, because the rest of this week argued for checking.

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

**This posture is dev-only. prd does not inherit it by default.** prd will hold
real land records and identity documents. If dev and prd share a VPC they must
**not** share the same subnet posture: prd's tasks belong on private subnets even
while dev's sit on public ones. That is a **mutualisation constraint discovered
now rather than after prd exists**, and it belongs to `M1` as much as here.

**Prepare the PR, do not apply**, until the S1 and B3 blockers are proven: it
touches shared state and two things should not move at once. Implementation is
Ulrich's, on his own PR.

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

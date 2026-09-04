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

### B3 — Seed: KBS not demonstrable — `EN COURS`

Seed ran once, 2026-02-26. `KbsQuestion` and `KbsExam` were empty, so the largest
module (21 routes) could not be exercised. `LandMedia` / `LandDocument` are empty
too and stay that way — they need real files, and S1 has only just unblocked that.

**What ships.** A bank of **120 questions** in `prisma/seed-data/kbs-questions.ts`,
30 per bank across four banks: quiz module 1, quiz module 2, exam module 1, exam
module 2. Seeded as 60 quiz questions (30 per module) and 60 exam questions, each
with four answers and exactly one correct.

**Sizing, and the ratio written down.** The quiz draws 10 per module against a
per-module pool of 30 — **3.0×**. The exam draws `examQuestionCount` = 20 against
a pool of 60 — **3.0×**. Both sit above the shortfall thresholds with room for a
question to be retired without anyone re-deriving the arithmetic.

**Zero `KbsExam` rows, deliberately.** An exam row is a candidate's attempt, not
reference data. Seeding attempts would fabricate history.

**The five certificates are seeded artefacts, not earned certifications.** They
exist against zero exam rows: nobody sat anything. They are there so the
certificate list and PDF routes have something to render. Do not read them as
evidence that the grading path works — that is what B3's live proof is for.

**Deterministic answer position, and the trade.** The correct answer's position is
derived from the running global index through `POSITION_CYCLE`, not from the
position the author happened to type. The first draft had `isCorrect: a === 1` for
every question: the correct answer was always option 1, so a grader bug that
always marks option 1 correct would have graded 100%. That is a test that cannot
fail — this project's recurring defect, appearing inside the fix for the recurring
defect. The trade accepted in exchange: the layout is predictable to anyone who
reads the seed file. Acceptable for dev fixture data, and it would not be
acceptable for a bank used in production.

**Per-bank distribution, measured rather than assumed.** Bounds are asserted per
bank at `[floor(N/4), ceil(N/4)]` = `[7,8]` for 30, with a maximum run of 3 —
never on the aggregate, which can look level while one bank is skewed. Measured
in the seeded database: quiz M1 `7/7/8/8`, quiz M2 `8/8/7/7`, exam M1 `8/8/7/7`,
exam M2 `7/7/8/8`. The concern that raised this was right and the scheme survived
it. The alternative — indexing per bank — was **tested rather than adopted**, and
it was worse: four identical `7/7/8/8` banks and a global `28/28/32/32`. That is
how we know the running global index is doing real work.

**Editorial and legal caveat — read this before reusing the bank anywhere.**
This is dev seed content. It has had **no editorial and no legal validation pass**.
It is fit to prove the engine and the journey; it is **not fit to teach** until
somebody qualified has read it. `apps/web/src/content/methode/fr.mdx` is the
single authoritative source for the three label definitions — TFL, VEFL, VEFIL —
for the question bank and for editorial content alike. The pinning test in
`apps/api/src/__test__/seed/kbs-label-definitions.spec.ts` covers **the bank
only**. The published season 2 corpus never defines the three labels, so nothing
wrong is public. **Season 3 launches Tuesday 8 September and its entire subject is
those three labels**; it needs its own anchoring to the same source, and that is
Visquis's work, not this register's.

**Why a mechanism and not more care.** Writing this bank I regenerated the VEFL
definition from fluent generation without reading `fr.mdx`, and implied a VEFL
parcel has no title. The authoritative text says the opposite: _"Le titre foncier
existe déjà - l'immatriculation est faite"_. That is the inverse of the product,
in agent training material. Commits `1691b67` and `21ceed7` had already corrected
these definitions **twice**. Vigilance had failed twice; it does not get a third
try. The pinning test fails when the bank contradicts the mdx **and** when the mdx
itself moves, and it says in its own comment that it cannot verify legal
correctness — a green run is not a legal review.

**Guards folded into this PR, not reported for later.**

- `exam.service.ts` — `ensureQuestionPoolAvailable` was `poolSize === 0`. A pool
  of 19 against a required 20 produced a 19-question certification exam with no
  wrong number anywhere: `totalQuestions` came from `shuffled.length` and the
  score divided by that, so a 4/5 became 80% and the candidate was certified. Now
  `poolSize < required`, and the message names both numbers.
- `courses.service.ts` — the same shortfall per module on the quiz path.
- Both messages carry `(pool N, requis M)`. A generic _"no questions"_ sends
  whoever is on call looking for an empty table.

**Proof — mutation, taken.** Restoring `poolSize === 0` fails _"refuses to start,
loudly, when the pool is one question short"_. Shrinking the draw to
`questionCount - 1` fails 2 tests. Stripping the numbers from the message fails 1.
Reintroducing the historical VEFL error fails the label pin; moving the mdx line
fails it from the other side. 174 tests green with all mutations reverted.

**Proof — idempotency, taken locally.** Throwaway PostgreSQL 15 cluster, four
databases, `migrate deploy` ×4, then `tsx prisma/seed.ts` twice. Counts after run
1 and after run 2 are byte-identical:

```
core.User 9        kbs.KbsQuestion (quiz) 60     kbs.KbsCandidate 5
core.Role 8        kbs.KbsAnswer (quiz)  240     kbs.KbsCertificate 5
kbs.KbsModule 2    kbs.KbsExamQuestion    60     kbs.KbsExam 0
kbs.KbsCourse 1    kbs.KbsExamQuestionAnswer 240 kamnet.KamnetAgent 5
kbs.KbsLesson 6                                  lands.Land 5
```

The second run created nothing. Referential integrity checked in the seeded
database: zero questions with anything other than exactly one correct answer, in
either bank.

**A near miss worth recording.** The first ID generator reused prefixes `c`, `d`
and `e`, all already taken by existing `IDS` (roles `a`, users `b`, KBS `c`,
kamnet `d`, lands `e`). An upsert on a colliding ID **overwrites a real row**.
Only `f` was free. It also emitted a 10-character final UUID segment where 12 are
required, which would have failed on the first insert.

**`EN COURS`, not `PROUVE`.** The remaining proof needs the deployed environment:
a quiz returning 10, an exam returning 20, and the certificate count moving 5 → 6
through a real attempt. That is one ephemeral ECS task on `kambriq-dev-api:100`,
all four modules in the single task, nothing surviving it.
**Cost: none.**

### K2 — The candidate who finished everything and was told to finish — `EN COURS`

With K1 deployed, both quizzes scored 100 and passed. Then:

```
GET /kbs/exam/eligibility
{"eligible":false,"reason":"Terminez tous les modules du programme avant de passer l'examen."}
```

Told to finish the modules they had just finished.

`checkAndTransitionToExamPending` reads `kbsSettings.activeCourseId` and, when it
is null, **returns**. No throw, no log, no field in the response. **The seed never
set it.** So the transition to `EXAM_PENDING` could not run, and the candidate
stayed `IN_TRAINING` for ever. `me/overview` answered `course: null,
modulesTotal: 0` to somebody who had just completed six lessons — same line, same
cause.

**Decision:** the seed sets `activeCourseId`, on `create` **and on `update`** —
any environment seeded before this already has the settings row, so a
create-only fix leaves it null exactly where the defect was observed. And the
early return logs at `error` naming the field to set: the state is recoverable by
an admin, but only once somebody knows to look.

**The defect was shielding the gap in its own coverage.** `kbsCandidate.updateMany`
— the call that performs the transition — **was not in the shared prisma mock at
all**. No test ever reached it, because every test read a null `activeCourseId`
from those same mocks and returned first. Adding the two tests required adding
the mock.

**Proof:** mutation, taken. Removing the log fails 1; reverting the seed's
`update` branch to `{}` fails 1. `EN COURS` until a candidate reaches
`EXAM_PENDING` on dev. **Cost: none.**

### K1 — A perfect quiz scored 33% — `EN COURS`

The first quiz submission that ever reached the grader, on the reset dev:

```
{"score":33,"passed":false,"correctCount":10,"totalQuestions":30}
```

Ten questions asked, ten answered correctly, **33%, failed**.

`submitQuiz` computed `correctCount / questions.length`, where `questions` is
every question in the module. `findQuestionsForQuiz` serves `quizQuestionCount`
of them. Pool 30, quiz 10, perfect score 33% — below the 70% pass mark, so
**nobody could pass a quiz, and nobody could reach the exam.** The whole KBS
journey ended at the first module.

**B3 is what exposed it.** The module pools held five questions, the draw was
`min(5, 10) = 5`, pool and served set were the same number, and the denominator
was accidentally right. Seeding a real bank made the two quantities differ for
the first time. The same shape as the coverage denominator: arithmetic that
stays internally consistent while measuring the wrong population.

**The tests could not have caught it.** Both `submitQuiz` tests used a pool of
two questions and submitted two answers. `correctCount / questions.length` and
`correctCount / quizLength` are indistinguishable when the two are equal. **A
fixture where two different quantities happen to be the same number cannot tell
you which one the code used** — that is the third time this week a test was
green because its fixture collapsed the distinction it existed to check.

**Decision:** score over the quiz length. A submission that does not cover the
whole quiz is **refused, with both numbers**, rather than normalised: scoring a
partial submission out of the full length guesses at intent, and scoring it out
of its own length lets a client send its one confident answer and score 100%.

**Proof:** mutation, taken. Restoring `questions.length` fails 2; removing the
completeness check fails 1. Fixtures now hold pool 30 against quiz 10.
`EN COURS` until a candidate passes a quiz on dev. **Cost: none.**

**Checked, not assumed:** `gradeExam` divides by `exam.totalQuestions`, the count
recorded when the exam was served. That one is right.

### N2 — The global exception filter never ran — `EN COURS`

Probing dev after the A3 deploy, not reading code, found it:

```
POST /auth/login  wrong password   401  text/html   <pre>UnauthorizedException ... at AuthService.login
GET  /users/me    no token         401  text/html
GET  /nope                         404  text/html   ... /app/node_modules/.pnpm/@nestjs+core@11.1.17/...
POST /auth        bad body         400  application/json   {"success":false,...}   <- the only correct one
```

**Root cause.** `PrismaExceptionFilter` is `@Catch()` — a catch-all — and Nest
selects the **last-registered** matching filter. It is registered after
`GlobalExceptionFilter`, so it wins for every exception, and for anything
non-Prisma it did `throw exception`. A throw from inside a filter is not
"pass it along": it escapes Nest's exception layer into **Express's default
error handler**, which answers with an HTML page carrying the full stack. Only
validation errors looked right, because `ZodExceptionFilter` is
`@Catch(ZodValidationException)` and handles its own.

`GlobalExceptionFilter` **never executed once**, in any environment, ever.

**Two chantiers were resting on that filter.** E1 removed the stack from a body
this filter builds — a body no client had received. N1's envelope contract held
on success paths and on nothing else: every error response broke it.

**And my own account of E1 was wrong.** I recorded the leak as "the
`NODE_ENV === 'development'` branch in the global exception filter". The HTML
shape said otherwise and I did not read it. The `NODE_ENV` branch was real and
worth removing; it was not what leaked.

**Decision:** `PrismaExceptionFilter` delegates to `GlobalExceptionFilter`
instead of rethrowing, so the chain always terminates in a JSON envelope
regardless of which filter Nest picks. Also removes the not-found middleware
attempted earlier in the A3 PR: it was registered after an explicit `app.init()`
and could never run, because Nest mounts its own not-found **route** during
`init()`. Deployed, and it did not fire once.

**The mechanism: test the chain, not the filter.**
`global-exception.filter.spec.ts` calls the filter directly. It was green
throughout the period the filter never ran, and it stays green under the
mutation that restores the defect — 57 of 57. A unit test of a filter proves the
filter; it cannot prove the filter is reached. The new test boots a real HTTP
server with `main.ts`'s exact `useGlobalFilters` wiring and reads what a client
receives. Restoring `throw exception` fails 5 of its cases.

**Proof:** mutation, taken. `EN COURS` until dev answers JSON on 401, 403, 404
and an unmatched URL. **Cost: none.**

### S2 — Every seeded identifier is rejected by the API's own validation — `EN COURS`

Found by taking the B3 live proof: the quiz served 10 questions, and submitting
answers to them returned

```
400  {"field":"answers.0.questionId","message":"Invalid UUID","code":"invalid_format"}
```

The seed writes `00000000-0000-0000-0000-<prefix><counter>` — **47 hardcoded ids
and 480 generated ones, 47 of 47 rejected**. PostgreSQL stores them happily; as
far as the `uuid` column is concerned they are valid. `z.uuid()` is not: RFC 4122
puts the version in the first nibble of group 3 (1-8) and the variant in the
first nibble of group 4 (8, 9, a or b), and the seed wrote `0` for both.

**Twenty-three request-body fields across KBS, KAMNET and LANDS are declared
`z.uuid()`.** A tester sending a seeded id to any of them gets a 400 that reads
like their own mistake. Submitting a quiz answer, saving an exam answer,
attaching a lead to a seeded parcel — all unreachable with the data seeded for
exactly that purpose. This is delivery-checklist item 3, and B3 could not have
met it.

**Why nothing caught it.** The two systems disagreed silently. The write side
(Prisma → Postgres) accepted the value and the read side returned it; only a
request carrying an id in a **body** ever met the stricter rule, and no test
did that.

**Decision:** the seed emits RFC-valid ids — same prefix scheme, version nibble
`4` and variant nibble `8`, so `…-a00000000001` becomes
`00000000-0000-4000-8000-a00000000001` and the a/b/c/d/e/f convention is intact.
A test runs every id the seed emits — literals and both generators, 600 of them —
through the same validator the controllers use, and asserts the literal count is
above 40 so an empty match cannot read as a pass.
**Proof:** mutation, taken, on a literal and on a generator.
**Cost: none.**

**Blocked on a decision — see `D1` below.** New ids mean the rows already on dev
are the old ones. A re-seed keyed on the new ids would not replace them: roles
and questions would double, and `kbsCandidate.userId` would point at user ids
that no longer exist. Dev needs a clean reset for this to land.

### A3 — Every verification email carried a dead link — `EN COURS`

Found by taking checklist item 1 for real: registering on dev, fetching the mail
from the recipient's mailbox, and opening the link.

```
<a href="https://dev.kambriq.com/verify-email?token=[object Promise]">
```

`auth.service.ts:95` called `createVerificationToken` — an `async` method —
**without `await`**, so the template literal interpolated the Promise itself.
Lines 341 and 372 (resend, password reset) had the `await`. Registration, the one
path every new user takes, did not.

**Every layer reported success.** The queue accepted the job, the worker rendered
the template, SES delivered, `Send` and `Delivery` both recorded 1.0, the mailbox
received a well-formed email. The only party who could see the failure was the
recipient, and there had never been one. **No user has ever been able to verify
their address on dev.** That is delivery-checklist item 1, and B1 proving a send
did not prove it — a send is not a signup.

**Decision:** the `await`, plus a guard at the one place every template argument
passes through. `EmailService.send` now throws when any argument stringifies to
`[object …]`. That is never content; it is what a missing `await` looks like by
the time it reaches a template. `${await f()}` and `${f()}` differ by five
characters and the type system cannot separate them — both produce a `string`.
The guard covers every template at once, including ones not written yet.

**The existing test passed throughout.** It asserted `email.send` was called with
the right `to`, `template` and `lang`, and never opened `args`. Asserting that an
email was sent is not asserting that it is usable — the same shape as the quiz
test in B3.

**Proof:** mutation, taken. Removing the `await` fails _"puts the real
verification token in the link, not an unresolved promise"_; removing the guard
fails both `[object Promise]` and `[object Object]` cases. `EN COURS` until a
real signup on dev completes verification and logs in.
**Cost: none.**

### E1 — Stack traces in HTTP response bodies — `EN COURS`

Found while taking the S1 live proof: a failed login returned
`AuthService.login (/app/dist/apps/api/main.js:2758)` to an **unauthenticated**
caller. It was the `NODE_ENV === 'development'` branch of the global exception
filter, so it was correct for dev — and it means the day prd runs with that value
by accident, anyone who mistypes a password reads the internals.

**Decision:** remove the stack from the response body entirely, regardless of
`NODE_ENV`. The stack stays in the log (`global-exception.filter.ts:39`), which is
where it is useful and where it is not addressable by a stranger. There is no
environment in which shipping it to the client is the right default, so it does
not need to be a setting.
**Proof:** by mutation — putting the stack back under `NODE_ENV=development`
fails _"omits the stack when NODE_ENV is development"_. Landed in webapp #47.

**Half-done, and caught by probing rather than by reading.** The filter covers
every exception Nest routes through it — and **not** an unmatched URL. Nest's
not-found handler sits outside the global filter chain, so `GET /api/v1/nope`
fell through to Express's default error page: an HTML body with the full stack,
`/app/node_modules/.pnpm/...` paths, and the exact pinned version of every
framework package (`@nestjs/core@11.1.17`, `router@2.2.0`, `class-validator`).
A mistyped URL handed a stranger a dependency inventory. The A3 PR attempted a JSON 404
handler registered after an explicit `app.init()`. **It was deployed and it never
fired**, because Nest mounts its own not-found _route_ during `init()`, ahead of
anything registered afterwards. The real cause was N2 below, and the attribution
in this entry — "the `NODE_ENV === 'development'` branch in the global exception
filter" — was **wrong**: that filter had never run. Closed by N2.
**Cost: none.**

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

| ID  | Chantier                                                                                                                                               | Closed by                         | Proof                                                                                                                                                                                                                                                                                                                                                  | Cost                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| B1  | SES: the API had never sent an email. Static-credential gate, no `ses:` grant, and the MessageId was never logged                                      | infra #16 #17 #18; webapp #39 #41 | `messageId=010701a06a9fd24c-51cc2bd1-7d70-4715-a7a0-ee582c49ea1e-000000`; `AWS/SES Send` 1.0 and `Delivery` 1.0 at 03:43 and 04:14, `Bounce` none, from zero datapoints before                                                                                                                                                                         | Contact list free; two IAM policies free; one SSM parameter removed |
| S1  | Storage: `S3Client` gated on `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, never set on Fargate. Every upload and download dead on dev since February | webapp #44                        | Round-trip on dev, `8003ddb` / task def `:100`: presigned URL signed with `ASIAQYAF4F4JDB6N4PDM` — STS credentials from the **task role**, the thing the gate was blocking; PUT 200; `head-object kambriq-media-dev` size 35, etag `333c6389…`; download URL 200; content identical. Mutation: restoring the gate fails 7 of 47 tests in `libs/common` | None — the IAM grants already existed in `iam-media.tf`             |
| C2  | Middleware decision untested. A redirect loop shipped May 2026, fixed by accident in August, unnoticed                                                 | webapp #38                        | 101 tests; removing `!isPublic(pathname)` fails 18. e2e public routes 5 → 20                                                                                                                                                                                                                                                                           | None                                                                |
| C1  | Coverage measured only over files a test already imported; `apps/web` never ran in CI                                                                  | webapp #37                        | api 70.8% → **29.8%** (16 of 60 files were measured); four modules at 0.0%                                                                                                                                                                                                                                                                             | None                                                                |
| D1  | Prisma baseline: four dev databases under Migrate, `db push --accept-data-loss` unreachable                                                            | webapp #34 #35 #36                | `migrate deploy` ×4, "No pending migrations" ×4, no `db push`                                                                                                                                                                                                                                                                                          | None                                                                |
| A1  | e2e uploaded an empty report every run while reporting green                                                                                           | webapp #32                        | `playwright-report` 207 530 bytes, was absent                                                                                                                                                                                                                                                                                                          | None                                                                |
| A2  | `scripts/smoke-test.sh` died on its first passing check under `set -e`                                                                                 | infra #15                         | 8 passed / 0 failed under the CI OIDC role                                                                                                                                                                                                                                                                                                             | None                                                                |
| L1  | The SES MessageId was logged in a metadata object that `nestjs-pino` drops                                                                             | webapp #41                        | Mutation: restoring the object form fails 1 of 30 tests                                                                                                                                                                                                                                                                                                | None                                                                |

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

**Measure the measurement.** Every wrong number this week was a defect in the
measurement, not in the thing measured: the coverage denominator counted only
files a test already imported; `SentLast24Hours` read `0.0` through two delivered
sends; the answer-position tally came to 101 for a population of 100 because the
regex `/correct: (\d)/` matched the **type declaration** `correct: 0 | 1 | 2 | 3;`.
A distribution report that does not sum to the population is not evidence about
the distribution. Check that the totals close before reading anything into them.

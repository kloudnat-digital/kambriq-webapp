# kambriq-webapp — working brief

**Read this before you touch anything.** It is not a description of the codebase;
it is what a week of finding defects taught, written so you do not have to find
them again. The chantier register — the evidence for every claim made here — is
in [`docs/ops/registre-chantiers.md`](docs/ops/registre-chantiers.md); see
section 7.

**This file is the master.** The KAMBRIQ project copy is the archive. On
disagreement, this file wins.

---

## 1. Standing rules

1. **Branch, then PR. Never merge or apply without explicit validation.** Not
   `terraform apply`, not `gh pr merge`, not a credential change, not a
   destructive database operation. The authorisation is per action, not standing.
2. **Never `--no-verify`.** The hooks catch real things — commitlint, eslint,
   prettier. If a hook blocks you, fix the cause. Subjects are lowercase in this
   repo (`subject-case`); infra accepts uppercase.
3. **Short hyphens in prose.** No em-dashes in commit messages or PR bodies.
4. **The register is updated in the same commit as the work it describes.** A
   chantier closed in code and open in the register teaches people to distrust
   the register. One marked proven before the proof exists destroys it outright.
5. **Every chantier states its cost impact.** `None` is a valid answer and must be
   written. A resource with no stated cost is not finished.
6. **Work the stated order.** Do not reorder for convenience. Measurements run
   during deploy waits, not queued behind builds.

---

## 2. Method

Each of these cost a day to learn. A rule without its reason gets dropped by the
next person, so the reason is here.

### Proof by execution, not by inspection

Every defect that mattered this week was invisible to inspection and visible on
the first real request. A null SES client returning `{delivered:false}` on a
resolved job. An unsigned S3 URL returned with HTTP 200 against a bucket with all
four public-access blocks `true`. `?token=[object Promise]` in every verification
email for months. A quiz scored out of the wrong denominator so nobody could
pass.

**Reading the code tells you what it says. Running it tells you what it does.**

### One mutation proves one expectation

An assertion with several tails needs **one mutation per tail, each observed
failing on its own**, and you read the actual `Expected/Received` rather than the
test name.

This came from the per-bank distribution bounds, which assert a floor and a
ceiling. Two mutations were run and both were reported as proving the assertion.
Both only ever produced `Expected: <= 8, Received: 9` — **Jest stops at the first
failing expectation**, so the lower bound never executed in either run. It took a
third shape to see it fire at all.

A mutation tells you _an_ expectation caught it, never that _the_ expectation you
had in mind did.

### Gate live proofs on the commit, never on a counter

Wait for the running task definition's image tag to equal
`sha-$(git rev-parse --short HEAD)`. **A monotonic counter says something
changed, not what is running.** A deploy was gated on the ECS revision reaching
106, the number advanced for an unrelated merge, and a fix appeared to fail
against a build that did not contain it.

`/api/v1/health/version` returns `gitSha`, `imageTag` and `buildTime`. Use it.

### A claim is unproven until its failure has been watched

If you have not seen the guard fail, you have a claim, not a guard. _"Would have
rejected X"_ is a statement about an assertion, not a run of one.

### Check the status, and check that the expected line appeared

Twice in one day a result was read from the numbers that moved rather than from
the process that produced them: a seed exiting `1` whose parcels had already been
restored, and an exit code taken from `tail` because the command was piped.
**Absence of a success line is not absence of a problem.**

---

## 3. Defect catalogue

The most valuable section here. Every entry cost a day.

### Mechanisms that report success by saying nothing

A resolved promise marks a BullMQ job **completed**, so `return null` on an error
path reports success for work never done. Found in: a null SES client; a
completed sale whose agent lookup failed, so no commission was created and the
only symptom was an agent noticing they had not been paid; four processors
returning `null` on an unknown job name; `deleteObject` warning and returning
void while the row was deleted; a short question pool silently shrinking a
certification exam.

**A degraded path must be an explicit setting (`EMAIL_TRANSPORT=console`), never
an inference from absent configuration.**

### Defects in the measurement, not the thing measured

Every wrong number this week was one of these:

- coverage counted only files a test already imported — 70.8% was really 29.8%;
- `SentLast24Hours` read `0.0` through two delivered sends;
- an answer-position tally came to 101 for a population of 100, because the regex
  matched the **type declaration** `correct: 0 | 1 | 2 | 3;`;
- a route scanner treated `[param]` as a non-path segment and reported a real
  route as missing;
- a probe invented `/kamnet/me` and read its 404 as a missing guard — **a route
  that is not there cannot be unguarded**;
- an API root URL built without its trailing slash reached the _web_ app, whose
  404 page was read as the API's;
- a September cost projection multiplied Route 53 hosted-zone fees, which are
  charged once at the start of the month, by 7.5 — inventing $36.

**A distribution that does not sum to its population is not evidence about the
distribution. Check that the totals close before reading anything into them.**

### Reading the first element of a list is not reading the list

A mailbox was fetched, `inbox[0]` was read, no link was found, and _"the invite
email carries no link"_ was one sentence from being filed as a defect. There were
two messages and the invite was the second. **A conclusion drawn from a sample,
presented as a reading of the whole.**

### Tests that defend the bug they were written to catch

`grading-processor.spec.ts` asserted `returns null for unknown job types`. It was
green for exactly as long as the defect existed and **would have failed the day
somebody fixed it**. Not a test that cannot fail: a test that fails when the code
becomes correct. The assertion was accurate about the code and wrong about the
requirement, and nothing in a green suite tells those apart.

**When a test blocks a fix, read the requirement before you read the test.**

### Fixtures where two different quantities happen to be equal

- `submitQuiz` used a pool of 2 against a quiz of 2, so `correctCount / pool` and
  `correctCount / quizLength` were the same number — the denominator defect could
  not appear;
- `global-exception.filter.spec.ts` calls the filter directly, so it proves the
  filter and never that the filter is _reached_; it stayed green through the
  entire period the filter never ran;
- `kbsCandidate.updateMany` was missing from the shared mock and nothing noticed,
  because the defect returned before reaching it.

**A test whose two candidate explanations produce identical output has not chosen
between them.**

### A missing `await` produces a value that satisfies every shallow check

`?token=[object Promise]` in every verification link. `[{},{},{}]` from a map over
an async method, with a correct envelope and a correct `meta.total` of 14. Same
defect, two surfaces. A Promise is truthy, has the array length you expect, and
serialises without throwing.

**Closed structurally:** `buildPaginatedResponse<T>(data: NotPromise<T>[])`. An
unconstrained generic will happily be a Promise; constraining it makes `tsc`
refuse the shipped code at 14 call sites across 10 services. `EmailService.send`
throws on any argument containing `[object `.

### A string literal where a constant exists

`where: { code: 'client' }` against a stored `'CLIENT'`. Case-sensitive
comparison, `null`, and an `if` that swallowed it — so a client created by a land
reservation got **no roles at all**, was emailed portal access, and was refused
by every route in the portal.

The casing was how it surfaced; **the literal was the defect**.
`role-code-literals.spec.ts` bans them across `apps/api/src`, `libs/common/src`
and `prisma/`. The enum is the only exemption.

### An identifier where a customer expects a name

`agentName: agentUserId // will be enriched in the controller` — it never was, and
clients read _"Votre agent KAMNET : 00000000-0000-4000-8000-b00000000005"_.
`EmailService.send` now rejects a `…Name` argument whose value is UUID-shaped.

### Idempotent is not restorative

`update: {}` made re-seeding a no-op on existing rows, so a tester who consumed
the five seeded parcels could never get them back. **A seeded fixture must be
returned to its seeded state by a re-run**, and the seed now verifies its own
postcondition rather than announcing one.

### Local success is not deployment success

The seed ran clean locally and died in the container with
`Cannot find module '../libs/common/src/types/roles.enum'`: `prisma/seed.ts` runs
from **source** under `tsx`, and the image copied two subdirectories of
`libs/common/src`. **The two differ by a `COPY` line nobody reads.**

---

## 4. Invariants somebody will otherwise break

### The response envelope

Every response is `{ success, data, meta? }`, applied by
`TransformResponseInterceptor`, and every **error** response is the same shape —
that took fixing. `PrismaExceptionFilter` is `@Catch()` and wins over
`GlobalExceptionFilter`; it **delegates** rather than rethrowing, because a throw
from inside a filter escapes Nest into Express's HTML error page. For eight
months every 401/403/404/500 leaked a stack and broke the contract.

**Assert on content, never on shape.** A contract test checking `{success, data}`
passes on `[{},{},{}]`. So would `Array.isArray`, `data.length`, `meta.total`.
Use `expectCarriesContent`.

### Four Prisma schemas, four databases

`core`, `kbs`, `kamnet`, `lands` — separate databases, separate clients,
`DATABASE_URL_<MODULE>` each. There are **no cross-database foreign keys**; ids
are carried by convention.

Migrations run with `prisma migrate deploy --schema prisma/<m>/schema.prisma
--config prisma/<m>/prisma.config.ts`, once per module. Prisma 7 quirks that cost
hours: `migrate diff` has no `--from-url` and requires `--config`;
`migrate reset` rejects `--skip-seed` and `--skip-generate`;
`--from-empty --to-schema` emits nothing and exits 0 without `--config`.

**Seeded ids must be RFC-4122 valid.** The API validates `z.uuid()` on 23
request-body fields; PostgreSQL does not. All 47 seeded ids were rejected by the
API until the version nibble became `4` and the variant `8`.

### `PUBLIC_PATHS` matches on prefix

`isPublic` matches `p` or `p + '/'`, so `/legal` is what makes `/legal/privacy`,
`/terms`, `/mentions` and `/rgpd` public. **Removing it sends four legal pages to
the login screen.** `/products` and `/verify-certificate` work the same way.
`routes-have-pages.spec.ts` requires every entry to resolve to a page or be
declared prefix-only with at least one child.

### Roles

`JwtAuthGuard` and `RolesGuard` are global, so **every route is authenticated
unless a decorator removes it** — which makes `@Public()` the thing worth
guarding. `route-guards.spec.ts` pins the public surface as a list.

`ROLE_HIERARCHY`: `ADMIN_GLOBAL` implies everything; `ADMIN_LANDS → AGENT →
CLIENT`; `ADMIN_KBS → CANDIDATE_KBS`. `ADMIN_KBS`, `ADMIN_KAMNET` and
`ADMIN_LANDS` are **lateral** — none inherits from another. When you test a
refusal, pick a role the hierarchy does not imply, or you are testing nothing.

**A deleted class-level `@Roles` downgrades an admin controller to "any
authenticated user" without changing a single response shape.** That is why it is
pinned.

`EXAM_PASSED` is what passing an exam earns; `CERTIFIED` is what issuing a
certificate confers. Grading must never grant `KCA_CERTIFIED` — that role gates
the KAMNET agent routes, and granting it on a score made somebody an agent with
no certificate and no human in the loop.

### `fr.mdx` is the single authoritative source for TFL, VEFL and VEFIL

`apps/web/src/content/methode/fr.mdx`, for the question bank **and** for
editorial content. `kbs-label-definitions.spec.ts` fails when the bank
contradicts it and when the mdx itself moves. The bank had reproduced an error
this repo already corrected twice.

**The KBS question bank has had no editorial or legal validation pass.** It is fit
to prove the engine and the journey; it is not fit to teach.

---

## 5. FinOps is a criterion on every choice

Standing direction: **take the cheapest option**, the bill is already considered
too high, we are dev-only, and dev and future prd should share resources wherever
sharing is cheaper. **The trade must be written down, never defaulted into.**

Already decided:

- **RDS `BackupRetentionPeriod: 0` on dev, deliberately.** What a backup would
  protect is reproducible: `migrate deploy` ×4 plus an idempotent, restorative
  seed rebuilds dev from an empty schema. **Revisit the moment prd exists** — the
  argument dies with the first real user account. It belongs on the ADR-005
  bootstrap checklist.
- **NAT deferred (X2).** One NAT gateway at roughly $39/month is the largest line
  in the bill. Option 2 was decided and then **not applied before delivery**:
  a shared-state network change days before a delivery trades $35/month against a
  broken dev.
- **Tests at API level rather than browser e2e.** 13 controllers × 2 checks run in
  seconds and catch the class of bug that actually ships; three browsers × 133
  routes is 40 minutes of runner time nobody waits for.
- **Container Insights removed** — $14.55 → $0.00, confirmed at the source with
  `containerInsights: disabled`, not inferred from the bill.

Roughly $8/month of a ~$165 bill belongs to another project (three KMS keys for
an EKS cluster that no longer exists, plus hosted zones). The money is NAT, ECS,
ALB, RDS and ElastiCache — all load-bearing.

---

## 6. Where things are

| Thing                      | Path                                                              |
| -------------------------- | ----------------------------------------------------------------- |
| The four delivery journeys | `apps/api-e2e/src/journeys/` — `pnpm test:journeys`               |
| Convention guards          | `apps/api/src/__test__/conventions/`                              |
| Seed and its data          | `prisma/seed.ts`, `prisma/seed-data/`                             |
| Envelope contract          | `libs/common/src/__test__/interceptors/envelope-contract.spec.ts` |
| Deployed build identity    | `GET /api/v1/health/version`                                      |
| The chantier register      | `docs/ops/registre-chantiers.md`                                  |

Run against dev with `KAMBRIQ_API_URL`; enforce the gate with `EXPECTED_SHA`.

---

## 7. The chantier register

**It lives in [`docs/ops/registre-chantiers.md`](docs/ops/registre-chantiers.md),
not here.**

It is the evidence for everything above: the delivery checklist with the proof
each item rests on, every chantier at its true state, the dated decisions
somebody must act on, the role-grant inventory and the read-only account audit.
Read it when you need to know **what was proved and how**. Read this file when
you need to know **how to work**.

**It was moved out of this file on 2026-09-04 for a reason worth stating.** Claude
Code loads `CLAUDE.md` at the start of every session, so while the register lived
here every session paid for all 104 896 bytes of it — every proof, every dated
decision — whether or not it touched them. On a project where FinOps is a
standing criterion that is a permanent cost, and the brief is the part that earns
its place in every session. The move changed no words: the extracted file is
byte-identical to the lines removed from here.

### The rule that keeps it honest

**The PR that closes a chantier updates the register in the same commit.**

A chantier closed in code and left open in the register teaches people to
distrust the register. One marked `PROUVE` before the proof exists destroys it
outright. Where the proof needs a deployed environment, the closing PR sets
`EN COURS` and **names the pending proof explicitly**; a follow-up commit moves
it to `PROUVE` with the proof quoted.

The four states, and what each demands of you:

| State             | Meaning                                                               |
| ----------------- | --------------------------------------------------------------------- |
| `A DECIDER`       | Arbitration missing. **Stop and report.** Do not choose.              |
| `DECIDE, A FAIRE` | The arbitration is in the entry. **Execute it without asking again.** |
| `EN COURS`        | Started, not proven. The pending proof is named.                      |
| `PROUVE`          | Closed, proof quoted.                                                 |

And every entry states its cost impact. `None` is a valid answer and must be
written down — a resource with no stated cost is not finished.

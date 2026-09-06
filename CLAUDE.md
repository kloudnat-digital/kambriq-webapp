# kambriq-webapp — working brief

**Read this before you touch anything.** It is not a description of the codebase;
it is what a week of finding defects taught, written so you do not have to find
them again. The chantier register — the evidence for every claim made here — is
in [`docs/ops/registre-chantiers.md`](docs/ops/registre-chantiers.md); see
section 8.

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

## 2. The standards describe the codebase, not the code written after today

There is no double standard between new code and existing code. Everything in
this file - proof by execution, one mutation per expectation, no role code as a
bare string, no async call in a `map` without `await`, no mechanism that reports
success by saying nothing - is a description of what this codebase is supposed to
be, everywhere, not a rule that starts applying at the next commit.

Deliberately bounded, so it does not become a refactor that blocks delivery:

1. **Any file you touch in a PR comes up to standard in that same PR.** Not the
   whole module, not the whole repo: the file you were already editing. That is
   the only version of this rule that holds without anybody policing it, because
   the person who has the file open is the person who can see what is wrong with
   it.
2. **If bringing a touched file up to standard would balloon the PR, stop and say
   so** rather than shipping half of it silently. A partial cleanup nobody
   mentions is worse than none: it leaves a file that looks reviewed and is not,
   and the next person reads the tidy half as evidence about the whole.
3. **The gap that remains is inventoried, not assumed.** `A7` in the register is
   a read-only pass over the codebase, file by file, listing where it does not
   meet these standards. Its output is a list, not a set of fixes. The point is
   that the debt becomes visible and finite rather than discovered one incident
   at a time.

### CLAUDE.md is updated in the same PR as the work it describes

Exactly like the register, and for the same reason.

This file carries the method and the defect catalogue, and both grow with every
chantier. A brief that lags behind the code it briefs is the stale
cross-reference defect applied to the one document whose entire job is being
trusted - and it is worse here than anywhere else, because this is the file every
session loads before it knows enough to doubt it.

So: a chantier that teaches something new adds it here, in the PR that closes the
chantier. Not afterwards, not in a docs pass, not "once it settles down".

---

## 3. Method

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

## 4. Defect catalogue

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

### A flag nobody reads, on a step that reports success

`deploy-dev.yml` has an opt-in seed step that runs
`node prisma/run-migrations.js --seed`. **`run-migrations.js` never reads
`process.argv`** and does not contain the string `seed`. So the step runs the
migrations, exits 0, and seeds nothing - and the workflow goes green, with a step
named "Run database seed" in it.

Found in September 2026 while wiring the super-admin bootstrap into the same
workflow, which is why the bootstrap is invoked directly
(`npx tsx prisma/bootstrap-admins.ts`) rather than through a flag. **Not fixed** -
recorded in the register.

Same family as the entry above it, arriving through the CI layer: the mechanism
that reports success by saying nothing does not have to be in the application.

### A guard that breaks on the outcome it exists to protect

The super-admin bootstrap verifies its own postcondition, and one of its checks
was `passwordHash is null` - correct for an account it has just created, and
wrong from the moment the holder uses their reset link. It passes run 1 and run 2
and fails run 3, in an environment, on a day when nothing else changed.

Caught by asking what the _third_ run does, not the second. **Scope a
postcondition to the state the run actually produced**; asserting the initial
condition forever turns a working system into a failing check.

### A test that compiles by accident of inference

`Object.entries(ROLE_HIERARCHY)` gave a value typed `unknown`, and `tsc` accepted
`.includes(...)` on it - until a mutation added a role to one of the lists, at
which point the suite **stopped compiling rather than failing**. The mutation did
not find a bug in the code; it found that the test could not be mutated, which is
the same thing as not knowing whether it guards anything.

**If a mutation makes the suite fail to build, the mutation has not been run
yet.** Type the fixture explicitly and mutate again.

### A test that can only fail alongside another

The first version of "no other role reaches every route-guarding role" included
`ADMIN_GLOBAL` in the required set. Any rival would therefore have to imply
`ADMIN_GLOBAL`, which trips the _previous_ assertion first - so this one could
never be observed failing on its own, and two tests were really one.

Excluding the top role from the required set made it independently failable and
made it assert something the other does not: **a role that is a god role in
everything but name.** A test you cannot mutate alone is a test you have not
proved.

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

### A listing is a reading of one moment — and a claim I retracted

**Retracted, and kept as a retraction.** On 2026-09-04 I reported that the Google
Drive sync mount was unstable: three observations of `04_CONTENU/Posts S3`, taken
minutes apart, disagreed about which files were in it. I offered that as a
finding, and as a partial excuse for somebody having described that folder's
contents.

**It does not survive checking.** `ls -l` showed `mkt_s03_plan_v02.md` with an
mtime of `18:04:24` — the minute my second read ran. Visquis was writing into that
folder throughout. Every disagreement has a simpler explanation that was sitting
in the file times the whole time, and I did not look at them before concluding.

Two further things the claim got wrong: **three _consecutive_ reads agreed** — the
three that disagreed were separated by minutes, and the consecutive triple was my
control. And **an empty listing was never observed at all**; the folder held one
file at its emptiest.

**What is actually defensible, and all that is:** a Drive-synced folder can be
written by another process while you read it, so a listing is a reading of one
moment rather than a description of the folder. **Check mtimes before concluding
anything about the mount.** "Read twice" is sensible practice; it is **not** a
finding, and nothing here demonstrates that this mount can lose or hide a file.

**Why the retraction is kept rather than deleted.** The same claim left standing
would have taught the next person something false about the filesystem, and they
would have believed it, because it was written in a document whose whole purpose
is being trusted. **A retracted claim recorded as a retraction is worth keeping; a
retracted claim quietly removed teaches nothing.**

It is also the catalogue recognising itself. I inferred a property of a system
from three samples taken across a window I had not characterised, and presented
it as a reading of the whole — which is the entry two headings above this one,
committed while I was writing that entry.

### Two write paths to one destination is one path too many

Reported by Visquis, 2026-09-04, and it cost a file.

A document was written into the Google Drive **synced folder** on disk, verified
present. The same document also existed in Drive as an earlier **connector**
upload. Trashing that connector object deleted the synced file **on disk** as
well: Drive had reconciled the two by name and treated them as one object.

**A file written correctly, verified present, and then removed by a cleanup aimed
at something else entirely.** Neither action was wrong on its own. The defect was
that two mechanisms were writing to one destination, so a correct operation in
one became a destructive one in the other — and nothing in either path could see
the collision.

**The rule: once a document exists in the synced folder, the connector must not
touch it.** Documents go in as bytes — `cp`, then `cmp` against the source, and
report the result. The connector is retired for documents, not because it is
slower but because its bytes proved unverifiable: a 119 781-byte brief was
uploaded as a 12 735-byte paraphrase, and nothing checked it. `cmp` is the
difference between placing a file and asserting you placed it.

**This is the same shape as the other entries above**, arriving from a direction
nobody was watching. Where a missing `await` produced a value that satisfied
every shallow check, here a correct cleanup produced a deletion that satisfied
every expectation — the object it targeted did go away.

---

## 5. Invariants somebody will otherwise break

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

**`ADMIN_GLOBAL` is the super admin, and there is no second one.** It implies
every role that appears in an `@Roles()` decorator, and it is the only role on the
three endpoints that grant, revoke and replace another user's roles - so it
already administers administrators, including other holders of itself. Two
all-powerful roles is a permission model with two answers to "who can do this",
and the second one drifts. See `docs/adr/ADR-008-admin-global-is-the-super-admin.md`;
`super-admin.spec.ts` fails the day either half stops being true, including the
day a new `RoleCode` gates a route without being added to `ROLE_HIERARCHY`.

**The last active `ADMIN_GLOBAL` cannot be removed, through any of four doors.**
Revoking the role, replacing the role set without it, blocking the account, and
the holder deleting their own account all answer 409. **Replace is the one that
gets forgotten**: `PATCH /users/:id` with a `roleCodes` list that omits the top
role reads as an edit and is a removal. Blocking counts because a blocked admin
cannot log in, so "holders" is counted over `isActive: true, deletedAt: null`.

**`User.passwordHash` is nullable.** A bootstrapped administrator, and a client
created by a land reservation, exist before anybody has chosen a password. Null
means "no password has ever been set"; login refuses it with the generic
invalid-credentials message and a log line that says which case it was. The
holder sets a password through `forgot-password` -> `reset-password`, which is
also what flips `emailVerified`. The old sentinel was `passwordHash: ''`, which
every reader had to recognise; `comparePassword` still folds the empty string in
for rows written before the migration.

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

## 6. FinOps is a criterion on every choice

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

## 7. Where things are

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

## 8. The chantier register

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

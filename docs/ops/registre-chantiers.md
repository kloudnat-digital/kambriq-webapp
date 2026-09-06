# The chantier register

Opened cold, this is the state of the platform. The delivery checklist first, then
every chantier at its true state, then the dated decisions somebody must act on.

**Last closed: Friday 4 September 2026.** Delivery was due Monday 7 September.

---

## Delivery checklist — all six items, with their proofs

Proofs are taken against a deployed build identified by its commit, never by a
revision counter. `GET /api/v1/health/version` returns `gitSha` and `imageTag`.

| #   | Item                                                                              | Proof                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A new user signs up, receives a verification email, verifies, and logs in         | Automated as journey 1. Registration returns 201; the login **before** verification is refused with _"vérifier votre adresse email"_; a real 64-hex token is read out of the mailbox; verify returns 200; login returns 200 with `roles: ['CLIENT']`. **This was broken for months** — every link carried `?token=[object Promise]` (`A3`)                                                                                 |
| 2   | That user uploads a file and gets it back through a working URL                   | Automated as journey 2. The presigned URL carries `X-Amz-Signature` (STS credentials from the **task role**, `ASIA…`), PUT returns 200, the file is attached and read back. **Every upload was dead from February to September** (`S1`)                                                                                                                                                                                    |
| 3   | Seeded data lets a tester exercise KBS end to end, plus lands and KAMNET          | Automated as journeys 3 and 4. Quiz serves **exactly 10** and scores **out of 10**; `isCorrect` never reaches the candidate; exam serves **20**; grading gives `EXAM_PASSED` and **no certificate**; an admin issues one and the count moves; public verify returns valid. Journey 4 reserves a parcel, the created client holds `CLIENT`, sets a password from the invite, logs in, and the portal returns their purchase |
| 4   | Every controller rejects unauthenticated and wrong-role requests, proven by tests | Live sweep across every guarded controller: **401** with no token, **403** with a role `ROLE_HIERARCHY` does not imply, **200** with an allowed one. `route-guards.spec.ts` pins the public surface as a list and the class-level `@Roles` on the five role-gated controllers                                                                                                                                              |
| 5   | CI green with a real e2e artifact                                                 | `playwright-report` 207 530 bytes, was absent (`A1`). The **Delivery journeys (dev)** job runs after every deploy to develop and passed on `d328544`                                                                                                                                                                                                                                                                       |
| 6   | No known silent failure left open                                                 | Every entry in `Proven` below began as something reporting success while doing nothing. The ones still open are named, not forgotten                                                                                                                                                                                                                                                                                       |

**Journeys:** `pnpm test:journeys`. `KAMBRIQ_API_URL` selects the target,
`EXPECTED_SHA` enforces the gate. The gate is mutation-proved both ways: pointed
at a build that is not deployed it **refuses**; unset it **announces** rather
than passing quietly.

---

## Known limits of the suite, so a red run is read correctly

- **It can throttle itself.** The API allows `THROTTLE_LIMIT` requests per
  `THROTTLE_TTL`. The CI run on `ebc1b7e` went red on a **429 in `beforeAll`**,
  caused by local runs against dev at the same moment. `call()` now names a 429
  explicitly. **If the suite is red on rate limiting, nothing is wrong with the
  product** — do not run it locally against dev while CI is deploying.
- **It depends on maildrop.cc** for the mailbox steps. That is deliberate: `A3`
  shipped a dead verification link for months precisely because nothing ever
  opened the email. The helper says when the mailbox is the problem.
- **It returns the parcel it consumes.** Each run reserves one; journey 4 cancels
  it and asserts the parcel is `AVAILABLE` again. Without that the pool empties
  in a fortnight of deploys.

---

## Dated decisions — somebody must act on these

| When                                    | What                                                                                                                                                                                                                                                                                                                         | How                                                                                                                                                                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tuesday 8 September 2026**            | Deactivate `AKIAQYAF4F4JH34UGKU5` (`kambriq-app-dev`). It is the only key left Active besides `vmiaff`'s, and unlike the three deactivated on 4 September it **has** been used — `s3`, 2026-08-27, before `S1` moved storage onto the task role                                                                              | **Check first, then act.** `aws iam get-access-key-last-used --access-key-id AKIAQYAF4F4JH34UGKU5`. Still 2026-08-27 or older → `update-access-key --status Inactive`. **Anything more recent → stop** and find out what used it before touching anything |
| **When prd exists**                     | RDS `BackupRetentionPeriod` is **0 on dev, deliberately** — what a backup protects is reproducible from `migrate deploy` ×4 plus a restorative seed. **Every word of that argument dies with the first real user account.** Belongs on the `ADR-005` bootstrap checklist as an explicit decision, not a default carried over | Set a retention period before prd takes traffic                                                                                                                                                                                                           |
| **Next time the RDS module is touched** | `/aws/rds/instance/kambriq-postgres-dev/postgresql` is capped at 7 days, set **outside Terraform** because RDS creates that group itself. It is undeclared state — nothing drifts today, and the next person reading the Terraform will believe every log group is described there                                           | Move it into `modules/rds-postgres`                                                                                                                                                                                                                       |
| **Not scheduled**                       | `X2` — the NAT gateway, roughly **$39/month**, the largest line in the bill. Option 2 was decided and deliberately **not applied** before delivery: a shared-state network change days before a delivery trades $35/month against a broken dev                                                                               | Apply after delivery, with a plan reviewed first                                                                                                                                                                                                          |

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

Four entries below are marked `PROUVE` and kept in place rather than moved to the
table: `Z1`, `D2`, `X1` and `X4` carry commands, numbers or reversal steps that
are longer than a table row and are still needed. Everything genuinely open is
listed here first.

| Entry            | State             | What it needs                                                                                                                                       |
| ---------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `L2`             | `EN COURS`        | one deployed log line carrying its interpolated metadata, quoted                                                                                    |
| `L3`             | `DECIDE, A FAIRE` | migrate logging to `PinoLogger` structured fields — deliberately **not** shipped before delivery                                                    |
| `F1`             | `A DECIDER`       | coverage ratchet: a floor, and what happens when a PR drops below it                                                                                |
| `P1`             | `A DECIDER`       | SES contact list, one per account per region — the prd constraint                                                                                   |
| `X2`             | `DECIDE, A FAIRE` | NAT option 2, decided, deliberately unapplied before delivery                                                                                       |
| `M1`             | `DECIDE, A FAIRE` | mutualisation of dev and future prd, with per-resource saving and blast radius                                                                      |
| `Q1` follow-up   | `A DECIDER`       | `generateKcaNumber` says _sequential per day_ and emits a random suffix; `CANDIDATE_KBS` is granted self-service and gates nothing                  |
| `D3`             | `EN COURS`        | the four Prisma baselines, deleted by `d099cd1` and restored here - pending proof is one deploy from this branch whose migration task exits 0       |
| `H1`             | `PROUVE`          | `ADMIN_GLOBAL` is the super admin; no second role created. ADR-008 + `super-admin.spec.ts`, five mutations quoted below                             |
| `H2`             | `PROUVE`          | proven on dev on `f91289f`: `2 created, 0 updated, 0 unchanged`, exit 0, tally read from the task's own log stream                                  |
| `H3`             | `EN COURS`        | journey 5 green on dev under the sha gate; **pending proof is the two real holders activating their own accounts**                                  |
| `H4`             | `PROUVE`          | the last active super admin cannot be removed through any of four doors - live 409 on each, four mutations quoted below                             |
| `A7`             | `PROUVE`          | inventory swept 2026-09-06, output in `docs/ops/a7-standards-inventory.md`: 6 findings (2 closed on sight), 7 classes clean, 2 defects in the sweep |
| `H2` follow-up 1 | `A DECIDER`       | `deploy-dev.yml` passes `--seed` to `run-migrations.js`, which never reads `process.argv`: the seed step has never seeded anything                  |
| `H2` follow-up 2 | `A DECIDER`       | the bootstrap deploy step checks the exit code and never that the tally line appeared - the same gap the seed step has                              |
| `H5`             | `PROUVE`          | journey 5's address guard was a detector, not a barrier: it reported and let the run continue into a real inbox. Moved to `beforeAll`               |
| `H6`             | `PROUVE`          | the same run's `afterAll` revoked a real administrator's role. Every write audited, role restored 16:05:26, guard made structural                   |
| `H7`             | `PROUVE`          | nothing tested the bootstrap's role assignment - journey 5 granted it to itself. Decision extracted and covered, 11 tests, 3 mutations              |
| `H8`             | `EN COURS`        | the bootstrap sent no email; a stray test made it look as though it had. Fixed and proven locally; pending the re-send to `contact@` on dev         |
| `H8` follow-up   | `A DECIDER`       | per-address SES delivery is not observable: no configuration set, no event destination. Needed to answer "did THIS address receive it"              |
| `H9`             | `PROUVE`          | the bootstrap's provenance check failed a whole deploy and skipped every later step. Postcondition scoped; step moved after the web deploy          |
| `B1`             | `PROUVE`          | payment code audited against the design: 0 payments ever processed, no payment table, G3/G4 partly built, six of eight not started                  |
| `A10`            | `PROUVE`          | the identity-review queue did not exist - the route and the role did. Queue route + `idSubmittedAt`; the back-office screen stays open              |
| `A11`            | `PROUVE`          | 13 sites, 15 messages, 12 transactional. `sendUpdate` returns an outcome and throws on a transactional template                                     |
| `A12`            | `PROUVE`          | the WhatsApp preference removed from the API and the web, the column kept. A test fails if it returns, or if a sender appears                       |
| `V1` follow-up   | `PROUVE`          | the commission lookup throws now but has never run: 0 sales completed, all 5 commissions seeded. Closed by inspection only                          |
| `B2`             | `PROUVE`          | V1 inventory finished: WhatsApp preference reads nothing, `sendUpdate` skips indistinguishably and defaults off, `RedisService` unused              |
| `B3`             | `PROUVE`          | 56 dev parameters against 0 on prd; only 7 injected as secrets, so 49 need an apply to take effect. One confirmed unread, the rest candidates       |
| `B4`             | `PROUVE`          | 4 journeys: VERIFY does not exist; reactivation and block/unblock never run; 57 identity documents queued for a review that has never run           |
| `G1`             | `EN COURS`        | payment model in `lands`: BigInt money, 9-state machine, append-only ledger and audit. Pending proof is G8, one payment end to end on dev           |

### H1 - `ADMIN_GLOBAL` **is** the super admin - `PROUVE`

**Cost impact: None.** No resource, no dependency, no runtime change.

The block opened with a request for a `SUPER_ADMIN` role. Reading the code first
turned it into documentation and a guard, because both properties of a super
admin were already true of `ADMIN_GLOBAL`:

- `libs/common/src/types/role-hierarchy.ts` - `ROLE_HIERARCHY[ADMIN_GLOBAL]`
  lists the other seven database-backed roles, which is a superset of every role
  named in an `@Roles()` decorator in `apps/api/src`. **No route is out of its
  reach.**
- `apps/api/src/core/users/users.controller.ts` - `POST /users/:id/roles`,
  `DELETE /users/:id/roles/:roleCode` and `PATCH /users/:id` each carry
  `@Roles(RoleCode.ADMIN_GLOBAL)` and nothing else, and none of them excludes
  `ADMIN_GLOBAL` from the roles that can be granted or revoked. **It already
  administers administrators, including other holders of itself.**

`STAFF_VERIFY`, `STAFF_VALUATION` and `PARTNER_GEO` are in the enum, have no row
in the database, and appear in no decorator. They gate nothing, so they cannot
create a route the super admin is refused. The guard fails the day one of them
does.

Decision and reasoning: `docs/adr/ADR-008-admin-global-is-the-super-admin.md`.
`SUPER_ADMIN_ROLE` is exported as an alias so code that means "the top of the
hierarchy" says so instead of re-deriving it.

**The guard:** `apps/api/src/__test__/conventions/super-admin.spec.ts`, 14 tests.

**Mutations, each watched failing alone** (`npx nx test api --testPathPatterns=super-admin.spec`):

| #   | Mutation                                             | Result                                                                             |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | `ADMIN_GLOBAL` no longer implies `KCA_CERTIFIED`     | 1 failed / 13 passed. `Expected value: "KCA_CERTIFIED"` against the received array |
| 2   | `ADMIN_LANDS` implies `ADMIN_GLOBAL`                 | 1 failed / 13 passed - "no other role implies the super admin"                     |
| 3   | `ADMIN_KBS` reaches everything except `ADMIN_GLOBAL` | 1 failed / 13 passed. `Received: ["ADMIN_KBS"]` - "no second god role"             |
| 4   | the grant route loses its `@Roles`                   | 1 failed / 13 passed. `Received: null`                                             |
| 5   | the grant route also admits `ADMIN_KBS`              | 1 failed / 13 passed - the "and by nothing weaker" half                            |

Two things the mutations found in the test rather than in the code, both kept in
`CLAUDE.md`:

- mutation 2 first made the suite **stop compiling** rather than fail:
  `Object.entries(ROLE_HIERARCHY)` typed the value `unknown` and `tsc` had
  accepted `.includes(...)` on it by accident of inference. A mutation that
  breaks the build has not been run;
- the "no second god role" test originally included `ADMIN_GLOBAL` in the
  required set, which made it **impossible to fail on its own** - any rival trips
  mutation 2's assertion first. Excluding the top role made it independently
  failable and made it assert something the other does not.

---

### H2 - Two real super-admin accounts, bootstrapped from SSM - `PROUVE`

**Cost impact: $0.00/month.** Twelve SSM Standard parameters (free tier is 10 000)
and one extra Fargate task of a few seconds per deploy, under $0.001. No new
resource, no new IAM: `/kambriq/{env}/api/bootstrap/*` sits under the prefix the
API task role already holds `ssm:GetParameter` on
(`modules/iam-roles-ecs/main.tf:75`).

`prisma/bootstrap-admins.ts`, run by `pnpm run db:bootstrap` and by a new
unconditional step in `deploy-dev.yml`.

**Separate from `prisma/seed.ts` on purpose.** The seed is test data: wiped by
`db:reset`, one shared password, there to make a journey runnable. These two
accounts are real people who must survive every reset and exist in prd.

**The identities are not in the repository - including in this file.** They are a home city and two mobile
numbers, and "where does personal data live" is a question this project will be
asked by name. The file holds the shape; SSM holds the values, one parameter per
field, as `SecureString` under `alias/aws/ssm` (the same key the existing
`JWT_SECRET` and `DATABASE_URL_*` parameters use). A typo is then
`aws ssm put-parameter --overwrite` plus a re-run, not a commit, a build and a
release.

```
/kambriq/dev/api/bootstrap/admin1/{EMAIL,FIRST_NAME,LAST_NAME,PHONE,CITY,COUNTRY}
/kambriq/dev/api/bootstrap/admin2/{EMAIL,FIRST_NAME,LAST_NAME,PHONE,CITY,COUNTRY}
```

**Fails loudly, never skips.** Every parameter is required and the run aborts
before writing anything, listing **all** missing or empty parameters rather than
the first:

```
$ BOOTSTRAP_SSM_PREFIX= npx tsx prisma/bootstrap-admins.ts
EXIT=1
BOOTSTRAP_SSM_PREFIX is not set. Nothing was read and nothing was written.

$ (one parameter deleted)
EXIT=1
Bootstrap aborted. 1 parameter(s) unusable under /kambriq/dev/api/bootstrap:
  MISSING  /kambriq/dev/api/bootstrap/admin2/PHONE
```

**Idempotent, keyed on email, proved by three runs and a row diff.**

```
BEFORE  (User UserRole UserProfile) = 9 14 9

RUN 1   [admin1] created  ...  role=ADMIN_GLOBAL grantedBy=bootstrap
        [admin2] created  ...  role=ADMIN_GLOBAL grantedBy=bootstrap
        postcondition verified for 2 account(s)
        2 created, 0 updated, 0 unchanged                       EXIT=0
AFTER   11 16 11        (+2 / +2 / +2)

RUN 2   [admin1] unchanged  (no write issued)
        [admin2] unchanged  (no write issued)
        0 created, 0 updated, 2 unchanged                       EXIT=0
AFTER   11 16 11
        diff of the full rows, run 1 vs run 2: identical, updatedAt included

RUN 3   after both holders had set their own password (see H3)
        0 created, 0 updated, 2 unchanged                       EXIT=0
        hash_prefix still $2b$12$ for both; login still 200
```

Re-running never touches `passwordHash`, `emailVerified` or `isActive`: by the
second run the holder may have set a password, and reconciling that back to the
parameter store would lock them out of their own account. Identity fields are
reconciled, and only when they actually differ - `update: {}` would still move
`updatedAt`, so "no-op" here means no write is issued at all.

**Superseded in part by `H8`.** The unconditional no-op above no longer holds: a
re-run now re-sends the verification email when the holder is unverified **and**
has no live link outstanding, which writes a token. It is self-limiting and
becomes a true no-op again once both accounts are verified. The three-run proof
above stands for the rows; `H8` carries the proof for the new condition.

**Proven on dev, 2026-09-06, on the deploy of the merge commit `f91289f`.**
The bootstrap ran as an ECS one-off task from `deploy-dev.yml`, task
`7b6dd94e0d96489d999030372be165ce`:

```
17:22:45.678  Kambriq super-admin bootstrap starting
17:22:45.678    region eu-central-1, prefix /kambriq/dev/api/bootstrap, slots admin1, admin2
17:22:46.780    [admin1] created  …  role=ADMIN_GLOBAL grantedBy=bootstrap
17:22:46.796    [admin2] created  …  role=ADMIN_GLOBAL grantedBy=bootstrap
17:22:46.824    postcondition verified for 2 account(s)
17:22:46.873  Kambriq super-admin bootstrap complete: 2 created, 0 updated, 0 unchanged
```

ECS `exitCode: 0`, `stoppedReason: Essential container in task exited`.

**The tally line was read out of the task's own CloudWatch stream, not out of the
workflow.** The workflow step waits and checks the exit code; it never sees the
task's stdout. That is the same shape as the seed step - a green step that proves
the process ran, not that it did anything - and it is why the tally was checked
separately. **Recorded as a gap in the step itself:** see `H2` follow-up 2 below.

**State read back through the API afterwards:** three `ADMIN_GLOBAL` holders on
dev - the two bootstrapped accounts, both `emailVerified: false` and awaiting
their holders, and the seeded `admin@kambriq.com`.

**No email left, and none should have.** `prisma/bootstrap-admins.ts` contains no
email code at all: it writes the rows and stops. `AWS/SES` `Send` for the
bootstrap's window is **zero**. The activation link is requested by each holder
through `forgot-password`, which is what keeps their single-use token theirs.

**Schema.** `User.passwordHash` is now nullable
(`20260906120000_password_hash_nullable`). The alternative was a sentinel hash,
which is a value that lies about what it is; NULL says it once, in the schema,
and `tsc` makes every reader handle it. The same migration retires the
`passwordHash: ''` sentinel in `findOrCreateClientUser`. `comparePassword` folds
both null and empty to `false` explicitly rather than handing them to bcrypt.

**One phone column, and the second number has nowhere to go.**
`User.phone` is a single nullable column. Account 1 was given two numbers, one
French and one Cameroonian. The French one is in `.../admin1/PHONE`; **the
Cameroonian one is not stored anywhere** and was not concatenated into the same
field - `+33 ... / +237 ...` is not a phone number, and everything downstream that
treats it as one would be handed something undiallable that looks populated. The
numbers themselves are in SSM and deliberately not repeated here.

**And a finding on top of it, which the arbitration did not anticipate.**
`CM_PHONE_REGEX` is `/^(?:\+?237)?6\d{8}$/`, and `UpdateProfileDto` applies it to
`PATCH /users/me`. **The API only accepts Cameroonian mobile numbers.** So the
French number the bootstrap writes is one the application's own DTO would reject:
it survives until either holder tries to save their profile with a phone in it,
at which point they get a 400 telling them to enter a Cameroonian number. Same
regex on `auth.dto.ts` (registration), `lands.dto.ts` and `kamnet.dto.ts`.
**Reported, not resolved** - the value is in SSM, so switching to the Cameroonian
number is a parameter update; widening the regex is a decision about who the
platform is for.

**Zero inferred values.** Every one of the twelve parameters now holds a value
Visquis stated. Read them out of SSM, not out of this file: the values are
deliberately not repeated in the repository.

**Corrected on 2026-09-06, and the correction is about this entry as much as
about the data.** This paragraph previously listed _three_ uncertain values -
`admin1/EMAIL`, `admin2/EMAIL` and `admin2/LAST_NAME` - on the grounds that the
brief had given only the domain. It had given both local parts. **The only thing
inferred was the TLD**, `comp` read as `com`, and it applied to both addresses
identically; the local parts were quoted. Account 2's surname was the single
genuine invention, and `PATCH`-ing three parameters at
`admin2/{EMAIL,FIRST_NAME,LAST_NAME}` on 2026-09-06 settled it with values
Visquis wrote out, lowercase as he wrote them.

**Two of the three had been correct all along, and were made to look doubtful.**
That is the defect worth keeping: a record that overstates its own uncertainty
misleads in the same way as one that understates it, and it is harder to notice,
because hedging reads as care. Somebody would have re-checked two values that
never needed checking, and the cost of that is the credibility of the one flag
that was real.

**Where the timing mattered.** The bootstrap upserts on email, so `EMAIL` is the
key. Changing a key does not update a row, it creates a second one - so a deploy
run against a wrong address would have produced a super admin nobody asked for,
a verification email sent to it, and a second account on the next correction.
The correction was therefore applied **before** the merge. In the event
`admin2/EMAIL` already held the corrected address and the key did not move, so
nothing had to be reconciled; `FIRST_NAME` and `LAST_NAME` are non-key fields the
bootstrap reconciles on its next run without creating anything.

The register keeps the sequencing rule rather than the lucky outcome: **a
parameter that is part of an upsert key is corrected before the mechanism that
reads it runs, not after.**

---

### H3 - Validation through the existing flow - `EN COURS`

**Cost impact: None.**

No parallel path for administrators. The accounts are created with
`emailVerified: false` and no password; the holder uses
`POST /auth/forgot-password` then `POST /auth/reset-password`, which is the flow
proven on 4 September and which sets `emailVerified: true` on the same
transaction that sets the password.

**Proven locally, end to end, against the API on `localhost:3000`:**

```
account 1  (the address in .../admin1/EMAIL)
  login before any password is set      HTTP 401
  forgot-password                       HTTP 204
  reset-password (token from the row)   HTTP 204
  login                                 HTTP 200   roles ["ADMIN_GLOBAL"], JWT issued

account 2  (the address in .../admin2/EMAIL)
  forgot-password                       HTTP 204
  reset-password                        HTTP 204
  login                                 HTTP 200   roles ["ADMIN_GLOBAL"], JWT issued

after both:  emailVerified = t,  passwordHash = $2b$12$...  for both rows
```

**Automated as journey 5, on a maildrop address, and never on the two real
accounts.** `apps/api-e2e/src/journeys/journeys.spec.ts` - a passwordless account
is created through the reservation path (the only public route that produces
`passwordHash` null and `emailVerified` false, which is the state the bootstrap
produces), granted `ADMIN_GLOBAL` **before** it has ever had a password, and then
activated through `forgot-password` -> `reset-password` with the link **read out
of the maildrop mailbox**. It ends at a 200 login whose JWT carries
`ADMIN_GLOBAL` and opens an `ADMIN_GLOBAL`-only route, then revokes the role and
returns the parcel, both asserted rather than fired and forgotten.

**Why it may never point at a real administrator, and why that is an assertion
rather than a comment.** The reset token is single-use: `resetPassword` stamps
`usedAt`. A journey aimed at a real holder's address would request a link,
consume it, and set a password only the suite knows - so the holder, following
the link they were sent, would be told the token was already used, on an account
they have never logged into. **The suite would lock a person out of activating
their own account and report a pass for doing it.** The first test in the journey
is therefore a guard on its own target address, run before anything sends mail: a
rule that lives in a comment is one copy-paste from being gone.

Two things the journey had to be built around, both from the catalogue:

- the mailbox holds **two** valid reset tokens by that point - the reservation
  invite sent `/auth/set-password?token=` and forgot-password sent
  `/reset-password?token=`. Both work, so a pattern matching either would
  activate the account and leave the journey unable to say which path it proved.
  The pattern matches only `/reset-password`, because H3 is about that one;
- the admin-only assertion spends the token on `GET /users/roles` rather than
  `GET /users`, which is known to serialise every row to `{}` while answering 200
  with a correct `meta.total`. Pointed at that endpoint the assertion would pass
  and prove nothing.

**Written, not yet run.** Running it now would grant `ADMIN_GLOBAL` on dev and
consume a parcel against a build that does not contain this branch. Its first run
is the `Delivery journeys (dev)` job on the deploy after #77 merges.

**Green on dev, 2026-09-06, under the sha gate.** The `Delivery journeys (dev)`
job on the merge run, `EXPECTED_SHA=f91289fa…`, against the image tag
`sha-f91289f` on the running service:

```
journey 5 - a passwordless super admin activates through the ordinary flow
  ✓ refuses to run against a real account
  ✓ is created with no password and cannot log in (516 ms)
  ✓ is made a super admin before it has ever had a password (290 ms)
  ✓ activates through the two public routes, with the link read out of the mailbox (8316 ms)
  ✓ reaches a 200 login carrying ADMIN_GLOBAL, and an admin-only route answers (1622 ms)

Tests: 14 passed, 14 total   (all five journeys)
```

**Mutations, run against the deployed `f91289f`.**

| #      | Mutation                                                        | Result                                                                                                                        |
| ------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `J5-1` | the journey is aimed at a real administrator's address          | see `H5` - it failed and did **not** prevent. Re-run against the barrier: 5 failed on the hook, 0 requests, 0 sends           |
| `J5-2` | the passwordless account is expected to log in                  | 1 failed / 4 passed. `Expected: 200, Received: 401`                                                                           |
| `J5-3` | the replayed reset token is expected to be accepted             | 1 failed / 4 passed. `Expected: 204, Received: 400` - the single-use property, which is the premise of the whole address rule |
| `J5-4` | the activated admin is expected **not** to carry `ADMIN_GLOBAL` | 1 failed / 4 passed. `Expected value: not "ADMIN_GLOBAL"`, `Received array: ["CLIENT", "ADMIN_GLOBAL"]`                       |

`J5-4` first came back **5 failed**, which is not a mutation result: every test had
hit `429`. The suite named it - _"was rate limited (429) ... Not a product
failure"_ - instead of letting it read as a broken login, which is exactly what
that mechanism is for. Retried after the throttle window it failed alone, and the
run above is the one recorded. **A red suite is not a result until you have read
why it is red.**

Baseline re-run after every mutation was reverted: **5 passed, 9 skipped**.

**Tails not mutation-proved, stated rather than implied:** the token shape
(`/^[0-9a-f]{64}$/`), the `204` on the first reset, the reservation `201`, and the
admin-route content assertion. Each costs a full run against dev - a parcel, an
account and three emails - and the four above were chosen as the ones carrying
the claim. **They are candidates, not proofs.**

**And it left nothing behind.** Read back through the API afterwards: the
throwaway account holds `CLIENT` only - the `afterAll` revocation ran - and the
`ADMIN_GLOBAL` holders on dev are the two bootstrapped accounts plus the seeded
admin, three in total.

**Emails proven at the transport, not in the application log.** `AWS/SES` for the
journeys window: **13 `Send`, 13 `Delivery`, 0 `Bounce`, 0 `Complaint`**, all in
the two minutes the job ran (15:30-15:32 UTC). The deploy window that contains
the bootstrap shows **zero** sends, which is correct - the bootstrap sends
nothing.

**Still `EN COURS`, and what is left is deliberately manual.** Journey 5 proves
the _mechanism_ forever, on a disposable identity. It does not prove that the two
real holders have activated - that is a one-time act by each of them, using a
link only they receive, and it is the one part of H3 that must not be automated.
This entry moves to `PROUVE` when journey 5 is green on dev **and** both real
accounts have reached a 200 login by their own hand.

One thing the local run showed that the dev run will not: **login refuses a
bootstrapped account at the `emailVerified` check, before it ever reaches the
password check.** The new "no password has ever been set" branch in
`auth.service.ts` is therefore unreachable for these two accounts specifically. It
is still correct for a verified account whose password is null, it is covered by
`comparePassword` returning `false` explicitly, and the log line exists so the
case is visible to us without being visible to a caller. **It has not been
observed firing in a live request, and that is stated rather than assumed.**

---

### H4 - The last super admin cannot be removed - `PROUVE`

**Cost impact: None.**

`assertNotLastSuperAdmin` in `users.service.ts`. Four doors, because they do not
look alike:

| Door | Route                                  | Why it is a door                                                     |
| ---- | -------------------------------------- | -------------------------------------------------------------------- |
| 1    | `DELETE /users/:id/roles/ADMIN_GLOBAL` | the obvious one                                                      |
| 2    | `PATCH /users/:id` with `roleCodes`    | **the one that gets forgotten** - omitting the role reads as an edit |
| 3    | `POST /users/:id/block`                | a blocked admin cannot log in, so the role administers nothing       |
| 4    | `DELETE /users/me`                     | the holder locking themselves out                                    |

"Last" is counted over holders who can actually act: `isActive: true`,
`deletedAt: null`, excluding the target. A demotion of one admin among several is
untouched.

**Live, against the running API, after reducing the holders to one through the
real endpoints** (both of those revocations returned 200, so the guard is not
simply refusing everything):

```
DOOR 1  DELETE /users/:id/roles/ADMIN_GLOBAL   HTTP 409
  -> Refused: <id> is the last active ADMIN_GLOBAL, and revoking the role would
     leave the system with no super admin. Grant ADMIN_GLOBAL to another active
     account first.
DOOR 2  PATCH /users/:id {"roleCodes":["CLIENT"]}  HTTP 409  ... replacing the role set ...
DOOR 3  POST /users/:id/block                      HTTP 409  ... blocking the account ...
DOOR 4  DELETE /users/me                           HTTP 409  ... deleting the account ...

afterwards: account 2 | ADMIN_GLOBAL | isActive t | not deleted t

then: grant ADMIN_GLOBAL to a second account   HTTP 200
      the same DELETE that was refused a moment ago   HTTP 200
```

**Mutations** (`npx nx test api --testPathPatterns=users.service`, baseline 46 passed):

| #   | Mutation                                                    | Result                                                                                                          |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 6   | guard removed from `removeRole`                             | 2 failed / 44 passed - both door-1 assertions, which share the precondition                                     |
| 7   | guard removed from `adminUpdate`                            | 1 failed / 45 passed                                                                                            |
| 8   | guard removed from `blockUser`                              | 1 failed / 45 passed                                                                                            |
| 9   | guard removed from `deleteMe`                               | 1 failed / 45 passed                                                                                            |
| 10  | holder count stops excluding blocked and soft-deleted rows  | 1 failed / 45 passed - isolates the third door-1 assertion                                                      |
| 11  | guard stops asking whether the target holds the role at all | 4 failed / 42 passed - the new "ordinary user" test **and three pre-existing tests** for the same three methods |

Mutation 11 is recorded as it ran rather than as it was hoped: it does **not**
isolate the new assertion. The three others that fall with it are the existing
`deleteMe`, `blockUser` and `adminUpdate` tests, which is worth knowing - they
were already load-bearing for that early return.

---

### H2 follow-up 2 - the bootstrap deploy step checks the exit code, never the tally - `A DECIDER`

**Cost impact: None to fix, but it may not be free** - see the arbitration below.

The `Bootstrap super-admin accounts` step in `deploy-dev.yml` starts the task,
waits for it to stop, reads `containers[0].exitCode` and fails on non-zero. It
**never sees the task's stdout**, which lives in the task's own CloudWatch stream.
So the step is green on `exit 0` whether or not the run did anything.

Today it did: the tally reads `2 created, 0 updated, 0 unchanged` and the
postcondition line is there. **That was established by reading the stream by hand,
which is precisely the point** - the pipeline cannot tell us, and next time nobody
may check.

**This is the same shape as follow-up 1** - a step named for work it does not
verify - arriving in code written the same week the seed-step defect was
recorded. Writing the rule down did not stop it being repeated one file away.

**Arbitration needed, because the obvious fix is not free.** Reading the stream
from the workflow needs `logs:GetLogEvents` on `/ecs/kambriq-dev-api` for the
deploy role, which is an IAM change in `kambriq-infra`. The alternatives are
having the script write a sentinel the workflow can see another way, or accepting
the gap and checking by hand. **Not decided here**, and deliberately not patched
unilaterally: it crosses into the other repository.

The manual runbook does not have this gap - it fetches the log and requires the
tally - so the one-off path already checks what the automated path does not.

---

### A11 - a preference silently suppressed transactional email - `PROUVE`

**Cost impact: None.**

`sendUpdate` returned the **same `Promise<void>`** whether it queued a message or
dropped it, logged the drop at `debug`, and `emailNotifications` **defaults to
`false`**. The skip was the normal path and no caller could tell.

**Not 10 call sites - 13**, one of them parameterised over three templates, so
**15 messages** could be suppressed. `B2`'s figure was wrong; the audit is
corrected in place.

**Dev's data, and one real person.** All **70** users with a profile row have
`emailNotifications: false`; **not one has it `true`**. The deployed log carries
real suppressions of `examPassed`, `certificateIssued`, `reservationCreated`, and
at 15:44:21 `reservationCancelled` **to `visquis.miaffossa@kambriq.com`**.

**Has a real user silently missed a transactional email? Yes - one, and it is
Visquis.** He is the only non-test account with both a profile row (created by the
H2 bootstrap, carrying the default `false`) and a transactional event. The message
was `reservationCancelled`, for the reservation my own mis-aimed journey-5 run
created and cancelled - so nothing of his was actually at stake. **The mechanism
was real; the loss this time was not.**

**The fix.** `sendUpdate` returns an `EmailOutcome` and **throws** on a
transactional template; `SUPPRESSIBLE_TEMPLATES` is an allow-list, so an
unclassified template is transactional and fails safe. Twelve sites moved to
`send()`, and the dead `resolveClientPrefs` went with them - which closes half of
`A7/W2`.

**15 messages: 12 transactional, 3 suppressible.** All three suppressible ones are
the same shape - two work notifications to an **agent** about their own client,
one status announcement the recipient can already see.

**Red then green.** Void signature restored: **6 failed / 20 passed**. Barrier
removed: **12 failed / 14 passed**. Both restored: **26 passed**.

---

### A10 - the identity-review queue that did not exist - `PROUVE`

**Cost impact: None.** One nullable column, one route.

**Why it had never run, established before anything was built.** The reviewer
route exists. The reviewer role exists (`ADMIN_GLOBAL`, three holders). **The
queue does not, and the back-office screen does not** - the only way to find a
pending document was to page 141 users and look.

**And the data could not be aged**: the profile recorded `idVerifiedAt` and never
a submission time.

**The numbers, and a correction to the brief.** **59** pending, **59 distinct
users**, and **all 59 are `@maildrop.cc` test addresses**; the oldest account is
**2 days** old. The brief described them as _"real submissions from real people,
some months old"_ - **they are journey-3 submissions and none is from a real
person.** Nothing was deleted or bulk-resolved. The mechanism defect stands
unchanged.

**The fix.** `idSubmittedAt`, backfilled from `updatedAt`, and
`GET /users/id-documents/pending` - oldest first, `waitingDays` per row,
`meta.oldestWaitingDays` on the envelope. Registered before `@Get(':id')` or Nest
matches `id-documents` as an id.

**Red then green.** Queue method removed: **6 failed / 1 passed**. `idSubmittedAt`
removed from submit: **1 failed / 6 passed**. Restored: **7 passed**.

**One thing about the red worth keeping.** The first "it exists at all" test
called the method through its type, so removing it made the suite **fail to
compile** - `Tests: 0 total`. A suite that does not build has not been run.
Rewritten as a dynamic lookup it fails as an assertion.

**Still open:** the back-office screen. The queue is answerable through the API;
nothing renders it.

---

### A12 - a preference promising a capability that does not exist - `PROUVE`

**Cost impact: None.**

**Chosen: remove it from the API surface and the web, keep the column.**

The alternative was to label it unavailable. Rejected because **a disabled control
still asks a person to form an intention the system cannot honour, and stores
it** - so the day a sender exists, the stored values are old intentions expressed
against a dead control. And a label is honest only if it is read; an absent
control needs nobody to read anything.

The column stays, marked deprecated. `no-unbacked-preference.spec.ts` fails if the
preference returns to either surface **and if somebody builds a WhatsApp sender**.

**Red then green.** Field restored to the DTO: **2 failed / 3 passed**. Restored:
**5 passed**.

---

### V1 follow-up - the KAMNET commission lookup, verified - `PROUVE`, by inspection only

**Cost impact: None.** Read-only.

**The code path is closed.** `kamnet.processor.ts` throws on `!user` and on
`!agent`, with one deliberate exception that returns a **reported** skip -
`{ skipped: true, reason: 'admin' }`.

**Is there a commission that should exist and does not? No** - and the reason is
itself a finding. `SALE_COMPLETED` is enqueued only by `completeSale`, and **0 of
35 reservations on dev have `completedAt` set.** No sale has ever completed, so
the job has never run. The **5** `KamnetCommission` rows are all seed fixtures,
ids `…d00000000201`-`…d00000000205`, created 2026-09-04 by `prisma/seed.ts:851`.

**So: closed by inspection, not by execution.** The throw has never been observed
firing. **What would settle it:** one completed sale on dev whose agent exists in
core - a commission row appears - and one with the lookup deliberately broken -
the job lands on the failed set with its payload intact. `B4` already records that
`complete` has never been called; this is the same gap from the money side.

---

### B1 - the state of the existing payment code - `PROUVE`

**Cost impact: None.** Read-only. Output:
[`docs/ops/b-audit-inventory.md`](b-audit-inventory.md), section B1.

**No payment has ever been processed, anywhere.** On dev, `sha-1709ec6`: 33
reservations (27 `CANCELLED`, 5 `PENDING`, 1 `CONFIRMED`), **1** row with
`downPaymentConfirmed`, and **0** with `remainingPaymentConfirmedAt`,
`documentsReceivedAt`, `dossierStartedAt` or `completedAt`. **The single confirmed
row is a seed fixture** - `prisma/seed.ts:1376`, `confirmedAt 2025-02-01`. There is
no payment table: no model in any of the four schemas matches
`payment|paiement|invoice|transaction|encaiss|escrow|ledger`.

**Three categories.** Reachable: four nullable columns on `LandReservation`, three
admin routes, `DOWN_PAYMENT_PERCENT`, and a 4-value status enum. Unreachable:
`LAND_JOBS` - two job names whose own file says `// TODO: No LandsProcessor exists
yet` - plus `PAYPAL_ENVIRONMENT` and `NEXT_PUBLIC_PAYPAL_CLIENT_ID`. Absent:
every mechanism the design names.

**`PAYPAL_ENVIRONMENT`, traced end to end as asked.** Provisioned by
`modules/ssm-app-parameters/main.tf:670`; on dev as `String` = `sandbox`,
**version 1**, untouched since 2026-02-24; **read by nothing** (`grep -rn PAYPAL`
over `apps/ libs/ prisma/ .github/ docker/`); **not declared** in `envSchema`;
**not injected** into either task definition. **When it is unset, nothing happens** -
there is no reader, no default and no branch. PayPal is explicitly out of v1 scope
in the design.

**Two contradictions, not gaps.** `downPaymentAmount` is a **`Float`** and a
directly editable column, against _"un montant, en unite indivisible"_ and _"jamais
un nombre qu'on edite"_. And `confirmDownPayment` writes the money flag and the
status in one `update`, with no separate validation step - admin-triggered, so not
a violation today, recorded as a shape to watch.

**G1 to G8** (labels from `ops_kambriq_suivi-production_v01.xlsx`): **G3 and G4
are partly built, and only their infrastructure** - the email queue and S3 upload,
both already proven and both carrying nothing payment-specific. **G1, G2, G5, G6,
G7, G8: not started.** G5 is contradicted by what exists. G8 cannot start: there
is no guard to remove for its mutation proof. **G1 has no head start** - the
existing columns are a shape to replace, not a foundation to extend, and counting
them as progress is how an opening date becomes a guess.

---

### B2 - the V1 inventory finished - `PROUVE`

**Cost impact: None.** Read-only. Section B2.

Three cases found, each with what the closed branch does, what the caller
receives, and whether the caller can tell.

| Case                                                                                                | Caller can tell?                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **WhatsApp notifications** - a stored, editable preference with **no sender anywhere in the API**   | **No.** `PATCH /users/me` answers 200 and echoes `whatsappNotifications: true`. Truthful about storage, silent about a capability that does not exist. **Degraded mode indistinguishable from success**                                    |
| **`EmailService.sendUpdate`** skips on `!prefs.emailNotifications`, logs at `debug`, returns `void` | **No** - same `Promise<void>` as a send. And `emailNotifications` **defaults to `false`**, so the skip is the normal path, not the exception. 10 call sites, including `paymentConfirmed`. The preference is right; the signature is wrong |
| **`RedisService`** - injected once (`agents.service.ts:15,33`) and **never called**                 | not a degraded-mode defect: an unused dependency. BullMQ's Redis is separate and proven                                                                                                                                                    |

**Checked and clean:** i18n fallback (`fallbackLanguage` set, missing key returns
the key - visible, not silent), `EMAIL_TRANSPORT` and `STORAGE_TRANSPORT` (both
explicit enums), `EmailService.send` validations, processors on unknown job names,
and empty `catch` blocks (**0** across `apps/api/src`, `libs/common/src`,
`prisma/`).

---

### B3 - SSM, dev against prd - `PROUVE`

**Cost impact: None.** Read-only. Section B3.

**56 parameters on dev; `0` under `/kambriq/prd` and `/kambriq/prod`.**

**The fact that governs the four lists:** only **7 of 56** are injected as ECS
`secrets`. The other 49 reach the container as plain `environment` values that
**terraform rendered at apply time**, so `put-parameter --overwrite` does not
change the running system for them until an apply. **This scopes a claim made in
`H2`**: "a typo costs a parameter update, not a deployment" is true of the
bootstrap prefix, which is read at runtime through the SDK, and false of the other 49. The distinction is the reader, not the store.

**List 3 - must never exist in prd:** `PAYPAL_ENVIRONMENT = sandbox`;
`EMAIL_TRANSPORT=console` or `STORAGE_TRANSPORT=disabled` if ever copied; dev's
`DB_PASSWORD`; dev's 12 bootstrap values. **No dev-only feature flag or test
switch was found** - the 56 names were searched for `DEBUG TEST MOCK FAKE STUB
SANDBOX DRY_RUN SKIP DISABLE BYPASS` and the only hit is a _value_, not a name.

**List 4, and a correction to my own first sweep.** The first pass matched the last
path segment as a literal and produced 22 names, **at least three of them wrong**:
`web/NEXTAUTH_SECRET` is injected under the env name `AUTH_SECRET`,
`web/JWT_EXPIRES_IN` is injected as a secret, and `db/DB_PASSWORD` is read by
**terraform** at `modules/ssm-app-parameters/main.tf:18-22`. A name-based sweep
cannot see a rename or a non-application reader. The published list separates
**one confirmed** unread parameter from a dozen candidates, and says plainly that
nothing should be deleted on the strength of the table alone.

**The worked example.** The bootstrap prefix: 12 on dev, prd needs its own 12 plus
the task role's read on `/kambriq/prd/api/*` (`D6`). `modules/iam-roles-ecs/main.tf:75`
is parameterised on `var.env` so it follows **if `envs/prd` instantiates that
module** - not verified, flagged as a conditional. Two prd consequences: the deploy
step fails loudly on a missing parameter, so the prefix must exist **before** the
first prd deploy; and the bootstrap now enqueues a verification email, so **that
mail reaches real people the moment prd first deploys.**

---

### B4 - the journeys never exercised - `PROUVE`

**Cost impact: None.** Read-only. Section B4.

Two questions per journey, kept apart. Evidence is rows, not routes.

| Journey                  | Path exists?                                                                                                                                         | Ever run on dev?                                                                                                                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity document upload | **yes**, end to end                                                                                                                                  | **half.** 57 of 136 users hold a document at `pending`; **`verified`: 0, `rejected`: 0.** The submit half runs every deploy (journey 3); **the review half has never run once**, and the queue grows by one per deploy                                             |
| KAMBRIQ VERIFY           | **no.** No module in `apps/api/src`, no schema in `prisma/`. `DATABASE_URL_VERIFY` and `VERIFICATION_COST` are declared placeholders reading nothing | not applicable. Distinct from `/kbs/public/verify-certificate`, which exists and is proven                                                                                                                                                                         |
| Admin back-office        | **yes**                                                                                                                                              | **partly.** `block`/`unblock` never - 0 of 136 carry `deactivatedBy`. Of seven reservation admin routes, **five have never been exercised**, and they are the ones that carry the sale forward; only `cancel` has traffic, from tests cleaning up after themselves |
| Account reactivation     | **yes**, end to end, `GRACE_PERIOD_DAYS = 30`                                                                                                        | **never.** 0 of 136 users have `deletedAt` set, so the grace-period branch has never been entered                                                                                                                                                                  |

**This is not `A3`.** A3 is a person walking the product and reporting friction;
B4 is whether the path is there at all. Neither substitutes for the other.

**Seven things the audit cannot settle** are listed in the document rather than
left as silence - including that zero payments in the database is a statement
about the database and not about whether KAMBRIQ has been paid.

---

### H9 - the bootstrap blocked the whole deploy on a provenance check - `PROUVE`

**Cost impact: None.** One condition and a step moved.

Run `34045263431`, building `1a8aa64` (the squash merge of #79), failed at
**Bootstrap super-admin accounts**, exit 1. **Every step after it was skipped** -
the seed, both service deployments, the smoke test and both version checks - and
dev stayed on the previous build.

**The reason, from the task's own stream** (`d4b7cc77a5a24c60bec379b44e35250e`),
not from the workflow, which prints only `Bootstrap task failed with exit code 1`:

```
  [admin1] unchanged visquis.miaffossa@kambriq.com  (no write issued)
  [admin2] unchanged contact@kambriq.com  (no write issued)
Bootstrap postcondition failed:
  visquis.miaffossa@kambriq.com: grantedBy is 00000000-0000-4000-8000-b00000000001, expected bootstrap
```

**It is the restoration.** `H6` restored the revoked role through the ordinary
admin route, which records the acting administrator's id - `…b00000000001`,
`admin@kambriq.com` - and that is what `grantedBy` is for. The postcondition
asserted the string `bootstrap` unconditionally, so it refused, and would have
refused every deploy from then on. **The remediation for a missing role became
the thing that permanently broke the mechanism that maintains it.**

**Both candidates checked explicitly, and neither is the cause.**

| Candidate                                         | Verdict                                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the `created`-scoped `passwordHash` postcondition | **Present** in the deployed commit - `git show 1a8aa64:prisma/bootstrap-admins.ts` line 323, `created.has(email) && user.passwordHash !== null`. It did not fire                                  |
| the deploy running inside the no-role window      | **No.** Role revoked 15:44:21, restored 16:05:26, bootstrap task ran **16:33:08** - 27 minutes after. The row held the role, `hadRole` was true, and the update branch correctly planned no grant |

The failing assertion is a third one in the same `verify()`, and it is the one
that was never scoped.

**The fix: assert the fact, not its history.** The postcondition is that the
account **holds** the role. `grantedBy` is still checked, but only for a grant
this run wrote - about this run's own behaviour rather than about everything that
has happened to the row since.

**The design correction, which is Visquis's and not a consequence of the log.**
The step moves to **after `Deploy Web to ECS`, before the smoke test**. It still
fails the deploy - that is the point and it stays - but it no longer holds the
application hostage. It depends on the migrations and on nothing else; nothing
downstream reads what it writes.

**Failing loudly and failing early are two different properties**, and placing it
first conflated them. Kept in `CLAUDE.md` as the general rule, which is worth more
than the fix: _must it fail the pipeline_ is about consequence, _what depends on
it_ is about position, and "it is important so it goes first" answers the second
with the first.

Order and loudness are both pinned in `image-carries-seed-deps.spec.ts`, each
mutated and watched failing alone:

| Mutation                                          | Result                                                   |
| ------------------------------------------------- | -------------------------------------------------------- |
| the step is moved back before the service deploys | 1 failed / 7 passed. `Expected: > 10689, Received: 7608` |
| the step stops failing the deploy                 | 1 failed / 7 passed                                      |

**The two suites were gated, not disabled** - checked because a skipped suite and
a passing suite look alike in the sidebar. `Delivery journeys (dev)` and
`E2E Tests (dev)` both carry `needs: [deploy-dev]`, and their
`if: github.event_name == 'push' && github.ref == 'refs/heads/develop'` was
satisfied on that run. They were skipped because the deploy failed, which is the
gate working.

---

### H8 - the bootstrap sent no email, and a stray test made it look as though it had - `EN COURS`

**Cost impact: None.** No resource. One `COPY` line in the image and a flag on
three invocations.

**The diagnosis, and why it took an afternoon instead of thirty seconds.**
`prisma/bootstrap-admins.ts` as shipped in `H2` contains **no email code**. It
creates the rows and stops. The reason nobody noticed is that one of the two
accounts received a verification mail twenty minutes later - from the mis-aimed
journey-5 run of `H6`, through `forgot-password`. The log says it plainly:
`Password reset email sent`.

**An unrelated defect produced exactly the signal we were waiting for.** Not a
silence to be distrusted - a **false witness**. `contact@kambriq.com`, the
account the stray run happened not to touch, received nothing, and that silence
is what closed it. **The control group was accidental.** Kept in `CLAUDE.md` as
its own entry, because it is a harder shape than the ones already there.

**The fix: the same email the registration path sends, through the same code.**

- the token comes from `issueVerificationToken` in
  `libs/common/src/auth/verification-token.ts`. It was a private method on
  `AuthService`, which the image does not carry as source; rather than a second
  implementation in the script there is now **one implementation and two
  callers**, and `AuthService.createVerificationToken` delegates to it;
- the send goes through `EmailService`, constructed directly. Its constructor
  takes exactly **one** argument - a BullMQ `Queue` - so no Nest container is
  needed, and from `send()` onward this is byte-for-byte the registration path:
  same validations, same job name, same queue, same processor, same `verification`
  template. **A direct SES call here would have been the mistake.**

**The structural obstacle, which was real and is worth recording.** `tsx`
resolves `tsconfig.json` from the working directory; this repo has none at the
root, only `tsconfig.base.json`. So esbuild fell back to defaults with
`experimentalDecorators: false`, and importing `EmailService` - whose constructor
carries the `@InjectQueue(...)` **parameter** decorator - died with
`Parameter decorators only work when experimental decorators are enabled`.

It is configuration, not architecture: `--tsconfig tsconfig.base.json` fixes it.
But **the production image did not carry that file** - the production stage
copies `prisma/`, `libs/common/src` and `dist/apps/api` and nothing else - so the
flag alone would have produced a green local run and a dead container. Both
halves are now pinned by `image-carries-seed-deps.spec.ts`, each mutated and
watched failing alone:

| Mutation                                      | Result              |
| --------------------------------------------- | ------------------- |
| the image stops carrying `tsconfig.base.json` | 1 failed / 6 passed |
| the npm script drops the flag                 | 1 failed / 6 passed |
| the workflow drops the flag                   | 1 failed / 6 passed |

**This is the first time a decorated file has been pulled into a source-run
script**, and it is a new constraint on that architecture. `emitDecoratorMetadata`
is still unsupported by esbuild - it is not needed here because the service is
constructed by hand rather than resolved through the container, and anything that
tries to resolve real DI from a script will fail differently.

**Proven by execution, locally, end to end.** Two generated addresses on the test
domain that did not exist, a real SES send, and the mail **read out of the
destination mailbox**:

```
[admin1] created  bootstrap.probe.a.…@maildrop.cc  role=ADMIN_GLOBAL grantedBy=bootstrap verification-email=queued
[admin2] created  bootstrap.probe.b.…@maildrop.cc  role=ADMIN_GLOBAL grantedBy=bootstrap verification-email=queued
2 created, 0 updated, 0 unchanged     EXIT=0

mailbox bootstrap.probe.a.… -> 1 message   subject: Vérifiez votre email KAMBRIQ   token f9e667ac915b9e62…
mailbox bootstrap.probe.b.… -> 1 message   subject: Vérifiez votre email KAMBRIQ   token 9df538d21420555a…

POST /auth/verify-email with the token from the mailbox -> 200, emailVerified = t
```

**Re-runs are self-limiting, which is a change to a property `H2` proved.** `H2`
recorded that a second run issues no write at all. That is now conditional: a
re-run re-sends **only** when the holder is unverified **and** holds no live
link. Proven in three runs:

```
RUN 2  a1 verified, a2 holds a live link   -> 0 created, 0 updated, 2 unchanged, no mail
RUN 3  a2's link expired (contact@'s exact state)
       [admin2] re-sent  …  verification-email=queued
       same id, same role, same grantedBy, tokens_total 1 -> 2
```

**"The row stays and only the mail is new" - confirmed by running it, not by
reading it.**

**Pending, and why it cannot be done yet.** The deployed image is `sha-f91289f`,
which contains neither this script nor `tsconfig.base.json`. **The re-run for
`contact@kambriq.com` needs this merged and deployed**; it cannot be done from
here, because dev's database is in private subnets and the only path to it is the
one-off ECS task built from the image. The pending proof is: the deploy's
bootstrap step re-sends to `contact@`, and the mail is confirmed received.

**And the check that was asked for is not available.** `AWS/SES` publishes
`Send`, `Delivery`, `Bounce`, `Complaint` at **account and region level only** -
there is no recipient dimension, and `list-configuration-sets` returns nothing, so
no per-message event publishing exists. **"Check Delivery for that address
specifically" cannot be answered from CloudWatch as configured.** What is
available: a `Bounce` delta around a single known send, attributable only because
volume is low, and the recipient confirming. `kambriq.com` MX points at Google
Workspace, so whether `contact@` resolves to a mailbox, an alias, a group or
nothing is a Workspace question. **A zero bounce count is evidence the address was
accepted, not that a person reads it.** An SES configuration set with an event
destination would close this and is an infra decision - see the follow-up row.

---

### H6 - a test's cleanup revoked a real administrator's role - `PROUVE`

**Cost impact: None.** No resource. The cost was an hour of a real person's
account being wrong, and the trust in a green suite.

**What happened, from the API's own log.** The mis-aimed journey-5 run of `H5`
did not stop at the email.

```
15:42:16.937  Land reservation created   {reservationId 7d04903e…, landId …e00000000025}
15:42:16.994  POST   /users/a1ddff8b…/roles                     200   grant - idempotent, no row written
15:42:17.057  Password reset email sent  {"email":"vi***@kambriq.com"}
15:44:06.080  POST   /auth/reset-password                       204   HIM, setting his password
15:44:21.546  Role ADMIN_GLOBAL revoked from user a1ddff8b…           the afterAll
15:44:21.575  DELETE /users/a1ddff8b…/roles/ADMIN_GLOBAL         200
15:44:21     POST   /lands/admin/reservations/7d04903e…/cancel  200   the afterAll
15:44:51.070  User logged in             {"userId":"a1ddff8b…"}       HIM, 30s after the revocation
```

He set his password at 15:44:06. The cleanup stripped his role at 15:44:21. He
logged in at 15:44:51 and saw a roleless account.

**Was the guard present?** Yes. `f91289f` was checked out, and its
`journeys.spec.ts:477` carries `it('refuses to run against a real account')`. It
fired, printing `Expected pattern: /@maildrop\.cc$/` against his address, **and
the run continued** - Jest does not stop a `describe` at its first failing test.
The guard was not missing. It was decorative, which is the worse of the two.

**Every write the run made, enumerated from the log rather than inferred.**
47 requests in the window, 23 of them mutating, across two runs.

| #   | Write                                        | Row                                                         | Reverted?                                                                                                                                                                            |
| --- | -------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `POST /users/a1ddff8b…/roles`                | his `UserRole`                                              | **No row written** - `addRole` returns early when the role exists. Confirmed: zero `granted to user` log lines in the window                                                         |
| 2   | `POST /lands/reservations` -> `7d04903e`     | real `LandReservation` on his account, land `…e00000000025` | **Neutralised, not removed.** Cancelled at 15:44:21; the land reads `AVAILABLE` and the catalogue is 13 of 13. **The row still exists**, `status CANCELLED`, attached to his account |
| 3   | `POST /auth/forgot-password`                 | his `VerificationToken`s                                    | **Not reverted.** Prior unused tokens marked used, a new one issued. He consumed it - it is the link he used                                                                         |
| 4   | `POST /auth/reset-password`                  | his `passwordHash`, `emailVerified`, `RefreshToken`s        | **His own action**, not the run's. The run supplied the link                                                                                                                         |
| 5   | `DELETE /users/a1ddff8b…/roles/ADMIN_GLOBAL` | his `UserRole` **deleted**                                  | **Reverted 16:05:26**                                                                                                                                                                |
| 6   | the same five, against `a0104353…`           | the run's own maildrop account                              | test rows, fully reverted by its own cleanup                                                                                                                                         |

**Two things are still not as they were:** the `CANCELLED` reservation row on his
account (item 2), and the consumed token (item 3, which is simply how activation
works). Neither is harmful; both are stated rather than rounded to "restored".

**Restoration.** `POST /users/a1ddff8b…/roles {roleCode: ADMIN_GLOBAL}` at
**16:05:26.291**, through the ordinary admin route, not a direct write.
`Role ADMIN_GLOBAL granted to user a1ddff8b…` in the log; both bootstrap accounts
read back holding `ADMIN_GLOBAL`. **`grantedBy` records the acting admin's id**
(`…b00000000001`, `admin@kambriq.com`) - the route stores the actor, and there is
no free-text reason field to write "restoration" into. The provenance is this
entry and that log line. Adding a reason to role grants would be a decision, not
an invention to make here.

**Why the web showed what it showed - all three layers checked, two innocent.**
`getRoleLabelKey([])` falls through to `role.user` -> **"Utilisateur"**; with the
role it returns **"Administrateur global"**. Of 16 nav items exactly one has
`roles: []` - `items.kbsEnroll` in section `sections.kbs`, **"Formation KBS"** -
which is the entire sidebar he saw. `ADMIN_GLOBAL` sees 10 items including
`sections.admin` and `sections.kbsAdmin`. **The web derives the label from roles
and an admin section exists**; the API returned `roles: []` faithfully; his JWT
was minted 30 seconds _after_ the revocation, so it was accurate too. **Every
layer was correct about a fact that a test had made true.**

**The hypothesis that had to be excluded, and why it was not the cause.**
`bootstrapAccount` assigns the role on **both** branches - `grantSuperAdmin` on
create, and again on update when `hadRole` is false - so it is not the seed's
`update: {}` shape. And the dev run logged `[admin1] created`, the create branch,
with `postcondition verified for 2 account(s)` asserting the grant existed with
`grantedBy: bootstrap`. **The bootstrap assigned the role and proved it had.**
That said, nothing _tested_ either branch - see `H7`.

**The fix: structural, not instructional.** `apps/api-e2e/src/journeys/support.ts`

- `uniqueEmail()` records every address it mints; `assertMinted()` refuses
  anything else, in `beforeAll`, before any test body runs. **Membership, not
  shape** - a well-formed `j5.superadmin.0000@maildrop.cc` is refused too,
  because provenance is the question and a pattern cannot answer it;
- `assertOwnedByThisRun()` reads the row back and requires its email to equal the
  minted address, immediately before each cleanup write. The id variable was the
  defect: `POST /lands/reservations` returns the **existing** person's
  `clientUserId` for an address that already exists, so checking the id against
  itself proves nothing.

**Mutations, both watched failing with no request leaving the process:**

| Mutation                                               | Result                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| target hardcoded to the real address                   | refused in `beforeAll`; `refusing to act on …: it was not generated by uniqueEmail() in this run` |
| target hardcoded to a **well-formed maildrop address** | refused identically - this is the one a pattern check would have passed                           |
| baseline                                               | 5 passed, 9 skipped                                                                               |

---

### H7 - nothing tested the bootstrap's role assignment - `PROUVE`

**Cost impact: None.**

Journey 5 grants `ADMIN_GLOBAL` to its own account before activating it. So it
proves that a passwordless account can be activated, and **never that the
bootstrap assigns the role** - the mechanism proved was not the mechanism that
ran, and every check was green throughout. **A test that grants the thing it
means to verify verifies nothing.**

The write needs a database and the deployed image; the **decision** - create or
update, grant or leave alone - is pure, and it is the part that was hypothesised
to be broken. It is extracted to `libs/common/src/bootstrap/bootstrap-plan.ts`
and covered by `bootstrap-plan.spec.ts`, 11 tests, including the hypothesis
written as an assertion: **an account that already existed comes out of a run
holding the role, not merely with a refreshed name.**

| Mutation                                                                               | Result                                                     |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| the create branch stops granting                                                       | 1 failed / 10 passed. `Expected: true, Received: false`    |
| the update branch never grants (**the hypothesis, as a defect**)                       | 2 failed / 9 passed - both assertions of that one property |
| the role stops counting as a change, so an otherwise-identical row reports `unchanged` | 2 failed / 9 passed                                        |

**What is still not covered, stated rather than implied:** the live write. A
bootstrap run against a generated address would need SSM parameters created per
run and a database the journeys cannot reach - RDS is private and the journeys
run from GitHub runners. The deployed path is covered by the bootstrap's own
postcondition, which asserts the grant exists but cannot distinguish "granted
now" from "already there". **That gap is real and named.**

---

### H5 - journey 5's address guard reported instead of preventing - `PROUVE`

**Cost impact: None to fix.** One unintended email, described below.

Found by mutating the guard rather than by reading it, which is the only way it
could have been found.

Journey 5 must never run against a real administrator's address: it consumes a
single-use reset token, and spending a real holder's would lock them out of
activating their own account. That rule was written as the journey's **first
test**, asserting the target address - deliberately, so it would be enforced
rather than remembered. The register and `CLAUDE.md` both said so.

**Mutated - the address swapped for a real administrator's - it failed exactly as
designed and prevented nothing:**

```
- journey 5 > refuses to run against a real account
    Expected pattern: /@maildrop\.cc$/
    Received string:  "...@kambriq.com"

Tests: 3 failed, 9 skipped, 2 passed, 14 total
```

**Three failed, not one.** Jest does not stop a `describe` at its first failing
test, so the remaining four ran. The run reached `forgot-password` and the API
logged:

```
15:42:17.057  Password reset email sent {"userId":"a1ddff8b-...","email":"vi***@kambriq.com"}
```

**A real password-reset email, to a real person's inbox, sent by a test run.**

**What it cost, stated exactly.** It went no further only by accident: the suite
cannot read that mailbox, so `findTokenInMailbox` timed out and the token was
**not consumed**. `createVerificationToken` invalidates prior unused tokens of the
same type before issuing a new one, and `RESET_TOKEN_EXPIRY_HOURS` is 1, so the
stray token was the only live one and expired an hour later. Nobody was locked
out and no account changed state. **One unexpected email is the whole damage, and
it was luck rather than design that it was not more.**

**The fix, and the distinction that matters.** The check moved into `beforeAll`,
where a throw means Jest executes no test body at all; the `it` now proves the
check's logic rather than standing in for it. Re-mutated against the barrier:

```
5 failed, 9 skipped, 14 total   - every one on the hook, no test body ran
API requests in the window : 0
AWS/SES Send in the window : 0
elapsed                    : 7s   (against ~2 min for the run that sent mail)
```

**A failing assertion records that something was wrong. It does not stop it.** A
check whose job is to prevent an action belongs in a hook, not in a test. Kept in
`CLAUDE.md` as its own catalogue entry.

This is also the sharpest instance of the rule it sits under: **reading the guard
said it was enforced; running it said otherwise, and the difference was a real
email to a real person.**

---

### A7 - Inventory the gap between the codebase and the standards - `PROUVE`

**Cost impact: None.** Read-only.

A pass over both repositories, file by file, listing where existing code does not
meet the standards in `CLAUDE.md`: mechanisms that report success by saying
nothing, async calls in a `map` without `await`, role codes as bare strings,
assertions with more tails than mutations, tests that pin a defect rather than a
requirement, flags nobody reads.

**Its output is a list, not a set of fixes.** The point is that the debt becomes
visible and finite rather than discovered one incident at a time. Fixes are
scheduled against the list afterwards, and the standing rule in the meantime is
the bounded one: the file you touch comes up to standard with your change.

**Swept on 2026-09-06. Output:
[`docs/ops/a7-standards-inventory.md`](a7-standards-inventory.md).**

Six findings, none of them fixed by the pass that found them:

| #    | What                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `W1` | `notifyAgentDocumentUploaded` skips the notification silently when the agent lookup fails - the commission defect's shape, at lower stakes |
| `W2` | two client lookups whose failure is indistinguishable from "no preference stated"                                                          |
| `W3` | `--seed` passed to a script with no `process.argv` - already open as the `H2` follow-up, repeated as the archetype                         |
| `W4` | the register cited `docs/adr/ADR-005` unqualified; there are two ADR-005s and this one is the infra one - **closed on sight**              |
| `W5` | the register cited `scripts/smoke-test.sh`, which lives in `kambriq-infra` - **closed on sight**                                           |
| `W6` | eight test blocks with six or more tails - candidates for missing mutations, not proof of any                                              |

**`W4` and `W5` were closed in this PR rather than scheduled.** Both are one-word
cross-reference fixes in this file, and this file was already being edited by the
PR that found them - which is the boy-scout rule in `CLAUDE.md` section 2 meeting
its first real opportunity on the day it was written. **A rule whose first
application is deferred is a rule nobody believes.** They stay listed in the
inventory, marked closed: an inventory records the gap, it does not pretend the
gap was never there.

The other four are listed and untouched. `W1` and `W2` need a decision rather
than a patch, `W3` is already open as the `H2` follow-up, and `W6` is a candidate
list that only a mutation can resolve.

**Seven classes checked and clean**, stated because a class nobody checked and a
class with nothing in it look identical in a report that only lists findings.
Notably: all 11 async `.map()` sites sit inside `Promise.all`, verified one at a
time; 0 of 250 Terraform variables lack a description; 0 of 40 taggable resources
lack tags.

**And two defects in the sweep itself, kept rather than tidied away.** The
assertion counter first reported 16 tails on a block that has four - its regex
ran to the end of the enclosing `describe`, so blocks inherited assertions from
their children, and the worst offender it named was a test written that morning.
The Terraform tag sweep first reported four untagged resources, all four of them
AWS types that take no tags. **A number produced by a broken measurement is not a
smaller version of the right number.**

**What the sweep cannot close, and says so in its own first section:** whether a
mutation was ever run for a given assertion tail, and whether a test pins a
defect rather than a requirement. Neither is in the tree. `grading-processor.spec.ts`
was found by reading the requirement, and nothing about this pass would have
found it.

---

### H2 follow-up - the seed step in `deploy-dev.yml` has never seeded anything - `A DECIDER`

**Cost impact: None to fix.** Found while wiring the bootstrap into the same
workflow.

`deploy-dev.yml` runs the opt-in seed as
`node prisma/run-migrations.js --seed`. **`prisma/run-migrations.js` never reads
`process.argv`, and the string `seed` does not appear in it.** It runs
`ensureDatabases()` and `runMigrations()` and exits 0. So the step runs the
migrations a second time, reports success, and seeds nothing - under a step named
"Run database seed".

Nothing has been broken by it, because the seed has been run by other means. What
is broken is the belief that this step does anything.

The bootstrap is therefore invoked directly
(`npx tsx prisma/bootstrap-admins.ts`) and not through a flag on that script.

**Arbitration needed:** make `run-migrations.js` read the flag, or drop the
`--seed` argument and call `tsx prisma/seed.ts` directly the way the bootstrap
does. Not decided here.

---

### D3 - The four Prisma baselines were deleted by a docs commit - `EN COURS`

`d099cd1`, subject **"docs: retract the mount-instability finding, and keep the
retraction (#74)"**, added 35 lines to `CLAUDE.md` and deleted 783 lines of
migration SQL: `0_init/migration.sql` for all four modules. It is HEAD of
`develop` and matches `origin/develop`, so it is pushed. The files are not
gitignored; they are simply gone from the tree and from disk.

**This contradicts `D1`, which is marked `PROUVE` on the strength of those very
files** ("`migrate deploy` x4, No pending migrations x4, no `db push`"). Nothing
in the commit message mentions the deletion. Treated as accidental.

The consequence, taken by running `run-migrations.js`'s own predicate rather
than by reading it:

```
core:   hasMigrations=false  -> throws: No migrations found for core
kamnet: hasMigrations=false  -> throws: No migrations found for kamnet
kbs:    hasMigrations=false  -> throws: No migrations found for kbs
lands:  hasMigrations=false  -> throws: No migrations found for lands
ALLOW_DB_PUSH = (unset)
```

So the next deploy from `develop` **fails at the migration step**, loudly, which
is exactly what that deliberately-kept `ALLOW_DB_PUSH` branch exists to do. Dev
was still serving `sha-37f30f7`, which carries the files, so nothing was broken
in the running environment.

Restored here with `git checkout 37f30f7 -- prisma/*/migrations`. The same
predicate now returns `hasMigrations=true` for all four, and each schema is
byte-identical between `37f30f7` and HEAD, so no baseline is stale against its
schema.

**Pending proof, named:** one deploy from this branch whose "Run Prisma
migrations" task exits 0 and reports "No pending migrations" x4. `migrate deploy`
has not been executed against a database from this branch - the restore is
proven at the predicate, not end to end. `migration_lock.toml` has never been
tracked on any branch and is not gitignored; the deployed build ran without one,
so its absence is pre-existing and not part of this regression.

**Cost impact:** None.

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

**Still `EN COURS`, and the pending proof named precisely.** The code landed and
the invariant test guards it, but **a deployed log line carrying its interpolated
metadata object has not been captured**. What _was_ observed on dev is
`messageId=010701a06cd6faf4-…` appearing in the message text rather than in a
dropped object — that is `L1`'s fix working, and it is evidence the `%o` pattern
reaches production, but it is not the same claim. To close this: pull a line from
`/ecs/kambriq-dev-api` whose `msg` contains an interpolated `{…}` and quote it.

_An attempt to take it just now returned an empty stream, because the task had
rotated under a new deploy and the stream name moved with it. That is worth
knowing before the next attempt: the stream is `api/api/<task-id>` and the task
id changes on every deploy._

### L3 — Migrate logging to PinoLogger structured fields — `DECIDE, A FAIRE`

`%o` makes payloads **readable** but not **queryable**: the object is serialised
into the message string, so CloudWatch Insights cannot filter on `userId` or
`examId` as fields. Migrating to `PinoLogger`'s `info(obj, msg)` puts them at the
top level of the JSON, which is what the migration buys.

**Decision:** do it later, as its own chantier. Roughly 102 call sites plus DI
changes, and it should not ride along with a change whose value is that it is
mechanical. **Cost: none.**

### Z1 — Three never-used access keys, one of them full admin — `PROUVE`, applied 2026-09-04

**Authorized and run.** Deactivated, not deleted — reversible in one call.

| User                                   | Key                    | Before | After                                  |
| -------------------------------------- | ---------------------- | ------ | -------------------------------------- |
| `gitops.admin` (`AdministratorAccess`) | `AKIAQYAF4F4JLEEQ5ARN` | Active | **Inactive**                           |
| `ses-kambriq-app`                      | `AKIAQYAF4F4JNP3WKQMQ` | Active | **Inactive**                           |
| `kambriq-app-dev`                      | `AKIAQYAF4F4JLQKD3DWT` | Active | **Inactive**                           |
| `kambriq-app-dev`                      | `AKIAQYAF4F4JH34UGKU5` | Active | **Active — untouched, dated decision** |
| `vmiaff`                               | `AKIAQYAF4F4JNTH6MZ2I` | Active | Active — in use                        |

`LastUsedDate` was re-read immediately before acting and all three still returned
`None`. The check was run again rather than trusted from an hour earlier.

**Reversal — one command each:**

```bash
aws iam update-access-key --user-name gitops.admin    --access-key-id AKIAQYAF4F4JLEEQ5ARN --status Active
aws iam update-access-key --user-name ses-kambriq-app --access-key-id AKIAQYAF4F4JNP3WKQMQ --status Active
aws iam update-access-key --user-name kambriq-app-dev --access-key-id AKIAQYAF4F4JLQKD3DWT --status Active
```

**The six secrets are gone.** `kambriq-infra` before: 11 secrets. After: 5.
Removed — `AWS_ACCESS_KEY_ID`, `AWS_ACCESS_KEY_ID_DEV`, `AWS_ACCESS_KEY_ID_PROD`,
`AWS_SECRET_ACCESS_KEY`, `AWS_SECRET_ACCESS_KEY_DEV`,
`AWS_SECRET_ACCESS_KEY_PROD`. Remaining — `ARTIFACT_BUCKET_NAME_DEV`,
`ARTIFACT_BUCKET_NAME_PROD`, `AWS_REGION`, `AWS_REGION_DEV`, `AWS_REGION_PROD`.
**This half has no reversal**; the credentials would have to be reissued. That
asymmetry was stated before it was authorized, not after.

**And I destroyed the one piece of metadata that was recoverable.** The
instruction to record the six names and their `updatedAt` dates arrived after the
deletion had run. `gh secret list` prints name **and** date; I piped it through
`awk '{print $1}'` and kept only the column I thought I needed, twice, before
deleting the rows. The dates are not recoverable — the org audit log needs admin
this account does not have.

What survives is the six names —
`AWS_ACCESS_KEY_ID`, `AWS_ACCESS_KEY_ID_DEV`, `AWS_ACCESS_KEY_ID_PROD`,
`AWS_SECRET_ACCESS_KEY`, `AWS_SECRET_ACCESS_KEY_DEV`,
`AWS_SECRET_ACCESS_KEY_PROD` — and the dates of the five that remain, which run
2025-11-26 to 2025-12-08. It is _likely_ the deleted six were set in the same
window. **That is inference, not evidence, and it is marked as such because the
evidence is gone.**

The lesson belongs with the measurement defects: **I reduced a reading to the
column I expected to need, and then destroyed the source.** A projection is safe
while the original is still there. This one was not.

**Still dated:** `AKIAQYAF4F4JH34UGKU5` on **Tuesday 8 September 2026**, after
re-checking `LastUsedDate` first. **Cost: none.**

### Nothing depends on them — checked, not assumed

_"Never used" says nothing has used them yet. The question was whether anything
is about to._

- **Every workflow in both repos authenticates by OIDC.** `configure-aws-credentials@v4`
  with `role-to-assume: ${{ secrets.AWS_ROLE_ARN }}` and `id-token: write`, in
  `ci.yml`, `deploy-dev.yml`, `manual-deploy-dev.yml`, `terraform-plan.yml`,
  `terraform-apply.yml` and `smoke-test.yml`. **No workflow in either repo
  references a static AWS key.**
- The roles CI assumes — `kambriq-dev-github-actions`,
  `kambriq-infra-github-actions` — are trusted to
  `oidc-provider/token.actions.githubusercontent.com`. **No IAM user is involved
  in the trust path.**
- The running tasks use `kambriq-dev-ecs-task-api` and
  `kambriq-dev-ecs-task-execution`. Roles, not users — as S1 proved with an
  `ASIA…` STS credential.
- The application no longer reads static credentials at all. `env.validation.ts`
  says so in a comment, and `storage.service.ts` records the gate that used to
  require them.
- **`/kambriq/dev/api/AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` do not exist
  on dev.** Terraform can create them
  (`modules/ssm-app-parameters/main.tf:425,439`) but both are
  `count = var.… != "" ? 1 : 0` and neither variable is set in any `envs/`
  tfvars, so an apply creates nothing.

**One thing that is not clean, and is worth knowing before deciding.** The
`kambriq-infra` repo still holds six static-key secrets —
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `_DEV` / `_PROD` of each. **No
workflow references any of them.** They are orphaned key material sitting in a
repo whose CI does not need it. Which keys they contain cannot be read back;
whoever decides on the IAM keys should decide on these at the same time, because
deactivating a key does not remove its copy from a secret store.

#### Prepared. Not applied.

Deactivate, never delete — reversible in one call, and the key's identity and
audit trail survive.

```bash
# Deactivate — reversible
aws iam update-access-key --user-name gitops.admin     --access-key-id AKIAQYAF4F4JLEEQ5ARN --status Inactive
aws iam update-access-key --user-name ses-kambriq-app  --access-key-id AKIAQYAF4F4JNP3WKQMQ --status Inactive
aws iam update-access-key --user-name kambriq-app-dev  --access-key-id AKIAQYAF4F4JLQKD3DWT --status Inactive

# Verify
aws iam list-access-keys --user-name gitops.admin    --query 'AccessKeyMetadata[].[AccessKeyId,Status]' --output text
aws iam list-access-keys --user-name ses-kambriq-app --query 'AccessKeyMetadata[].[AccessKeyId,Status]' --output text
aws iam list-access-keys --user-name kambriq-app-dev --query 'AccessKeyMetadata[].[AccessKeyId,Status]' --output text

# Reverse, if anything turns out to need one
aws iam update-access-key --user-name <user> --access-key-id <key> --status Active
```

**The fourth key is deliberately not in that list, and now has a dated
decision.** `kambriq-app-dev`'s `AKIAQYAF4F4JH34UGKU5` **has** been used — `s3`,
2026-08-27, eight days ago and before S1 moved storage onto the task role.
_"Nothing should be using it now"_ is exactly the standard this week retired, so
it does not ride in on the argument built for the other three.

> **Decision: leave it `Active` through Monday's delivery. Deactivate it on
> Tuesday 8 September 2026, after re-checking `LastUsedDate` first.**

Deactivating a key that was live eight days ago, on the weekend we deliver, buys
nothing and risks the delivery. Dated rather than left open, so it gets done
rather than forgotten:

```bash
# Tuesday 8 September 2026 — check FIRST, then act on what it says.
aws iam get-access-key-last-used --access-key-id AKIAQYAF4F4JH34UGKU5 \
  --query 'AccessKeyLastUsed.[LastUsedDate,ServiceName,Region]' --output text
# Still 2026-08-27 or older -> deactivate. Anything more recent -> stop and find
# out what used it before touching anything.
aws iam update-access-key --user-name kambriq-app-dev \
  --access-key-id AKIAQYAF4F4JH34UGKU5 --status Inactive
```

#### The six secrets are part of the same decision, and prepared the same way

**A deactivated key whose value still sits in a secret store is a credential
waiting for somebody to reactivate it.** The `kambriq-infra` repo holds six
static-key secrets, referenced by no workflow in either repo — every workflow
uses OIDC. Their values cannot be read back, so which keys they hold is unknown;
that is itself the argument for removing them rather than auditing them.

```bash
# Prepared. Not run. Same terms as the deactivations above.
for s in AWS_ACCESS_KEY_ID AWS_ACCESS_KEY_ID_DEV AWS_ACCESS_KEY_ID_PROD \
         AWS_SECRET_ACCESS_KEY AWS_SECRET_ACCESS_KEY_DEV AWS_SECRET_ACCESS_KEY_PROD; do
  gh secret delete "$s" -R kloudnat-digital/kambriq-infra
done

# Verify: only the non-credential secrets should remain
gh secret list -R kloudnat-digital/kambriq-infra
# expected afterwards: ARTIFACT_BUCKET_NAME_DEV, ARTIFACT_BUCKET_NAME_PROD,
#                      AWS_REGION, AWS_REGION_DEV, AWS_REGION_PROD
```

**`gh secret delete` is not reversible** — unlike the key deactivations, there is
no `--status Active` for a secret. That asymmetry is the reason they are listed
here rather than done: restoring one means finding the original credential again,
and if nobody knows which key is in there, nobody can. The reversible half
(deactivate) and the irreversible half (delete the secret) should still be
decided together, because doing only the first leaves the exposure intact.

**`vmiaff`'s key is in active use and is not a candidate.**

**This is a credential change on Visquis's account. It does not happen without
his explicit word.** **Cost: none** — IAM users and keys are free; this is
entirely about blast radius.

### D2 — The working briefs and the stale-doc sweep — `PROUVE`

`CLAUDE.md` in both repos rewritten as **working briefs** rather than
descriptions: the standing rules, the method with its reasoning, the defect
catalogue, the invariants somebody will otherwise break, and FinOps as a
criterion with what is already decided. The chantier register follows the brief
and is the evidence for it.

The infra brief carries its own: **validate locally, never apply**; the module
layout; ECS Exec as the bastion replacement with the ephemeral-task pattern for
one-off work; and the two drift lessons — **an audit that reports a negative over
a field it never read is worse than no audit**, and **`terraform plan` is the
only thing that compares every declared attribute**, because a hand-rolled
comparison checks the attributes somebody remembered.

**Stale statements fixed or deleted, never annotated:**

| Doc                | Was                                                                  | Now                                                                                                                   |
| ------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| webapp `README.md` | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` listed as required env | Removed, with a note that the SDK resolves the task role and that this pair **was the gate that killed every upload** |
| webapp `README.md` | "5 land parcels (mixed availability)"                                | 20 parcels, 18 available, and the restorative property stated                                                         |
| webapp `README.md` | "Idempotent seed"                                                    | idempotent **and restorative**                                                                                        |
| webapp `README.md` | KBS seed silent on question counts                                   | 120 questions, the 3.0× ratio, and the editorial/legal caveat                                                         |
| webapp `README.md` | "5 certificates (1 per agent)"                                       | marked **seeded artefacts, not earned** — zero exam rows behind them                                                  |
| webapp `README.md` | `api-e2e` described as "End-to-end tests"                            | the four delivery journeys, against a **deployed** API                                                                |
| infra `ADR-005`    | `bastion_allowed_ssh_cidrs` in the prd checklist                     | row deleted; there is no bastion                                                                                      |
| infra `ADR-001`    | Bastion in the security-group port table                             | row deleted                                                                                                           |
| infra `ADR-002`    | "Container Insights built-in" as a benefit                           | available but **deliberately disabled**, with the numbers                                                             |
| infra `CLAUDE.md`  | "if the account is in SES sandbox"                                   | production access granted, plus the warning that `SentLast24Hours` is not a witness                                   |
| infra `CLAUDE.md`  | `terraform apply -auto-approve` in Common commands                   | removed; apply is manual and human-authorised                                                                         |

**A stale doc is a confident wrong answer waiting for somebody who trusts it.**
The `AWS_ACCESS_KEY_ID` row is the proof: it described a variable the code read
as a gate, which was never set on Fargate, which is why storage was dead from
February to September. Anybody following that README would have set it and made
the problem harder to find.

**Cost: none.**

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

### X3 — Dev RDS keeps `BackupRetentionPeriod: 0` — `DECIDE, A FAIRE` → decided

**Decided: it stays 0 on dev.** Recorded as a FinOps choice so nobody closes it
later by reflex, seeing a zero and assuming it is a gap.

Automated backups and point-in-time recovery cost money, and the thing they would
protect is **reproducible**: `migrate deploy` ×4 plus an idempotent seed rebuilds
dev from an empty schema. That was proven twice today — once locally against a
throwaway PostgreSQL 15 cluster, and once against dev itself when the four
databases were dropped and re-seeded for S2. A backup buys nothing that
`prisma db execute` + `migrate deploy` + `tsx prisma/seed.ts` does not already
buy, and dev holds no data anybody would mourn.

**This must be revisited the moment prd exists.** Prd will hold data that is not
reproducible from a seed script, and every argument above stops applying on the
day the first real user account is created.
`kambriq-infra/docs/adr/ADR-005-production-automation-prerequisites.md` is the prd
bootstrap document; the retention period belongs on that checklist as an explicit
decision rather than a default carried over from dev.

**Named in full because there are two ADR-005s.** In this repository `ADR-005` is
_E2E Testing with Playwright_, so the bare reference this line used to carry sent
the reader to the wrong document and nothing told them so.

**Cost: none — it is a saving**, roughly the snapshot storage of a 20 GB gp3
volume, and it is deliberate rather than absent.

### X4 — RDS log group retention capped — `PROUVE`

`/aws/rds/instance/kambriq-postgres-dev/postgresql` had `retentionInDays: None` —
never expire — holding 5.85 MB and growing, while every other group in the
account is capped. Unbounded retention is a bill that grows while nobody looks at
it.

Set to **7 days**, matching `/ecs/kambriq-dev-api` and `/ecs/kambriq-dev-web`.

```
before:  /aws/rds/instance/kambriq-postgres-dev/postgresql   None   5852463
after:   /aws/rds/instance/kambriq-postgres-dev/postgresql   7      5852463
```

**Applied outside Terraform, and that is worth saying plainly.** The ECS log
groups are `aws_cloudwatch_log_group` resources with
`retention_in_days = var.log_retention_days`; this one is created by RDS itself
when log exports are enabled, so Terraform never declared it and there is nothing
to drift against today. It is still undeclared infrastructure state, and it
belongs in the RDS module the next time that module is touched — otherwise the
next person to read the Terraform will believe every log group is described
there.

**Cost: a small reduction**, and it stops an unbounded one.

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

| ID    | Chantier                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Closed by                              | Proof                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Cost                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| B1    | SES: the API had never sent an email. Static-credential gate, no `ses:` grant, and the MessageId was never logged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | infra #16 #17 #18; webapp #39 #41      | `messageId=010701a06a9fd24c-51cc2bd1-7d70-4715-a7a0-ee582c49ea1e-000000`; `AWS/SES Send` 1.0 and `Delivery` 1.0 at 03:43 and 04:14, `Bounce` none, from zero datapoints before                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Contact list free; two IAM policies free; one SSM parameter removed |
| F3    | The four journeys were proven by hand: once, by one person, on one build                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | webapp #67 #71                         | Automated in `apps/api-e2e/src/journeys/`, **9 assertions green in CI** on `d328544` in the `Delivery journeys (dev)` job, and locally under the gate. Every assertion is a defect this week produced. The gate is mutation-proved both ways; the suite returns the parcel it consumes and names a 429 rather than letting it read as a broken login                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | None                                                                |
| F2    | The seed was idempotent but **not restorative**: `update: {}` meant a re-run gave nothing back, so five parcels consumed by five journeys left a tester with an empty catalogue reporting a bug that was not there                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | webapp #67 #69                         | On dev, `exit=0`: `Lands seeded (3 labels, 20 parcels, 18 available, 1 reservation)`. Exhaust → re-seed → exhaust → re-seed, restored each time. The seed now **counts the parcels back and throws** rather than announcing. Six tails                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | None                                                                |
| F4    | The seed ran clean locally and died in the container: `Cannot find module '../libs/common/src/types/roles.enum'`. `prisma/seed.ts` runs from **source** under `tsx`, and the image copied two subdirectories of `libs/common/src`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | webapp #68                             | Seed `exit=0` in the container on `kambriq-dev-api:123`. Three tails. **Local success is not deployment success, and the two differ by a `COPY` line nobody reads**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | None                                                                |
| R1    | `where: { code: 'client' }` against a stored `'CLIENT'` — a client created by a land reservation got **no roles at all**, was emailed portal access, and was refused by every route in the portal. And `GET /users` served `[{},{},{}]` with `meta.total: 14`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | webapp #62                             | On dev `sha-f069f9d`: `/users` returns rows with real keys; a reservation creates a client holding `CLIENT`. **The literal is banned across `apps/api/src`, `libs/common/src` and `prisma/`** — mutation 2 restores `'CLIENT'`, the right value in the wrong form, and the same test fires. Seven tails                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | None                                                                |
| R2    | An invited client set their password (204) and **still could not log in** — `emailVerified` false, with no way out from their side                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | webapp #63                             | Live: set-password 204 → login 200 → `GET /lands/client/purchases` 200 with their purchase. Two tails, the second so the new field cannot displace the password and lockout writes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | None                                                                |
| P2    | A missing `await` produced `[object Promise]` in every verification link and `[{},{},{}]` from a map over an async method — same defect, two surfaces, both invisible because a Promise satisfies every shallow check                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | webapp #66                             | **Three parts, all recorded.** (1) The scanner is unsound: planting the delegating form it catches, planting an unwrapped `map(async …)` it misses, because a nested `Promise.all` sits in its window — measured, not assumed. (2) The mechanism is the **type**: `buildPaginatedResponse<T>(data: NotPromise<T>[])` makes `tsc` refuse the shipped code at **14 call sites in 10 services**, before it runs. (3) **Not covered, and named:** an async arrow in a `map` whose result never reaches that helper. A lint rule was rejected with its coverage stated                                                                                                                                                                                                                                                                                                                                                                                                                                                             | None                                                                |
| P3    | The client portal email printed the agent's raw UUID: _"Votre agent KAMNET : 00000000-0000-4000-8000-b00000000005"_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | webapp #66                             | Live on dev: **"Votre agent KAMNET : Eric Mbou"**. The agent is resolved before the email; the template omits the line entirely when there is no name; and `EmailService.send` rejects any `…Name` argument that is UUID-shaped. Three tails, including the guard over-firing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | None                                                                |
| T1/N1 | Guards and roles untested; the response envelope held on success paths and nothing else                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | webapp #65                             | Live sweep, every guarded controller: **401 / 403 / 200**, wrong role chosen against `ROLE_HIERARCHY` rather than convenience. The public surface is pinned as a list and the class-level `@Roles` on five controllers. The envelope contract **asserts on content**: it serves the `[{},{},{}]` defect from a probe route, shows every shape assertion passing on it, and fails it on content. Seven tails — the seventh weakens the _test_ and the defect-reproduction case stops throwing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | None                                                                |
| Q1    | `CERTIFIED` was set by grading, on the score alone: certified with no certificate, no `kcaNumber` and nobody's name against it. `certificate/me` answered `{"data":null}` to somebody the API called certified — and grading also granted `KCA_CERTIFIED`, which gates the KAMNET agent routes, so **passing an exam made somebody an agent before any human had approved it**                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | webapp #54                             | Live on dev, `:108` / `sha-4be405b`, same candidate either side of one admin call. **Before issuance:** `EXAM_PASSED`, `certifiedAt: null`, `nextAction: awaiting-certificate`, `certificate/me: null`, roles `[CLIENT, CANDIDATE_KBS]`. **After issuance:** `CERTIFIED`, `certifiedAt` set, `nextAction: certified`, `KCA-20260904-LNG8`, certificates 7 → 8, roles `[CLIENT, CANDIDATE_KBS, KCA_CERTIFIED]`. The role arriving with the credential and not before it is the half that mattered. Five mutations, all firing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | None — no migration, the column is a `String`                       |
| V1    | A completed sale whose agent lookup failed logged an error and returned `null`, so BullMQ marked the job **completed**: sale recorded, job green, commission never created, and the only symptom available to anybody was an agent noticing they had not been paid. All four processors did the same on an unknown job name                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | webapp #58                             | Live on dev, `kambriq-dev-api:112` / `sha-fef4391`. Enqueued `kamnet.definitely-unknown-job` on the `kamnet` queue: `BEFORE failed=0 completed=0` → `AFTER failed=1 completed=0`, `reason=Unknown KAMNET job: kamnet.definitely-unknown-job`. It landed on the **failed** set with its reason, where before it would have completed silently. **Stated limit, not closed:** the probe queue used default job options, so `attemptsMade=1` — it proves the destination, not the three-attempt retry policy. Eight tails, eight mutations, each observed failing alone                                                                                                                                                                                                                                                                                                                                                                                                                                                          | None                                                                |
| W1    | `/reactivate` was in `PUBLIC_PATHS` with no page. `lib/actions/auth.ts` redirects there on `REACTIVATION_REQUIRED`, so a user in the soft-delete grace period — undoing a deletion, on a clock — hit a 404                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | webapp #57                             | Live on dev, `kambriq-dev-web:71` / `sha-68f6c7f`: `/reactivate` **200** (was 404), `id="email"` and `id="password"` present. `days=12` → _"Il vous reste 12 jours"_; `days=1` → _"1 jour"_; `days=999999` and `days=<script>` and no `days` → the neutral _"Votre compte est encore dans sa période de restauration"_. Four tails, four mutations, each observed failing alone                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | None                                                                |
| B3    | KBS not demonstrable: `KbsQuestion` and `KbsExamQuestion` empty since the seed's single run on 2026-02-26, so the largest module (21 routes) could not be exercised                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | webapp #47 #49 #50 #51                 | Live on dev, `kambriq-dev-api:105`: quiz serves **10**, scores 100/10 and passes; exam serves **20**, `totalQuestions` 20, scores 100, `PASSED`; candidate status changed; **certificates 5 → 6** (`KCA-20260904-N4OY`) — **issued by an explicit admin call during the proof, not by passing.** The exam produced no certificate: `certificate/me` answered `{"data":null}` and the count moved only after `POST /kbs/admin/certificates/:id`. So 5 → 6 proves **issuance works when somebody triggers it**; it is not proof of an end-to-end certification chain, and the chain is deliberately not automatic (Q1). `/kbs/public/verify` returns `valid: true`. Idempotency: two local runs, identical counts. Distribution guard **demonstrated, not asserted**: forcing `9/8/8/5` fails all four banks on `<= 8`; `9/9/9/3`, the per-bank shape of a `31/31/29/10` skew, fails the same way; and `8/8/8/6` — upper bound satisfied — fails all four on `>= 7`, so both tails are observed rather than inferred. 235 tests | None                                                                |
| K2    | A candidate who passed every module was told to "finish all the modules". `checkAndTransitionToExamPending` returned silently on a null `activeCourseId` that the seed never set; `me/overview` answered `course: null` for the same reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | webapp #51                             | `EXAM_PENDING` and `eligible: true` on dev after the fix; `me/overview` returns the course. Mutation: removing the log fails 1, reverting the seed's `update` branch fails 1. `kbsCandidate.updateMany` was absent from the shared mock — the defect was shielding the gap in its own coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | None                                                                |
| K1    | A perfect quiz scored **33%**. The grader divided by the module pool (30) instead of the quiz length (10), so nobody could pass a quiz or reach the exam                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | webapp #50                             | `{"score":100,"correctCount":10,"totalQuestions":10,"passed":true}` on dev, both modules. Mutation: restoring `questions.length` fails 2, removing the completeness check fails 1. Fixtures now hold pool 30 against quiz 10 — the old ones used 2 against 2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | None                                                                |
| S2    | Every seeded identifier — 47 literals, 480 generated — was rejected by the API's own `z.uuid()`: version and variant nibbles both `0`. 23 request-body fields across KBS, KAMNET and LANDS were unreachable with seeded data                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | webapp #49                             | Quiz and exam submission accepted on dev after a clean reset and re-seed of the four databases. A test runs all 600 emitted ids through the controllers' own validator, and asserts the literal count is above 40 so an empty match cannot read as a pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | None                                                                |
| N2    | `GlobalExceptionFilter` never executed, in any environment. `PrismaExceptionFilter` is `@Catch()`, wins as last-registered, and rethrew — escaping Nest into Express's HTML error page. Every 401/403/404/500 leaked a stack and broke the envelope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | webapp #49                             | On dev: `GET /users/me` 401, `GET /nope` 404, wrong password 400 — all `application/json`, enveloped, no stack, no `node_modules`. Mutation: restoring the rethrow fails 5 chain tests while the 57 filter unit tests stay green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | None                                                                |
| E1    | Stack traces in HTTP response bodies, gated on `NODE_ENV`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | webapp #47, closed by #49              | Mutation: restoring the `NODE_ENV` branch fails 1. The larger half was N2 — my first attribution of this leak to the filter's dev branch was wrong, and the not-found middleware I added in #48 deployed and never fired                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | None                                                                |
| A3    | Every verification email carried `?token=[object Promise]`. `createVerificationToken` called without `await` on the registration path only. No user had ever been able to verify an address                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | webapp #48                             | Live on dev: signup → mail received at maildrop → `token=d5163844cd9a11ec…` (64 hex) → verify 200 → login 200. Login before verifying correctly refused. `EmailService.send` now throws on any `[object …]` argument, covering every template including ones not written yet. **The cleanest example this project has of a proof that was true and still did not cover the thing it appeared to cover:** yesterday's item-1 proof held, because that path was a **resend, not a signup**. The resend worked. The registration never had                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | None                                                                |
| S1    | Storage: `S3Client` gated on `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, never set on Fargate. Every upload and download dead on dev since February                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | webapp #44                             | Round-trip on dev, `8003ddb` / task def `:100`: presigned URL signed with `ASIAQYAF4F4JDB6N4PDM` — STS credentials from the **task role**, the thing the gate was blocking; PUT 200; `head-object kambriq-media-dev` size 35, etag `333c6389…`; download URL 200; content identical. Mutation: restoring the gate fails 7 of 47 tests in `libs/common`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | None — the IAM grants already existed in `iam-media.tf`             |
| C2    | Middleware decision untested. A redirect loop shipped May 2026, fixed by accident in August, unnoticed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | webapp #38                             | 101 tests; removing `!isPublic(pathname)` fails 18. e2e public routes 5 → 20                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | None                                                                |
| C1    | Coverage measured only over files a test already imported; `apps/web` never ran in CI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | webapp #37                             | api 70.8% → **29.8%** (16 of 60 files were measured); four modules at 0.0%                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | None                                                                |
| D1    | Prisma baseline: four dev databases under Migrate, `db push --accept-data-loss` unreachable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | webapp #34 #35 #36                     | `migrate deploy` ×4, "No pending migrations" ×4, no `db push`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | None                                                                |
| A1    | e2e uploaded an empty report every run while reporting green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | webapp #32                             | `playwright-report` 207 530 bytes, was absent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | None                                                                |
| A2    | `kambriq-infra/scripts/smoke-test.sh` died on its first passing check under `set -e`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | infra #15                              | 8 passed / 0 failed under the CI OIDC role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | None                                                                |
| L1    | The SES MessageId was logged in a metadata object that `nestjs-pino` drops                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | webapp #41                             | Mutation: restoring the object form fails 1 of 30 tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | None                                                                |
| E2    | Five variables were read through `config.get(key, default)` and declared in no schema: `FRONTEND_URL`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `AWS_S3_BUCKET`, `AWS_S3_REGION`. `validateEnv` exits on a bad value, which reads as though the environment is checked - it only checks what the schema names, and a default is what stops you finding out. `FRONTEND_URL` builds every transactional email link and falls back to `http://localhost:3001`. **Journey 1 cannot catch it**: its regex is `/verify-email\?token=([0-9a-f]{64})/`, which matches the path and the token and never the host. `.env.example` separately still declared `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (the `S1` gate), pinned `eu-west-3`, and omitted both transport switches, so a fresh clone defaulted to `EMAIL_TRANSPORT=ses` and sent real mail from localhost | webapp, branch `fix/env-contract-gaps` | `env-vars-declared.spec.ts` scans both trees for `config.get` and `process.env` reads and fails on any key absent from `envSchema`. Mutation-proved three ways, each watched failing on its own: (1) an added `config.get('KAMBRIQ_MUTATION_KEY')` fails only the last assertion, naming key and file; (2) line-anchoring the regex drops `AWS_SES_CONTACT_LIST_NAME`, failing the multi-line assertion - so the multi-line claim is demonstrated, not asserted; (3) deleting `FRONTEND_URL` from the schema fails two assertions and names both call sites. Suite 510 green, typecheck and lint clean. **Limit, stated:** this proves the variable is declared, never that its deployed value is right - that lives in the `kambriq-infra` task definition and nothing in this repo can read it                                                                                                                                                                                                                              | None                                                                |

---

## Role-grant inventory — read-only, folded into V1

V1 asks of a job: _can this report success while doing nothing?_ Pointed at
permissions the question becomes: **can a user award themselves a role by
completing an action, with no human and no verified fact in between?** Every
place in the codebase that writes a role association, and what stands between the
trigger and the grant.

| #   | Site                                                        | Trigger                                    | What stands between                                                                | Verdict                        |
| --- | ----------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------ |
| 1   | `auth.service.ts:89` → `CLIENT`                             | anybody registering                        | nothing — and nothing should. `CLIENT` is the baseline                             | Fine                           |
| 2   | `users.service.ts:414` → `CLIENT`                           | an agent reserving a land for a new client | nothing needed                                                                     | **Broken — see below**         |
| 3   | `candidates.service.ts:86` → `CANDIDATE_KBS`                | the user calling `POST /kbs/enroll`        | **nothing. Self-service**                                                          | See below                      |
| 4   | `candidates.service.ts:631` → `KCA_CERTIFIED`               | admin sets status `CERTIFIED`              | `@Roles(ADMIN_KBS, ADMIN_GLOBAL)`, `grantedBy` recorded                            | Fine                           |
| 5   | `certificates.service.ts:101` → `KCA_CERTIFIED`             | admin issues a certificate                 | `@Roles(ADMIN_KBS, ADMIN_GLOBAL)`, requires a passed **exam**, `issuedBy` recorded | Fine — this is the fix from Q1 |
| 6   | `certificates.service.ts:251` → **removes** `KCA_CERTIFIED` | admin revokes                              | admin + mandatory reason                                                           | Fine                           |
| 7   | `applications.service.ts:181` → `AGENT`                     | admin approves a KAMNET application        | `@Roles(ADMIN_KAMNET, ADMIN_GLOBAL)`, `grantedBy` recorded                         | Fine                           |
| 8   | `users.controller.ts:289` / `:313` → any role               | admin grants or revokes directly           | `@Roles(ADMIN_GLOBAL)` only                                                        | Fine                           |
| 9   | `users.service.ts:257` → replaces the whole role set        | admin updates a user with `roleCodes`      | `@Roles(ADMIN_GLOBAL)`                                                             | Fine                           |
| —   | `grading-processor.ts:183` → `KCA_CERTIFIED`                | **nothing enqueues it any more**           | —                                                                                  | Dormant — see below            |

### The answer to the question asked

**`KCA_CERTIFIED` was the only role a user could award themselves by completing
an action, and it is now closed.** Every other grant sits behind an `ADMIN_*`
guard and records `grantedBy`. Nothing else crosses an authorization boundary on
a business event.

### Three things the sweep turned up anyway

**1. A client created by a reservation gets no role at all — proven on dev.**
`findOrCreateClientUser` looks up `where: { code: 'client' }`. The stored code is
`'CLIENT'`. Postgres string comparison is case-sensitive, so the lookup returns
`null`, and `if (clientRole)` swallows it:

```
POST /lands/reservations  ->  201, clientUserId bc880e1e-…
GET  /users/bc880e1e-…    ->  ROLES: []
      (contrast, a seeded user: ROLES: ['KCA_CERTIFIED','AGENT'])
```

`@Roles(RoleCode.CLIENT)` gates `lands-client.controller.ts` — the **entire
client portal**. So the client is emailed portal access and then refused by every
route in it. The reservation succeeds, the email sends, the job is green, and the
only symptom is a client who cannot log into the thing they were just invited to.
The same `if (clientRole)` guard sits on the registration path at
`auth.service.ts:89`, which is correct only because that one spells the constant
`RoleCode.CLIENT`. **One word, one casing, one silent guard.** Not fixed here —
report only, as asked.

**2. `CANDIDATE_KBS` is self-service and gates nothing.** `POST /kbs/enroll`
grants it to the caller with no human in the loop. There is no
`@Roles(RoleCode.CANDIDATE_KBS)` anywhere in the codebase, so the role carries no
authority: it is a label, not a permission. Harmless today, and worth knowing
before somebody gates something on it and assumes a check happened.

**3. A dormant `KCA_CERTIFIED` grant.** `grading-processor.ts:183` still handles
`KBS_JOBS.GRANT_KCA_ROLE` and still calls `addRole(userId, KCA_CERTIFIED)` with
**no `grantedBy`**. Since Q1, nothing enqueues that job. The handler was kept
deliberately so that any job already sitting on the queue would drain rather than
hit V1's new "unknown job name throws" — but what remains is an unreachable code
path that grants an authorization on a score, and unreachable is one `queue.add`
away from reachable. It should go once the queue is confirmed empty of them.

### Also found, and not about roles

`GET /users` returns **`{"data":[{},{},{}],"meta":{"total":14,…}}`** — the admin
user list serialises every row to an empty object while the pagination meta is
correct. The endpoint answers 200 and looks healthy from every angle except the
one that matters. Not investigated further; recorded so it is not discovered
again from scratch.

---

## Account audit — `051551940370`, all regions, read-only

Swept on 2026-09-04 across all 17 enabled regions. **Report only; nothing was
deleted, disabled or modified.** Hosted zones excluded from the verdicts by
instruction; the Route 53 line is noted for the bill only.

**Fifteen of seventeen regions hold nothing but their default VPC and its default
security group** — ap-northeast-1/2/3, ap-south-1, ap-southeast-1/2, ca-central-1,
eu-north-1, eu-west-2, eu-west-3, sa-east-1, us-east-1, us-east-2, us-west-1,
us-west-2. All free, all AWS-created. Everything below is in `eu-central-1`
except where stated.

### Useful to KAMBRIQ

| Resource                                                       | What it is                               | Referenced by                                | Aug cost           | Verdict                          |
| -------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------- | ------------------ | -------------------------------- |
| `kambriq-dev-alb`                                              | Application load balancer, `active`      | ACM `dev.kambriq.com`, both ECS services     | $20.13             | Keep                             |
| `kambriq-dev-cluster` + 2 Fargate services                     | api and web                              | CI/CD deploys into it                        | $31.72             | Keep                             |
| `kambriq-postgres-dev`                                         | RDS `db.t4g.micro`, 20 GB gp3, single-AZ | four `DATABASE_URL_*` SSM params             | $16.88             | Keep — **but see backups below** |
| `kambriq-dev-redis-001`                                        | ElastiCache `cache.t4g.micro`, redis 7.1 | BullMQ, `REDIS_HOST`                         | $13.39             | Keep                             |
| `nat-04b75312a0fdb779c`                                        | One NAT, in `subnet-085728f14e8c9bc9c`   | private subnets `10.0.2.0/24`, `10.0.3.0/24` | $39.25 (EC2-Other) | Keep for now — X2                |
| 3 Elastic IPs                                                  | all **associated**                       | NAT + ALB                                    | in VPC $12.37      | Keep                             |
| `kambriq-media-dev`                                            | S3, 50 objects, 67 MB                    | `AWS_S3_BUCKET`, proven by S1                | $0.00              | Keep                             |
| ECR `kambriq-api` / `kambriq-web`                              | 10.4 GB across both                      | CI/CD                                        | $0.09              | Keep                             |
| 45 SSM parameters `/kambriq/dev/**`                            | app config                               | the task definitions                         | free               | Keep                             |
| ACM `dev.kambriq.com`                                          | issued, in use                           | the ALB listener                             | free               | Keep                             |
| `/ecs/kambriq-dev-api` (40 MB), `/ecs/kambriq-dev-web` (65 KB) | log groups, 7-day retention              | the services                                 | $0.00 in Sept      | Keep                             |

### Another project's, sitting in this account

| Resource                                         | What it is                                                      | Referenced by                                  | Cost                       | Verdict                                                                       |
| ------------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------- |
| 3 customer-managed KMS keys                      | all described `production-fotomena-eks cluster encryption key`  | **nothing — the EKS cluster no longer exists** | $5.99 Aug, ~$3/mo standing | Not KAMBRIQ's. Somebody who knows fotomena should decide                      |
| `/aws/eks/production-fotomena-eks/cluster`       | log group, 0 bytes, 90-day retention                            | nothing                                        | $0.00                      | Debris from the same cluster                                                  |
| `aws-ecs-linux-cluster` (**eu-west-1**)          | ECS cluster: 0 instances, 0 services, 0 tasks                   | nothing                                        | free                       | Empty, not KAMBRIQ's                                                          |
| 20 SSM parameters `/Dorigine/**` (**eu-west-1**) | Firebase, recaptcha and mail keys for a project called Dorigine | nothing in this repo                           | free                       | Not KAMBRIQ's — **contains secrets, so worth a decision rather than a shrug** |
| `kloudnat-infra-shared-store`                    | S3, 6 objects, 305 KB                                           | Terraform remote state                         | $0.00                      | Shared tooling, keep                                                          |
| Route 53                                         | 11 hosted zones; 10 are not KAMBRIQ's                           | —                                              | ~$5.50/mo of the $7.59     | Excluded by instruction, noted for the bill                                   |

### Debris

| Resource                                                     | What it is                                   | Cost  | Verdict                                |
| ------------------------------------------------------------ | -------------------------------------------- | ----- | -------------------------------------- |
| `kambriq-artifacts-b9321a78`                                 | S3, **0 objects**, not declared in Terraform | $0.00 | Created outside IaC, never used        |
| `kambriq-logs-b9321a78`                                      | S3, **0 objects**, not declared in Terraform | $0.00 | Same                                   |
| `/ecs/kambriq-dev`                                           | log group, 0 bytes                           | $0.00 | No such service; a renamed leftover    |
| `/aws/ecs/containerinsights/kambriq-dev-cluster/performance` | log group, 0 bytes, 1-day retention          | $0.00 | Left by the Container Insights removal |
| `RDSOSMetrics`                                               | log group, 0 bytes, 30-day retention         | $0.00 | Enhanced monitoring is off; harmless   |
| default VPC `vpc-388b5c52` (eu-central-1) + 15 more          | 0 instances each                             | free  | AWS-created, unused                    |

### Three findings that are not about cost

**1. An unused `AdministratorAccess` key.** `gitops.admin` holds
`AKIAQYAF4F4JLEEQ5ARN`, **Active**, created 2026-02-24, `LastUsedDate: None` —
never used once. It reaches `AdministratorAccess` through the `gitops-admin`
group, of which it is the only member. A full-admin credential that has never
been used is one nobody would notice being used. This is the audit's most
important line and it costs nothing to hold.

Two more never-used active keys: `ses-kambriq-app` (`AKIAQYAF4F4JNP3WKQMQ`) and
one of `kambriq-app-dev`'s pair (`AKIAQYAF4F4JLQKD3DWT`). The other
`kambriq-app-dev` key last saw `s3` on **2026-08-27** — before S1 removed static
credentials from the API, so nothing should be using it now either.

**2. `kambriq-postgres-dev` has `BackupRetentionPeriod: 0`.** No automated
backups, no point-in-time recovery. That is defensible for a disposable dev
database — it is a saving, and I reset it deliberately today — but it should be a
recorded choice rather than a default nobody looked at, and prd must not inherit
it.

**3. `/aws/rds/instance/kambriq-postgres-dev/postgresql` has no retention.**
`retentionInDays: None` means never expire; it holds 5.85 MB and grows. Every
other log group here is capped at 7 or 30 days. Costs nothing today, unbounded by
construction.

### What the bill actually is

August, excluding tax: **$164.83**. September month-to-date at day 4: $23.07
excluding tax.

A flat projection would put September at ~$173, and that is wrong: **Route 53
hosted-zone fees are charged once at the start of the month**, so the $5.51 sat
in the first four days is already the whole month rather than a seventh of it.
Multiplying it by 7.5 invents $36. The usage-based lines — ECS, ELB, RDS,
ElastiCache, NAT, VPC — do project linearly, and they land close to August.

**Not ours, and standing:** ~$3/mo of KMS for a cluster that no longer exists,
plus ~$5/mo of hosted zones excluded by instruction. Call it **$8/mo of a
~$165 bill that belongs to somebody else** — real, small, and not where the money
is. The money is NAT ($39), ECS ($32), ALB ($20), RDS ($17) and ElastiCache
($13), all of which are load-bearing today.

**CloudWatch is confirmed at $0.00 in September**, from $14.55 in August, and
`containerInsights` reads `disabled` on the cluster itself. Checked at the source
rather than assumed.

---

## The habits this register enforces

> **The defect catalogue is section 3 of the brief at the top of this file.** It
> is the part still worth reading in six months, because every entry cost a day
> to find and none of them is specific to this week's code. What follows is the
> reasoning behind the entries, kept here because the catalogue states the
> pattern and this states why it keeps happening.

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

**A test can defend a bug as firmly as it defends a fix.**
`grading-processor.spec.ts` asserted `returns null for unknown job types`. It was
green **for exactly as long as the defect existed**, and it would have failed the
day somebody fixed it — the test standing between the codebase and its own
repair. This is the strongest form of the pattern found this week: not a test
that cannot fail, but a test that fails when the code becomes correct. The
assertion was accurate about the code and wrong about the requirement, and
nothing in a green suite can tell those two apart. When a test blocks a fix, read
the requirement before you read the test.

**A fixture that cannot distinguish the thing being tested from the thing it is
compared against.** Three of this week's defects survived on it, and it is the
measurement pattern again, inside the tests themselves: `submitQuiz` used a pool
of 2 against a quiz of 2, so `correctCount / pool` and `correctCount / quizLength`
were the same number; `global-exception.filter.spec.ts` calls the filter
directly, so it proves the filter and never that the filter is reached;
`kbsCandidate.updateMany` was absent from the shared mock and nothing noticed,
because the defect returned before reaching it. In each case the fixture
collapsed the very distinction it existed to check. A test whose two candidate
explanations produce identical output has not chosen between them.

**Reading the first element of a list is not reading the list.** I fetched the
invited client's mailbox, read `inbox[0]`, found no link, and was one sentence
from filing _"the invite email carries no link"_ as a defect — which would then
have been investigated as one. There were **two** messages; the newest was the
portal notice and the invite, with a valid 64-hex token, was the second. Same
family as the other measurement defects: **a conclusion drawn from a sample and
presented as a reading of the whole.** The others in this family from the same
week: an invented route (`/kamnet/me`) whose 404 was read as a missing guard,
when a route that is not there cannot be unguarded; and a root URL built without
its trailing slash, which the ALB handed to the web app, whose 404 page was read
as the API's.

**A success line that never printed is not a success.** Twice today I read a
result from the numbers I expected to move rather than from the process that
produced them: a seed exiting 1 whose parcels had already been restored, and an
exit code taken from `tail` because the command was piped. **Check the status,
and check that the thing you were waiting for actually appeared** — absence of a
line is not the same as absence of a problem.

**Gate on the commit, never on the revision number.** I waited for
`kambriq-dev-api` revision `>= 106`, read `COMPLETED`, and took the Q1 proof
against `:107` — which carried `sha-db5c1a7`, the **docs-only PR that merged
before it**. The revision advanced for a reason unrelated to the change I was
proving, so the proof measured the old build and appeared to show the fix
failing. Wait for the running task definition's image tag to equal
`sha-$(git rev-parse --short HEAD)`. A monotonic counter is not an identifier of
what is in the build.

**One mutation proves one expectation. An assertion with several tails needs one
mutation per tail, each observed failing on its own.**

This is a rule for every proof written from today, W1 and V1 included. It comes
out of the per-bank distribution bounds, which assert two things —
`>= floor(N/4)` and `<= ceil(N/4)`. Two mutations were run through that
assertion, `9/8/8/5` and `9/9/9/3`, and both were reported as proving it. Both
only ever produced `Expected: <= 8, Received: 9`. **Jest stops at the first
failing expectation**, so the lower bound never executed in either run: half the
guard was decorative while the proof looked complete. It took a third shape,
`8/8/8/6` — nothing above 8, one position at 6 — before `>= 7` was ever seen
firing.

The general form: a mutation tells you that _an_ expectation caught it, never
that _the_ expectation you had in mind did. So for each expectation in an
assertion, construct the input that violates that one and leaves the others
satisfied, and read the actual `Expected/Received` rather than the test name.
If a tail cannot be violated in isolation, say so in the register instead of
counting it as proven.

A good deal of this week's mutation work has this shape and is not being
re-audited before Monday — the rule binds new proofs, and retrofitting waits.

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

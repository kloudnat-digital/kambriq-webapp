# The chantier register

Opened cold, this is the state of the platform. The delivery checklist first, then
every chantier at its true state, then the dated decisions somebody must act on.

**Last closed: Wednesday 24 September 2026.**

**This file is the record, and there is no second one.** Between 18 and 23
September the work of PRs #155 to #162 was written into a `WAVE_STATUS.md` at
the repository root instead of here, so for five days two documents described
the platform and disagreed: this one still read _"Last closed: Friday 4
September"_ and carried no mention of `I38`, `I42`, `I17`, `P9`, `P20`, `P21`,
`A38` or `P11`. **The file every session is told to trust was the stale one.**
Those chantiers are entered below, the wave note is archived under
`docs/ops/waves/` and marked frozen, and `register-is-the-record.spec.ts` fails
if a second record appears.

Three further defects in this document were found while folding the wave in, and
all three are fixed here: the `## Open` table existed **twice**, each copy
carrying rows the other lacked and each being edited by different people; `H1`'s
entry had lost its heading, so its body hung off the end of that table; and the
states table declared four states while the document used eight.

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

| When                                 | What                                                                                                                                                                                                                                                                                                                                                                                                                                | How                                                                                                                                                                                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tuesday 8 September 2026**         | Deactivate `AKIAQYAF4F4JH34UGKU5` (`kambriq-app-dev`). It is the only key left Active besides `vmiaff`'s, and unlike the three deactivated on 4 September it **has** been used — `s3`, 2026-08-27, before `S1` moved storage onto the task role                                                                                                                                                                                     | **Check first, then act.** `aws iam get-access-key-last-used --access-key-id AKIAQYAF4F4JH34UGKU5`. Still 2026-08-27 or older → `update-access-key --status Inactive`. **Anything more recent → stop** and find out what used it before touching anything |
| **When prd exists**                  | RDS `BackupRetentionPeriod` is **0 on dev, deliberately** — what a backup protects is reproducible from `migrate deploy` ×4 plus a restorative seed. **Every word of that argument dies with the first real user account.** Belongs on the `ADR-005` bootstrap checklist as an explicit decision, not a default carried over                                                                                                        | Set a retention period before prd takes traffic                                                                                                                                                                                                           |
| **Done, 27 September**               | `/aws/rds/instance/kambriq-postgres-dev/postgresql` is capped at 7 days, set **outside Terraform** because RDS creates that group itself. It is undeclared state — nothing drifts today, and the next person reading the Terraform will believe every log group is described there                                                                                                                                                  | Declared in `modules/rds-postgres` (both export groups, `postgresql` and `upgrade`, 7 days) and imported on dev - infra #68 applied ("1 imported, 1 added, 1 changed, 0 destroyed"), import block removed by #69, plan "No changes"                       |
| **Before an agent is paid anything** | `C15` - the council's opinion on **when a commission is acquired**. Reserved to Visquis, in the "avant ouverture" set beside the legal items. Recorded here on 24 September from the 2026-09-21 entry of `ops_kambriq_base-comprehension_v01.md`, because nothing in this repository carried it                                                                                                                                     | Visquis asks the council. `C14` cannot be settled first, because the answer **is** the calculation base                                                                                                                                                   |
| **After `C15`**                      | `C14` - the **commission grid, which does not exist**. The parcel spreadsheet computes on TPC = 6 %, the UX specification announced 3 % on the sale and 1 % on the reservation, and the platform has no rate at all: 5 % lives in three seed literals and a comment. Visquis decided on 19 September that the grid is **never on the public site** and is visible only inside an agent's own space, which is what `P21` implemented | Settle the grid, then implement it once in code rather than in literals. Until then **no surface may state a rate** - that is what `P21` enforces                                                                                                         |
| **Not scheduled**                    | `X2` — the NAT gateway. **Applied on 12 September** as infra D15 (dev has no NAT gateway); this line said "not applied" until 26 September. See the X2 entry                                                                                                                                                                                                                                                                        | Nothing to apply. The net saving, after per-task public IPv4 hours, is read on the bill (Visquis)                                                                                                                                                         |

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

| State               | Meaning                                                                               |
| ------------------- | ------------------------------------------------------------------------------------- |
| `A DECIDER`         | Arbitration missing. **Stop and report.** Do not choose.                              |
| `DECIDE, A FAIRE`   | The arbitration is in the entry. **Execute it without asking again.**                 |
| `A FAIRE`           | No arbitration needed. The work is described and nobody has started it.               |
| `EN COURS`          | Started, not proven. The pending proof is named in the entry.                         |
| `PLAN PRET`         | The change is written and a plan has been run and shown. **Nothing applied.**         |
| `PROUVE LOCALEMENT` | Proved by execution on a developer machine. **Not yet observed on a deployed build.** |
| `PROUVE`            | Closed, proof quoted, taken against the environment the entry names.                  |
| `ARRETE`            | Stopped before completion. The entry says what stopped it and what unblocks it.       |

**Eight, and until 24 September this table declared four.** `PROUVE LOCALEMENT`
was carried by fourteen entries, `ARRETE` by two and `PLAN PRET` by one, none of
them defined anywhere, so a reader had to guess whether "proved locally" was a
weaker `PROUVE` or a stronger `EN COURS`. It is neither: it is the state where
the code is proved and the deployment is not, and it is the one most likely to be
read as finished. `register-is-the-record.spec.ts` fails on any state this table
does not declare.

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

| Entry                          | State               | What it needs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `L2`                           | `PROUVE`            | one deployed log line carrying its interpolated metadata, quoted **Tracker correction, 27 September:** the pending proof is on dev since L3 - e.g. `{"context":"CleanupScheduler","pattern":"0 7 * * *","msg":"Contact digest cron scheduled"}`, metadata carried and queryable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `L3`                           | `PROUVE`            | log payloads are top-level JSON fields: one pino `hooks.logMethod` (`core/logging/structured-fields.ts`) lifts the single `%o` object every call site passes, instead of rewriting 161 calls. Pending: a field queried in CloudWatch Insights on dev                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Errors logged under err        | `PROUVE`            | an error object is logged under `err`, where pino-http writes its type, message and stack. Thirteen call sites lost it (ten dropped it, three wrote `{}`), against the seventh round's "no call site does it"; fixed, and `log-errors-in-err.spec.ts` refuses both shapes. Pending: one error line read on dev with its message and stack **Eleventh round:** failed queue jobs logged only the message string; `LoudWorkerHost` now logs `err`. Pending: one failed job on dev read with its stack **Proven on dev, 27 September:** one harmless failed job (`kamnet.sale-completed`, unknown agent) logged `err.type Error`, `err.message` and `err.stack`, payload excluded                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `F1`                           | `A DECIDER`         | coverage ratchet: a floor, and what happens when a PR drops below it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `P1`                           | `A DECIDER`         | SES contact list, one per account per region — the prd constraint                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `X2`                           | `PROUVE`            | NAT option 2 - **already applied on 12 September** as infra D15 (dev has no NAT gateway, tasks in public subnets); the "unapplied" state here was stale. No live NAT gateway on 26 September. The net saving is partly taken back by per-task public IPv4 hours and is read on the bill (Visquis)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `M1`                           | `DECIDE, A FAIRE`   | mutualisation of dev and future prd, with per-resource saving and blast radius                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `Q1` follow-up                 | `A DECIDER`         | `generateKcaNumber` says _sequential per day_ and emits a random suffix; `CANDIDATE_KBS` is granted self-service and gates nothing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `D3`                           | `PROUVE`            | the four Prisma baselines, deleted by `d099cd1` and restored here - pending proof is one deploy from this branch whose migration task exits 0 **Tracker correction, 27 September:** every deploy since the restore has run the migration task on the four baselines and passed; today's task (stream `api/api/24022681…`) reads `5 / 3 / 3 / 9 migrations found`, `No pending migrations to apply` for core, kamnet, kbs, lands                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `H1`                           | `PROUVE`            | `ADMIN_GLOBAL` is the super admin; no second role created. ADR-008 + `super-admin.spec.ts`, five mutations quoted below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `H2`                           | `PROUVE`            | proven on dev on `f91289f`: `2 created, 0 updated, 0 unchanged`, exit 0, tally read from the task's own log stream                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `H3`                           | `EN COURS`          | journey 5 green on dev under the sha gate; **pending proof is the two real holders activating their own accounts**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `H4`                           | `PROUVE`            | the last active super admin cannot be removed through any of four doors - live 409 on each, four mutations quoted below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `A7`                           | `PROUVE`            | inventory swept 2026-09-06, output in `docs/ops/a7-standards-inventory.md`: 6 findings (2 closed on sight), 7 classes clean, 2 defects in the sweep                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `H2` follow-up 1               | `EN COURS`          | **tracker correction, 27 September:** the row described the state before #116 (A9, `95b4e69`, 14 September), which made the seed step call `prisma/seed.ts` by name; `--seed` exists nowhere now. A9's proof was taken on a **manual** one-off task, not on the deployment step. Pending: a deploy with `run_seed=true` - which clears the seeded parcels' reservations that carry no payment, so it waits for Visquis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `H2` follow-up 2               | `PROUVE`            | the bootstrap deploy step now requires its task's tally line in the task's own log stream after the exit code (`scripts/ci/await-task-tally.sh`, proven against a fake `aws`); the deploy role may read that one log group (infra #67, applied on dev 27 September). Pending: one develop deploy printing the tally from the step **Proven on dev:** the deploy of `61388d9` printed `Kambriq super-admin bootstrap complete: 0 created, 0 updated, 2 unchanged`, read by the step from the task's own log stream                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Migration step tally           | `PROUVE`            | the migration deploy step checked only its task's exit code. `run-migrations.js` now prints `Kambriq migrations complete: <n> schemas (...)` after every schema migrated and never otherwise, and the step reads it with `await-task-tally.sh`. Pending: one develop deploy printing it **Proven on dev:** the deploy of `e540c86` printed `Kambriq migrations complete: 4 schemas (core, kamnet, kbs, lands)`, read from the task's own log stream                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `H5`                           | `PROUVE`            | journey 5's address guard was a detector, not a barrier: it reported and let the run continue into a real inbox. Moved to `beforeAll`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `H6`                           | `PROUVE`            | the same run's `afterAll` revoked a real administrator's role. Every write audited, role restored 16:05:26, guard made structural                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `H7`                           | `PROUVE`            | nothing tested the bootstrap's role assignment - journey 5 granted it to itself. Decision extracted and covered, 11 tests, 3 mutations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `H8`                           | `EN COURS`          | the bootstrap sent no email; a stray test made it look as though it had. Fixed and proven locally; pending the re-send to `contact@` on dev                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `H8` follow-up                 | `A DECIDER`         | per-address SES delivery is not observable: no configuration set, no event destination. Needed to answer "did THIS address receive it"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `H9`                           | `PROUVE`            | the bootstrap's provenance check failed a whole deploy and skipped every later step. Postcondition scoped; step moved after the web deploy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `B1`                           | `PROUVE`            | payment code audited against the design: 0 payments ever processed, no payment table, G3/G4 partly built, six of eight not started                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `A10`                          | `PROUVE`            | the identity-review queue did not exist - the route and the role did. Queue route + `idSubmittedAt`; the back-office screen stays open                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `A11`                          | `PROUVE`            | 13 sites, 15 messages, 12 transactional. `sendUpdate` returns an outcome and throws on a transactional template                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `A12`                          | `PROUVE`            | the WhatsApp preference removed from the API and the web, the column kept. A test fails if it returns, or if a sender appears                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `R1`                           | `EN COURS`          | **a merge can succeed and have no effect.** `#89` merged into a branch consumed 89 s earlier; `#88` was squash-merged, so nothing showed. Pending proof is the three commands in `R1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `G8`                           | `PROUVE`            | **proven end to end on dev, 27 September** (journey 7, opt-in, `balance-journey.spec.ts`): one reservation, deposit and balance each taken INITIE to VALIDE through the back office - instructions, announcement, verification, a receipt resting on its proof in S3, validation - balance = total minus deposit, nothing owed. The 7 September stop (G11-G14 stranded) was closed by #92                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `G21`                          | `PROUVE`            | cancelling a reservation annuls its live payment, with a written reason (Visquis, 27 September - was `G8` follow-up). Built through `PaymentsService.transition`: actor, reason, ledger untouched; a VALIDE payment stays VALIDE. Proven on the real migrations; pending: journey 4 on dev, which now cancels a reservation holding a live deposit **Proven on dev:** the delivery journeys on `b063685` (29 passed, 6 opt-in skipped), journey 4 reading its deposit back `ANNULE` with the cancellation reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `G22`                          | `PROUVE`            | an annulled, rejected or expired payment showed its amount due under "Reste", as if still owed. `outstandingOf` (libs/common) is the one rule at all five reads: nothing outstanding once a payment no longer asks for money; what it received stays on its ledger. Pending: the back office read on dev **Proven on dev (`sha-bec5ebd`):** 46 annulled payments, all 0 outstanding, the one with a receipt still showing it received; 6 live requests still owe their amount                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `G8` blocker                   | `PROUVE`            | the exposure closed on 7 September: `230b827` (#89) merged into a consumed branch and was re-landed the same day as #92 (`5c35aa2`, on develop, code-identical). This row stayed open 19 days after the fix. A test now pins that only the chosen channel's details leave. **G8 itself stays open**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `G10`                          | `PROUVE`            | applied and observed: 16 SecureString parameters none empty, task definition 143 with the three variables and no channel value, 0 AccessDenied                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `G9`                           | `PROUVE LOCALEMENT` | the client creates the payment, from their own purchase page. Creation writes its audit row; sending the instructions is a second act                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `G9` follow-up                 | `A DECIDER`         | `PAYMENT_VALIDITY_DAYS` is 30 because a month is the shape of a diaspora transfer. The design gives no number - this one needs deciding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `G10` (webapp)                 | `PROUVE`            | an absent channel prefix now fails the boot exactly as an empty parameter does; disabling is `PAYMENT_CHANNELS_TRANSPORT=disabled`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `G10` (infra)                  | `PROUVE`            | twelve parameters and the prefix, applied: on 26 September the running API (`kambriq-dev-api:250`) carries `PAYMENT_CHANNELS_SSM_PREFIX`, and 13 SecureString parameters exist under `/kambriq/dev/api/payment-channels` (names and types read, no value). The row said "nothing applied"; `G10` and G8 Part 1 had recorded the apply (revision 143)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `G4`                           | `PROUVE`            | the back office and its screen. Five defects only a real request could see; `db:seed` unbroken; deployed-dev pass deferred to `G8`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `G4` follow-up                 | `PROUVE`            | **tracker correction, 27 September:** done on 14 September by #119 (A15, `ccafc87`) - `GetLandUploadUrlDto` and `GetCourseUploadUrlDto`, two contracts, not merged; dev's API log holds 0 "Duplicate DTO" lines in 7 days. What was missing was a guard: `dto-names-unique.spec.ts` reads every source file and fails on a name declared twice (A15's defect planted back fails it)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `V1` follow-up                 | `PROUVE`            | the commission lookup throws now but has never run: 0 sales completed, all 5 commissions seeded. Closed by inspection only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `B2`                           | `PROUVE`            | V1 inventory finished: WhatsApp preference reads nothing, `sendUpdate` skips indistinguishably and defaults off, `RedisService` unused                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `B3`                           | `PROUVE`            | 56 dev parameters against 0 on prd; only 7 injected as secrets, so 49 need an apply to take effect. One confirmed unread, the rest candidates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `B4`                           | `PROUVE`            | 4 journeys: VERIFY does not exist; reactivation and block/unblock never run; 57 identity documents queued for a review that has never run                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `G1`                           | `PROUVE`            | payment model in `lands`: BigInt money, 9-state machine, append-only ledger and audit. Proven on dev by G8's end-to-end run, 27 September                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `G2`                           | `PROUVE`            | the reference generator: 29-char derived alphabet, mod-29 check character, sequence-backed so collision-free by construction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `G3`                           | `PROUVE`            | the instruction and reminder messages, channel details from SSM at runtime, send-before-transition. Real email read out of a mailbox                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `G10b` (infra)                 | `PLAN PRET`         | sixteen channel parameters; the twelve existing ones imported so `ignore_changes` bites on the first apply. **Apply before merging #88**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `G10b` follow-up               | `EN COURS`          | D9: `MOBILE_MONEY_OPERATOR/NUMBER/NAME` dropped from `FIELDS`, proved locally (boot on the nine, mutation names the MISSING one). Pending: deploy, API task steady and `/health` answering without them; then infra #51 (step 4, three destroys) with validation. Cost: none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `G11-G14`                      | `PROUVE LOCALEMENT` | six channels, the identification gate, A14's review screen, coordinates in the platform. Email carries none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `G11` follow-up                | `A DECIDER`         | infra owes `ORANGE_MONEY_*` and `MTN_MONEY_*`: v03 splits mobile money in two but keeps twelve parameters with one number                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `G11` follow-up 2              | `A DECIDER`         | v03 section 5's example uses a hyphen between reference and channel, which section 4b forbids. 4b implemented                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `A18`                          | `PROUVE LOCALEMENT` | queue counts and failed payloads on `/health/queues`, ADMIN_GLOBAL. `failed` 0->1 observed through the endpoint against a real Redis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `L1-contact`                   | `PROUVE LOCALEMENT` | the public contact form sent nothing behind a success toast. Now persisted, announced, acknowledged in the page's locale; consent stored with its timestamp                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `L2-contact`                   | `PROUVE LOCALEMENT` | a daily digest on the existing core queue, sent even at zero, so its absence is the alarm. **On dev it failed every morning, silently, until 26 September**: `CONTACT_INBOX_EMAIL` was unset, the job threw, BullMQ kept it as a failed job and no line was logged (16 failed jobs on the core queue, names not read). First send on dev: 26 September 07:00 UTC, count 0. Delivery can only be seen in `contact@`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `A54`                          | `EN COURS`          | a failed queue job writes an error-level line (every processor, by a shared base class, pinned by a guard), and the API refuses to start without `CONTACT_INBOX_EMAIL`. Proven on dev: `sha-603e6ab` started with the variable required. Pending: the first real failure seen as a line                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `L1-contact` f-up              | `PROUVE`            | **Stale until 28 September:** infra #66 (26 September) put `CONTACT_INBOX_EMAIL` on the dev API; task definition `kambriq-dev-api:291` carries it. The row still said infra owed it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| naming                         | `A DECIDER`         | the brief's `L1`/`L2` collide with this register's logging `L2`/`L3`. Entries above are `L1-contact`/`L2-contact`; somebody should decide which series keeps the bare letter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `A31`                          | `PROUVE`            | the seed kept payment-carrying reservations and reset their parcels to AVAILABLE; fixed in #126. Read on dev, 26 September: 0 parcels AVAILABLE under a live reservation, and develop's journeys green all day. The seed itself has not run on dev since (opt-in) - the state it protects holds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `verify-cert`                  | `EN COURS`          | `/verify-certificate` said "valide" for any number; the API ignored `revokedAt` and handed strangers the holder's UUID. Pending proof on dev: seeded number valid, fake number non reconnu, revoked number révoqué. Cost: none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `A33`                          | `PROUVE`            | cause named and fixed: the sign-in fields were controlled inputs, and text typed before hydration was wiped by it - WebKit on the runner was the engine slow enough to hydrate late. Fields uncontrolled, every password form POSTs, WebKit back in the matrix. Proven: develop's E2E run on `8637543`, WebKit included, 186 passed, none flaky                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `J12`                          | `PROUVE`            | the five sign-in and account forms refused in English on the French pages; their schemas now carry keys under `auth.validation`, fr and en (#219). Proven on dev (`sha-a19d680`): an empty sign-in shows "Saisissez une adresse email valide." and "Le mot de passe est requis." on `/fr/login`, the English ones on `/en/login`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `A55`                          | `PROUVE`            | did real passwords reach the logs before #214? No server-side record on dev can hold one: no ALB access logs, no CloudFront or WAF, and the web container logs no request URL (the API's request log does, and holds no password or token in any URL: corrected under D28) - my own password-in-URL requests of 26 September are absent (the control). The referer carried the origin only. The one place such a URL can remain is the visitor's own browser history. Rotation stays Visquis's call                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `D28`                          | `PROUVE`            | who called what, when, from where. **Decided by Visquis, 27 September:** dev = application logging with an allowlist; production = a WAF (`C17`); retention 7 days dev, 30 days production, stated in the privacy policy. **Dev built:** one allowlist (`libs/common/src/logging/url-allowlist.ts`) applied before any write; the API line gains the visitor's address and the account id; the web proxy writes one JSON line per page request. Pending: the A55-style control on dev **Proven on dev (7197137), 27 September:** the A55-style control found 0 markers in either log group and every marker request logged as `[redacted]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `I45`                          | `PROUVE`            | the invitation every new client receives, and the email-change confirmation, linked to pages that did not exist (404 on dev). The invitation now links to `/reset-password`; the confirmation to a new `/account/confirm-email-change` page, and the login detour keeps the token. `emailed-urls-resolve.spec.ts` checks every URL the API builds on `FRONTEND_URL` against the web's pages, inverted. Pending: both links walked from the email in a browser on dev (`emailed-links.spec.ts`) **Proven on dev (`sha-61388d9`), 27 September:** both walks green in Chromium from the delivered emails - the invitation to a password to a sign-in; the confirmation opened signed out, the login detour back to it, confirmed, the new address signing in and the old one refused                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `A56`                          | `PROUVE`            | `@nestjs/throttler` 6.7.1 in the lockfile (#249, range unchanged). 6.5.0 cancelled every caller's hit expiries when any block ended, refusing legitimate callers below the declared limit, cumulatively; the reproduction is red on 6.5.0 and green on 6.7.1. **Proven on dev, 28 September (7ad301f):** the one 429 on `/auth/login` in the run was the journeys runner's eleventh sign-in in sixty seconds (two of them deliberate 401s) - the limit of ten, counted exactly. The walks' caller got none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `A67`                          | `PROUVE`            | a test that an environment variable switches off must run somewhere: `env-switched-tests-run-somewhere.spec.ts` fails on any skip whose condition reads a variable no workflow sets, unless it is declared with its reason (`RUN_BALANCE_JOURNEY` only). From Ulrich's reading of 27 September: `RUN_EMAILED_LINKS` outlived its cause for days, and `RUN_PAGE_WALKS` did the same until #255                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `C20`                          | `PROUVE`            | SES production access is **granted** in eu-central-1 (review `GRANTED`, case 176441524300857): 50 000 a day, 14 a second, 636 sent in the last 24 h on 28 September. prd is planned in the same account and region, so it inherits it. Account-level suppression on bounce, complaint and optimized; no configuration set, so the API sees no bounce event                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `C24`                          | `PROUVE`            | the application now learns that an address bounced: every SES send names the configuration set, SNS delivers BOUNCE and COMPLAINT events to `POST /email/ses-events`, which verifies the SNS signature and topic and stores one `EmailDeliveryEvent` per recipient, linked to the account; `GET /users/:id` carries the latest. **Proven on dev, 28 September (731d432, infra #71 and #72):** an account registered at the SES mailbox simulator's bounce address showed `BOUNCE Permanent/General` on its admin read 3 seconds after its verification email, the same SES message id in the send and the bounce log lines. Not yet rendered by any screen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `C26`                          | `EN COURS`          | the bounce C24 stores was shown by no screen. The payment screen, where instructions are sent, now carries the latest bounce or complaint for the client's current address: a permanent bounce or a complaint is shown in red and the send waits for the operator to confirm the client was told another way; a transient bounce is shown in amber without a gate. Warned, not blocked, because the coordinates are published on the client's space and the email only announces them. Pending: the browser proof on dev, which needs a payment whose client's address bounces - no product flow can produce one (see the entry)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `C22`                          | `A DECIDER`         | Actions minutes, measured for September and **corrected on 28 September**: GitHub lists reused jobs under a re-run's new attempt, and the first count billed them twice. Excluding them, the webapp used 5 738 exact minutes against a bill implying ~5 694 (0.8 % apart; infra 181 against ~346 does not close), so the bill is exact minutes and per-job rounding is not in it. Public repositories are not metered at all (infra `CLAUDE.md`, 16 September). Re-runs were 80 minutes, not 676; PR runs are cancelled when superseded since #95. The private switch is postponed, so the cuts save nothing today                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `#48` prd trust                | `A DECIDER`         | infra #48 extends the APPLY role's trust to `environment:prd`, but since D16 a plan runs under `<env>-plan` with the PLAN role, so it would not make #46's Plan (prd) authenticate: that needs the plan role to trust `environment:prd-plan` and an `AWS_ROLE_ARN` secret in `prd-plan`. A `prd` environment already exists (24 February, no protection rules); nothing on develop can select it. Not merged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Journeys bypass the page       | `PROUVE`            | the delivery journeys prove by calling the API what a person does through a page: email verification, forgot-password, the invitation (until I45), KBS identity and enrolment, every back-office payment step. By construction the page a human uses is the one path not proven. Which of them deserve a browser walk is a decision, not a fix to squeeze in **Decided by Visquis, 27 September: walk every human path on every deploy** - done as I46                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `I46`                          | `PROUVE`            | the human paths walked through the pages on every deploy, Chromium: registration and email verification, forgotten password, KBS enrolment, the payment page's identity upload, the back office taking a deposit from request to validation, and both emailed links. Continuous since #255. **Proven on dev, 28 September (952991e):** all six walks pass and the API log holds **no 429 on any route, for any caller**, across the journeys and E2E (279 requests, 23 successful sign-ins) - after #262 made the journeys sign each seeded account in once per run                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `I47`                          | `PROUVE`            | **Decided by Visquis, 27 September: in the payment page.** Built: the payment page's "waiting for identity" state carries the upload (`IdentityDocumentUpload`), through the same identity actions as KBS enrolment (moved to `lib/actions/identity.ts`), storing the key (A49). The French and English wording is proposed copy for Visquis. Pending: the chain walked on dev from the page - upload, back-office review, instructions sent **Proven on dev (`sha-8d7084b`), 27 September:** the whole chain walked in Chromium - request on the purchase page, identity document uploaded on the payment page, verified in the back office, instructions sent, receipt recorded, deposit validated                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `C17`                          | `DECIDE, A FAIRE`   | before production opens: a WAF on the load balancer, logging with the query string redacted at write time, 30-day retention stated in the privacy policy (Visquis, 27 September; D28's production half). Production is his                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `A32`                          | `EN COURS`          | Gate reads develop's HEAD sha, then its run (`scripts/ci/develop-gate.sh`): green passes; red, never started or not yet verified refuses; label `merge-on-red-develop` plus re-run releases. v1 read a list and passed #134 on a stale run; 12 stub cases run in every CI Gate. Cost: each develop push blocks merges ~20 min                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `A36`                          | `PROUVE`            | develop red on `70a5e07`: both journey suites run in one `runInBand` process from one runner address and `getTracker` keys on the last X-Forwarded-For entry, so they legitimately share one bucket of 100 requests per 60000 ms - the gap between them decides it (9.33 s PASSED on `1cbde1a`; 0.36 s and 0.35 s FAILED on `70a5e07`). `call()` now waits one full window and retries, bounded at 3 attempts, one log line per wait, still throwing today's sentence after them. The comment claiming CI "never sees it" is replaced by the measurements. `getTracker` had no test and now has 11, watched failing on `parts[0]`. The spec runs in `Quality` via a new `test` target, because `api-e2e` had none and the file would otherwise execute only in the job it repairs. Pending: a green `Delivery journeys (dev)` on develop. Cost: up to 120 s added to a journeys job that is actually throttled, none otherwise **Tracker correction, 27 September:** the pending green `Delivery journeys (dev)` on develop has been had on every develop run of the day - `b063685`, `61388d9`, `e4fdfd4`, `daddcd9` among them (29 passed each) - with `call()` waiting out the throttle window as built                                                                   |
| `I19`                          | `PROUVE`            | no user without a role - fixed in code (#132). On dev, 26 September: the three missing role rows (`STAFF_VERIFY`, `STAFF_VALUATION`, `PARTNER_GEO`) added from the seed's own definitions, and the two role-less throwaways of 4 September given `CLIENT`, what registration gives. 11 role rows, 0 users without a role; no reservation touched                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `I15`                          | `PROUVE`            | the certificate is the truth (#133). Read on dev, 26 September: the expiry sweep runs every night at 02:30 UTC - 'Expired certifications withdrawn' logged on 22, 23, 24, 25 and 26 September, 0 to withdraw each time                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `I18`                          | `PROUVE`            | one definition of the roles (#134, #140); the proxy is the one gate. Read on dev, 26 September: unauthenticated `/fr/admin/payments`, `/en/agent/network` and `/fr/account` answer 307 to the sign-in page                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `I20`                          | `PROUVE`            | lessons need a candidate record (#136). Read on dev, 26 September: the admin fixture, which holds CANDIDATE_KBS by inheritance and never enrolled, gets 404 'You are not enrolled in KBS' on a lesson; a client without the role gets 403; no session, 401                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `I7`                           | `PROUVE`            | ADMIN_GLOBAL inherits STAFF_VERIFY (#137), pinned by test before any route uses it. Nothing on dev to observe yet: no route is gated by STAFF_VERIFY, and dev has no STAFF_VERIFY role row (see I19)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `I16`                          | `PROUVE`            | CLIENT in its own right (#138). Read on dev, 26 September: 5 of 5 users holding AGENT also hold CLIENT                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `I15` renewal                  | `PROUVE`            | a renewal issues a new certificate (#139). Read on dev, 26 September: migration `20260915160000_i15_certificate_renewal` applied on dev on 15 September 18:08:22 UTC, not rolled back                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `I21`                          | `PROUVE`            | an exam is answered only on the questions it served (#143). Read on dev, 26 September: 148 graded exams, highest score 100; no exam holds more answers than questions served                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `I31` seuils                   | `PROUVE`            | exam threshold 80, quizzes 70 (#150). Read on dev, 26 September: all 73 exams created since the merge carry passingScore 80                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `G6`                           | `PROUVE LOCALEMENT` | the dunning queue, reminders at J-7 and J-1, EXPIRE at the term. Found and fixed a processor collision that silently ate a reminder email                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `R4`                           | `EN COURS`          | back to hosted runners under a spending cap. Baseline measured: 27 billed minutes, of which the quality matrix billed 5 to do 102s of checking                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `R3`                           | `EN COURS`          | CI moved to the self-hosted `kambriq-ci` runner. No `services:` anywhere, so macOS is viable. Exposed three image builds pinning no platform - amd64 held by accident of `ubuntu-latest`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `A17`                          | `PROUVE LOCALEMENT` | a database-backed suite, `pnpm test:db`: 51 tests against a real Postgres; both append-only triggers and all five CHECKs proved sharp by removal and restoration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `G7`                           | `PROUVE LOCALEMENT` | `evidenceReceiptId` filled end to end; NULL deliberate and documented for the other states; the single write path to `Payment.state` pinned, mutation red                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `G5`                           | `PROUVE LOCALEMENT` | a correction entered from the back-office screen: three movements, total 500 000 over four lines, original line unchanged. Correction carries its own reason and author                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `G11` follow-up 3              | `PROUVE`            | the controller never forwarded `paidBy`: a DEPO keyed on the screen was refused by the service. Fixed and pinned here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `P3`                           | `PROUVE LOCALEMENT` | the auth middleware was a global net: every unknown URL redirected to /login and nothing could 404. Positive matcher, real 404 page, route table proved unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `P4`                           | `PROUVE`            | X-Robots-Tag noindex outside production, on the existing headers() block. Reads APP_ENV: NODE_ENV is 'production' on every environment and cannot tell them apart. Second half (API responses): PROUVE on dev 23/09; P4 stays below 100 % until D13                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `P5`                           | `EN COURS`          | `/kamnet/apply` is wired to `POST /kamnet/applications` (#193), the floor first (#192); proven on dev in a real browser - stored, page shows the real status, applicant mailed, `contact@` notification accepted by SES once `CONTACT_INBOX_EMAIL` was set (kambriq-infra #66). Pending: Visquis confirms that notification arrived in `contact@`. No admin screen lists applications. The login wall stays (P3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| rename                         | `A DECIDER`         | `L1-contact`/`L2-contact` -> `P1`/`P2` was asked for in P3's brief; those ids have since reached develop with PR #98 (`L1-contact`, `L2-contact` entries). Not done - see PR                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `A19`                          | `PROUVE`            | develop linted 1 project of 6 for seven months: the workflow promised "the full set", `pnpm run lint` was `nx lint api`. Widened to `nx run-many -t lint --all`; manifest corrected; proved in both directions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `I32`                          | `PROUVE`            | the API decides the network depth by the caller's own tier (`KAMNET_NETWORK_DEPTH_BY_TIER` in `libs/common`, bounded by `KAMNET_MAX_SPONSORSHIP_DEPTH`); the page asks without a depth. Proven by test with the maximum raised, since on dev every tier and the maximum are 1 and the rule changes no answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `P10`                          | `EN COURS`          | the agent-page promises of an exclusive catalogue: two replaced with the copy Visquis validated on 26 September (#200); the last two (`products.kbs.advantages.network`, `products.kamnet.agentJourney.step5`) replaced with copy he approved on 26 September, the first with the title "Candidater au réseau KAMNET™" / "Apply to join KAMNET™" (English approved 27 September) - #206. The pin reads both product pages, not named keys - #200's version named three strings and missed a third on the same page. Still open: the LANDS page rewrite (#174, held for his reading of the deployed page) **#206 merged 27 September (79e4569); read on dev:** /fr/products/kbs shows "Candidater au réseau KAMNET™", /en/products/kbs "Apply to join KAMNET™"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `P21` follow-up                | `PROUVE`            | **premise corrected:** `landTypes` was in the list; the earnings ban read only `products.kamnet`/`products.kbs`, and its pattern missed "Commission rapide" and the infinitive "gagner des commissions" (a second survivor, `quickActions`). Guard rebuilt inverted - every namespace watched unless declared exempt with a reason - and it names both; the words removed (deletion only). Pending: the deployed LANDS page read on dev **Proven on dev (96edf6c):** /fr, /en, /fr and /en/products/lands, /fr/products/kamnet carry the new wording and none of the old                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `A41`                          | `PROUVE`            | a rate limit each, chosen from 7 days of measured traffic; `auth-anonymous-routes-throttled.spec.ts` reads the @Throttle metadata, red first on five undefined routes, eight mutations each watched failing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `P22`                          | `PROUVE`            | the public directory reads every certificate in one query, not one per agent, and is bounded by `KAMNET_MAX_PUBLIC_DIRECTORY_ENTRIES` with a warning at the cap; proven on dev at `sha-caf8f98`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Audit 2026-09-23, wave 1       | `EN COURS`          | four security fixes on `chore/audit-remediation`, unmerged. The fifth finding, the API bearer token in the RSC payload, is **closed by wave 5** - `sessionForClient` strips it and `lib/session.spec.ts` plus the login journey pin it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Audit 2026-09-23, wave 2       | `EN COURS`          | `GET /kbs/me` scoped to the active course, `no-console`, `strict` on the API, two seed preconditions. Unmerged; pending proof is `GET /kbs/me` read on dev                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Audit 2026-09-23, wave 3       | `PROUVE`            | the wave of #155 to #162 folded in, the Open table de-duplicated, the states declared, `register-is-the-record.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Audit 2026-09-23, wave 4       | `EN COURS`          | the acompte step reads the payment ledger instead of answering for it. Unmerged; pending proof is one acompte carried end to end on dev                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `G19`                          | `PROUVE`            | decided by Visquis on 26 September and applied (#210): `Land.totalPrice` is the source of truth, `Land.pricePerM2` is generated by the database from it and cannot drift; nothing multiplies by the surface. Proven on dev: the 480 m2 parcel reads 3 400 000 total, 7 083 per m2, deposit 170 000, balance 3 230 000                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Land price integer money       | `PROUVE`            | `Land.totalPrice` and the price history move from Float to BigInt (whole XAF), the last land price held as a floating-point number; the response envelope turns a BigInt into an exact number. Pending: the migration read back on dev                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Payment purpose in back office | `PROUVE`            | G20's purpose (`ACOMPTE` or `SOLDE`) was only visible in the database; the four back-office payment reads now return it and the payment list, the payment detail and the request queue show it. API proven on dev (all four reads); the screens read on dev with a balance beside a deposit still pending - dev holds no balance payment yet. **Row restored 26 September:** #225 merged without it - the register conflict resolver kept only rows whose id is in backticks **27 September:** dev now holds one (G8, reservation `474807f6-…`, deposit and balance VALIDE); the screen read needs a signed-in browser on the back office **Tenth round:** the signed-in browser read on dev stays Visquis's - not worked around with a scripted admin sign-in **Proven 27 September** in the back office on dev, signed in as the seeded test administrator: list, both details and the request queue (screenshots)                                                                                                                                                                                                                                                                                                                                                         |
| Deposit integer money          | `PROUVE`            | `LandReservation.downPaymentAmount` from Float to BigInt (whole XAF), still deprecated by G1 and kept; the float-money quarantine drops to one (`KamnetCommission.amount`). Pending: the migration read back on dev Proven on dev 26 September: `bigint`, deposits unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Signed-in price smoke          | `PROUVE`            | the gap Land price integer money left: its proof rested on a database read and the journeys, since every lands route needs a session. The delivery journeys now read a parcel signed in and require its total to arrive as a whole, exact JSON number matching the database's own `pricePerM2`, and the client's deposit and money summary likewise. Pending: the first develop run with it green Proven: delivery journeys 29/29 on `6193d29` under the sha gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Commission integer money       | `PROUVE`            | `KamnetCommission.amount` from Float to BigInt (whole XAF), the last monetary Float in the four schemas: the float-money quarantine is empty, pinned at zero. Pending: the migration read back on dev Proven on dev 26 September: `bigint`, 6 commissions, sum 2 270 000 unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `confirmRemainingPayment`      | `EN COURS`          | G20, built (#218): every payment states its purpose, one live payment per reservation and purpose, each money step asks for its own, the balance is the total minus what the deposit received. Read on dev, 26 September: all 38 payments `ACOMPTE`, the default dropped. Pending: a balance exercised on dev, once a reservation reaches step 4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `A52`                          | `PROUVE`            | a KBS candidate's CV is a key in their own CV folder, refused otherwise at enrolment, by the A44/A49 rule in `core/users/storage-keys.ts`; proven on dev at `sha-d5fd78e`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `A53`                          | `PROUVE`            | the unrendered land search and compare components, `MOCK_LANDS`, their store and `StatCard` are deleted; the I44 pin keeps the invented values as literals. Proven by develop's run on `844cf32` (after #199): Quality, deploy, journeys and E2E green. The two namespaces only they read, `landSearch` and `landsCompare`, are removed, with a guard that every namespace is read                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `A51`                          | `PROUVE`            | the Firefox language-switch E2E test failed inside its own style injection, blocked by the CSP; rewritten to switch from the keyboard with no injection, 10/10 in Firefox against dev; proven on develop's own run, first attempt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `I44`                          | `PROUVE`            | `/admin/lands/search`, `/admin/lands/compare` and `/admin/verify` showed invented parcels, requests and statistics; each now says it is not built, and a test pins the invented values out; proven on dev at `sha-d90e9cb`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `J11`                          | `PROUVE`            | the typeface's stylesheet and font hosts reach `style-src` and `font-src` from the same module as the image hosts, and the layout links it from there; proven on dev at `sha-87b1d13`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `P29`                          | `PROUVE`            | the API's catalogues - every email and notification - carry the product marks, read by P27's own guard; proven on dev with delivered mail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `A48`                          | `PROUVE`            | every API behaviour decision reads `APP_ENV` through `libs/common/src/config/app-env.ts`; SQL is logged only where `APP_ENV=local`; a guard refuses a new `NODE_ENV` read; proven on dev at `sha-3425132`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `A49`                          | `PROUVE`            | an identity document is a key in its owner's `id-documents` folder, refused otherwise, through the A44 rule now shared in `core/users/storage-keys.ts`; proven on dev at `sha-23a2b97`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `P27`                          | `PROUVE`            | KAMBRIQ LANDS™, KAMBRIQ VERIFY™ and KAMNET™ carry the mark everywhere on the website, KBS does not; a guard watches every namespace and every MDX file; proven on dev at `sha-e059503`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `A44`                          | `PROUVE`            | an avatar is a key in the caller's own storage folder, refused otherwise on both write paths; `connect-src` names the bucket so the browser may upload; proven on dev at `sha-689bd2e`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `A43`                          | `PROUVE`            | Swagger is served only where `APP_ENV=local` is declared, never from `NODE_ENV`; the local start scripts declare it; proven on dev at `sha-7ec907b`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `P24`                          | `PROUVE`            | the land title number is shaped `TF <number>/<department>` and validated by shape in the web form and the API; invented formats replaced; proven on dev at `sha-85c8966`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `P25`                          | `PROUVE`            | the verify price table was the only MDX element outside the component map; two consent sentences were split into columns by a flex label; proven on dev at `sha-828c509`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `I43`                          | `PROUVE`            | ten signed-in screens promised 38 unbuilt features in hardcoded French; the promise is removed and a guard reads every `.tsx`; proven on dev at `sha-383828e`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Audit 2026-09-23, wave 5       | `EN COURS`          | locale-prefixed routing: every page under `[locale]`, `localePrefix: 'always'`, the proxy gate asked positively, the RSC token leak closed, 48 `next/link` and 35 `next/navigation` imports moved to `@/i18n/navigation`, `revalidatePath` given its prefix. Proved locally over HTTP (`/` -> 307 `/fr`, `/pricing` -> 404 not a login redirect, `/de/about` -> 404, `/fr/mylands` -> `/fr/login`) and by 55 browser tests. Unmerged; pending proof is the same table read on dev                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Audit 2026-09-23, wave 6       | `EN COURS`          | SEO: `app/sitemap.ts` (30 URLs, hreflang + x-default), `app/robots.ts`, canonical and alternates on all 15 public pages, JSON-LD where there was none, metadata on the four legal pages and `robots: noindex` on the six auth pages. Both files read `APP_ENV`, never `NODE_ENV`. Unmerged; pending proof is `/robots.txt` and `/sitemap.xml` read on dev                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Locale switcher coverage       | `PROUVE`            | J4 / P16: `QuickActions` on every public page, guarded by default (#197); the switch also sets a signed-in person's account language, announced with the way back, and a visitor changes only the page (#201). Proven on dev, web `sha-65521db`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Built-in 404 above the locale  | `PROUVE`            | P31, decided by Visquis on 26 September: the route group. Every page is in `[locale]/(site)`, whose layout refuses an unknown locale below the branded boundary. Proven on dev (`sha-e1b965f`): `/pricing` and `/de/about` give the branded 404, HTTP 404, in the visitor's language; all seventeen public pages 200 with the language switch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| develop merged into waves 5-6  | `EN COURS`          | develop's 9 commits merged 25 September: 8 text conflicts, six new page files relocated under `[locale]`, three components moved off `next/link`/`next/navigation`, `revalidatePath` calls given their prefix, `image-hosts.spec.ts` unblocked (25 assertions that ran none), `A41` reconciled. Unmerged to develop; pending proof is the routing table and the sitemap read on dev                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Wave 7                         | `EN COURS`          | steps 0-3 done: `PolicySnapshot` append-only by trigger, proved by removal; `POST /cms/webhooks/sanity` writes it, authenticated by HMAC over the raw body; `frame-ancestors` behind a validated `SANITY_STUDIO_ORIGIN`; the Studio, the GROQ contract pinned from both sides, the webhook created by script, and the Sanity hosts scoped by project. the 16 documents converted out of mdx and committed as ndjson, delivery through `@sanity/client` (`next-sanity` refused on a measured 1846-entry install), the KBS labels moved to fields, and consent bound to an archived revision. Step 4 (the blog) deferred by decision of 2026-09-27: a blog is a collection and every type in the Studio is a singleton, so it is a different shape rather than another slug. the delivery path is proved against a throwaway project - 16 documents answering the shipped query with no token, ten routes read over HTTP at 200 with no renderer warning and no contract error. **Decided 2026-09-27: the content is written in the Studio, not imported**, so a new environment's pages answer 404 until somebody writes them. **Pending proof: nothing is deployed.** The project, the two build variables, the Studio deploy and the webhook secret are the owner's actions |
| `A4`                           | `EN COURS`          | the commissions service has 15 unit tests, 5 mutations watched failing. Pending: nothing computes a commission, so `amount` cannot be checked against `pv` and `tpc` until the formula is decided. Question for Visquis in the entry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `A5`                           | `EN COURS`          | `#246` added four browser walks. Two of the row's four are still not walked: the candidate's certification path, and an agent creating a reservation. Both are held by the API journeys                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `A21`                          | `EN COURS`          | reproduces on 2 of 4 full-suite runs. `--detectOpenHandles` names no handle and implies `--runInBand`, so it removes the condition. A narrowing to 8 specs was offered and withdrawn. Pending: a cause, measured as a rate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `A34`                          | `ARRETE`            | CLAUDE.md conflicts on every parallel pair, 3 097 lines against 2 698 in this merge. Closes with `A39`, which Visquis blocked                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `A35`                          | `A DECIDER`         | a pull request is still never built into an image: `gate` needs only changes, commitlint, quality and test-db. Build on every PR, or only where an image can break - the `changes` job already computes that shape for `test:db`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `A39`                          | `ARRETE`            | blocked by Visquis on 22 September: the premise is a private repository and both stay public to month end. Reminder 1 October                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `A42`                          | `A DECIDER`         | next 16.3.6 and sharp 0.35.4 landed in `#176`. One question: the before-and-after page comparison cannot be taken, so either today's pages become the reference or the row closes without it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `D28` follow-up                | `PROUVE`            | the request log masked the URL, the query and the referer but not the route params, and `maskUrl` cannot mask a path at all. Params masked, and `no-credential-in-a-route-path.spec.ts` stops the route existing - proved by declaring `@Post('reset/:token')` on a real controller and watching it named                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| envelope BigInt                | `PROUVE`            | `jsonSafe` walked plain objects only, so a BigInt inside a class instance was a **500**, reproduced at 200-vs-500. It now walks any object without its own `toJSON`; a Date is pinned so the fix cannot eat every `createdAt`. Three mutations, one assertion each                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `sort` as a column             | `PROUVE`            | `paginationQuerySchema` accepts any string and 12 sites spread it into `orderBy`, so a client typo was a 500. `sortField` refuses with a 400 naming the allowed set; no caller anywhere passes `sort`, so nothing working stops working. A sweep fails on a 13th site written the old way                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Audit 2026-09-23, unwaved      | `PROUVE`            | **Closed by other work, found 28 September.** `/admin/verify` (I44) and `/kamnet/apply` (P5, #193) are no longer mocks; the Mapbox build `ARG` reaches both web builds since #252 (`ci.yml`, `manual-deploy-dev.yml`, pinned by `build-vars-reach-the-image.spec.ts`); the placeholder company details (`Capital social : XXX XXX XAF`, `N° RCCM : XX / XXX / XX`) left the site with the mdx in #252 and survive only in `initial-content.ndjson`, which no environment loads. The legal-mentions document written in the Studio needs the real ones                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| register                       | `A FAIRE`           | one row has no `###` entry: `P10`, whose entry is in #174 (held for the LANDS copy). Twenty-one were written on 26 September. The list is pinned in `register-is-the-record.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### H1 - `ADMIN_GLOBAL` is the super admin, and there is no second one - `PROUVE`

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

### A17 - tests that open a database - `PROUVE LOCALEMENT`

**Cost impact: None.** No new dependency, no new container. The suite uses the
Postgres already declared in `docker/docker-compose.yml` and creates one more
database on it. CI will need a `services: postgres` block on the job that runs
it, which is a hosted-runner container and costs the job's minutes, nothing
else.

**Not a register entry until this chantier.** The brief named "the A17 register
entry"; there was none. The G5/G7 assessment closed by saying the harness was
"a scoping decision for whoever schedules the next chantier" and nobody had
scheduled it. It is scheduled and delivered here, first, because G5 and G7
both rest on it.

## What was chosen, and why

**A dedicated database on the docker-compose Postgres, migrated by the real
migration files, run by a separate jest target.**

- `pnpm test:db` - one command. `docker compose up -d --wait db`, then
  `nx run api:test-db`. The suite's `globalSetup` creates `kambriq_lands_test`
  if it is absent and runs `prisma migrate deploy` against it. **The migration
  files are the thing under test.** A harness that installed the triggers by
  some other route would prove the harness.
- `*.dbspec.ts`, matched only by `apps/api/jest.database.config.cts`. `nx test
api` still opens no connection and runs anywhere; the 43 unit suites did not
  change shape.
- **The name must end in `_test` or the suite refuses to start.** It inserts,
  updates and deletes rows to prove the database refuses it; dev holds real
  people's accounts (`H6`) and a suite that could be pointed at it by an
  environment variable would be, once.
- `KAMBRIQ_DB_TEST_RESET=1` (or `pnpm test:db:reset`) drops and recreates it.
  That is how a scratch migration used for a sharpness proof is undone.

**Testcontainers was not chosen**: a new dependency and an image pull per run,
to reproduce a container the repository already declares. **A migration-time
`pgTAP` was not chosen**: it would test SQL from SQL and leave the service out,
and G7's proof needs the service's `transition()` writing into a real table.

**What it costs.** First run on a machine with the compose stack up: 12 s wall,
of which 4 s are the tests; the rest is the compose health wait, creating the
database and applying the five migrations. Subsequent runs: the same 12 s,
`No pending migrations to apply`. After a reset, the same. Cold start of the
compose stack adds whatever Postgres takes to become healthy, ~10 s here.

## What it exercises, and the proof each is sharp

Two clients, deliberately. Prisma writes the fixtures - a land, a reservation, a
payment, so the generated types vouch for them. **`pg` sends the assaults as
SQL.** The triggers exist to refuse "a script, a console, or the next developer
in a hurry"; a raw `UPDATE` is that caller, and the SQLSTATE comes back
unwrapped.

Every guarantee was removed in a scratch migration
(`99999999999999_scratch_<name>/migration.sql`), the suite run, the red read,
the scratch deleted, the database reset, and the suite run green. All nine, the
same afternoon, scripted so none was skipped:

| Removed                                                      | Red                          | Every failure reads        | Restored |
| ------------------------------------------------------------ | ---------------------------- | -------------------------- | -------- |
| `DROP TRIGGER "PaymentReceipt_append_only"`                  | **3 failed**, 38 passed / 41 | `Received has value: null` | 41 / 41  |
| `DROP TRIGGER "PaymentTransition_append_only"`               | **3 failed**, 38 passed      | `Received has value: null` | 41 / 41  |
| `DROP CONSTRAINT "PaymentReceipt_evidence_required"`         | **7 failed**, 34 passed      | `Received has value: null` | 41 / 41  |
| `DROP CONSTRAINT "Payment_reference_format"`                 | **5 failed**, 36 passed      | `Received has value: null` | 41 / 41  |
| `DROP CONSTRAINT "Payment_currency_iso4217"`                 | **5 failed**, 36 passed      | `Received has value: null` | 41 / 41  |
| `DROP CONSTRAINT "PaymentReceipt_currency_iso4217"`          | **5 failed**, 36 passed      | `Received has value: null` | 41 / 41  |
| `DROP CONSTRAINT "PaymentReceipt_depo_requires_payer"` (G11) | **3 failed**, 38 passed      | `Received has value: null` | 41 / 41  |
| `DROP CONSTRAINT "Payment_channels_are_selectable"` (G11)    | **2 failed**, 39 passed      | `Received has value: null` | 41 / 41  |
| both `PaymentReminder` triggers (G6)                         | **2 failed**, 39 passed      | `Received has value: null` | 41 / 41  |

`null` is what `attempt()` returns when the database **accepted** the
statement. That is the whole failure: the UPDATE went through. The three
receipt-trigger failures are the UPDATE, the DELETE, and the note-only edit
that G11's migration was refused for; the seven evidence failures are the bare
case plus one per selectable channel, so no channel is exempt.

The 41 above are the two A17 files. The suite is **51 tests in 4 files** with
G5's and G7's added below, 51 / 51 green on the final run.

**Also in the suite, and not asked for:** the CHECK is asserted by its own name
(`constraint: 'PaymentReceipt_evidence_required'`), so a row refused by a
_different_ rule cannot pass the test; `HIST` with no proof is accepted, so the
exception is proved to exist and not only the rule; a reference built by
`buildReference()` is accepted by the SQL regex, which runs the TypeScript
alphabet against the hand-written SQL one instead of comparing them as text;
and an INSERT on each append-only table succeeds, so the sharpness of the
UPDATE tests is not a side effect of a table nobody can write to.

## Two defects the harness found on its way in

1. **The controller never forwarded `paidBy`.** G11 added the payer to the DTO,
   the service, the CHECK and the form; `PaymentsAdminController.recordReceipt`
   built the service input by hand and left it out. A `DEPO` receipt keyed on
   the screen with its payer filled in would have been refused by the service
   for having none. Every layer had its test; **the seam between two of them
   had none.** Fixed; `payment-back-office.spec.ts` now pins every field of
   that call.
2. **A test that read a superseded migration.** _the database CHECK is the
   backstop, and still confines the exception_ asserted
   `'INCONNU_HISTORIQUE'` in G1's file - a constraint G11 dropped and
   re-created against `HIST` on 7 September. Green for two days about a
   definition no database carried. Re-pointed at G11's file; the behaviour is
   now exercised rather than read.

## Gate - LOCAL ONLY

`pnpm test:db` 4 / 51. `nx test api` 43 suites / 575 tests, `nx test common`
16 / 290, `nx test web` green, both typechecks clean, `nx lint api` clean,
`nx lint web` the one pre-existing warning. **No CI run has confirmed any of
it** - the organisation's Actions quota is exhausted. CI still has to: add a
Postgres service to the quality job and run `nx run api:test-db` there; and
show the suite green on a runner that is not this machine.

---

### G7 - piste d'audit immuable: "sur quelle preuve", and one door - `PROUVE LOCALEMENT`

**Cost impact: None.** No column added; the column existed and was never
written.

Assessed on 7 September (`docs/ops/g5-g7-assessment.md`) as a small chantier
with four remaining items. Re-checked against `develop` at `aa721f0` before
anything was built: G9 had since closed the creation row (every trail now
starts at `INITIE`), G6 had added nothing to the trail, and the other three were
still open. Two are closed here; the immutability clause is A17's.

## "Sur quelle preuve" - filled, and NULL where it is deliberate

`EVIDENCED_STATES = { PARTIELLEMENT_RECU, VALIDE }` in
`libs/common/src/payments/payment-state.ts`, beside the other sets, with the
reason for every state that is **not** in it written on the constant. The
design's own words decide membership: those two are the states that say money
was "constatee **et prouvee**", and _prouvee_ is a justificatif on a ledger
line.

`assertTransitionIsEvidenced(to, evidenceReceiptId)` throws when either is
entered with no receipt. It sits in `transition()` with the other guards, so
every door - the send, the back-office step, `validate`, the dunning sweep -
passes it. `assertReceiptBelongsTo` then reads the receipt back and refuses one
that is not on this payment's ledger: an audit row pointing at somebody else's
encaissement answers "on what basis" with a document about a different sale,
which is worse than NULL.

**What happens with no receipt behind the step: NULL, and it is an answer.**
`INSTRUCTIONS_ENVOYEES` records its evidence in `communicatedDetails`;
`ANNONCE_CLIENT` is the client's word, a claim not a proof; `EN_VERIFICATION`
has established nothing yet; `REJETE` and `ANNULE` rest on a named person's
reason; `EXPIRE` is the calendar. A receipt may be _offered_ on those steps and
is never _demanded_ - demanding one would have operators attach the nearest
line to satisfy a field, which is how a trail fills with evidence of nothing.
The screen says it in words: _"sans preuve rattachée — cette étape ne repose
sur aucun encaissement"_.

Reached end to end: `transitionPaymentSchema` and `transitionAsAdmin` accept
it (the four-of-five-steps gap the assessment measured), `validatePaymentSchema`
**requires** it, both screen controls carry a picker built from the ledger with
nothing preselected, and the trail renders the receipt by date and amount with
its proof link.

## One door to `Payment.state`

`single-state-write-path.spec.ts` walks `apps/api/src`, `libs/common/src` and
`prisma/`, finds every Prisma write to the `payment` model, and requires that
**exactly one** sets `state`: `transition()` in the payments service. It also
requires that write to sit in the same `$transaction` as the
`paymentTransition.create`, every guard to run before the transaction, and no
raw SQL to touch the table. The failure names the file and the method, not a
count.

**Mutation (d), run 2026-09-09.** `expireWithoutTrail()` added to
`DunningService` - one `payment.update` with `state: PaymentState.EXPIRE`, no
guard, no audit row:

```
● exactly one Prisma write sets state, and it is transition() in the payments service
  - Expected  - 0
  + Received  + 1
    Array [
  +   "apps/api/src/lands/payments/dunning.service.ts :: expireWithoutTrail() :: payment.update",
      "apps/api/src/lands/payments/payments.service.ts :: transition() :: payment.update",
    ]
Tests:       1 failed, 5 passed, 6 total
```

Reverted: 6 / 6. The first run of this mutation reported the method as
`MUTATION()` - the doc comment above the method had been read as its name.
Comments are stripped before the enclosing method is looked for now, and the
mutation was run again to see the right name.

## Proof (c), through the screen, locally

Payment `KBQ-2609-CY44P-2` on the local database, driven through the real
back-office page by a Playwright script kept outside the repository (the CI
e2e job runs against deployed dev, and this writes payments). The trail after
`EN_VERIFICATION -> PARTIELLEMENT_RECU`, as rendered:

```
EN_VERIFICATION → PARTIELLEMENT_RECU le 9 septembre 2026 à 19:44
Deux encaissements constatés, un corrigé
par 00000000-0000-4000-8000-b00000000001
sur preuve : encaissement du 2 septembre 2026 de 200 000 XAF (c24633ec) — Ouvrir le justificatif
```

The four earlier rows each read _sans preuve rattachée_. Read back from the
table: `evidenceReceiptId = c24633ec…` on that row, NULL on the other four.
And `audit-trail-evidence.dbspec.ts` proves the same through the service into
the test database, including that the row **cannot be re-pointed afterwards**
(`23001`) - G7.2 meeting G7.1d.

## Not done here, on purpose

The four-eyes rule stays where the design left it: _"Option a trancher plus
tard, pas maintenant."_ The seam is unchanged.

## Gate - LOCAL ONLY

As A17's. CI has to confirm the api suite on a clean runner.

---

### G5 - journal des mouvements: the correction, from the screen - `PROUVE LOCALEMENT`

**Cost impact: None.**

Assessed as a formality with one real gap and one test debt. The debt is A17's
(`ledger-total.dbspec.ts`); the gap is closed here.

## The correction, entered from the back office

`record-receipt-form.tsx` carries a picker, _"Cette ligne corrige un
encaissement existant"_, built from the ledger on the page; nothing typed,
nothing preselected. Choosing a line makes the note _"Motif de la correction
(obligatoire)"_ and the button _"Enregistrer la correction"_. v03 §7:
_"elle porte sa propre raison et son propre auteur"_ - the reason is the note,
required for a correction by the DTO and again by the service; the author is
`recordedBy`, whoever is signed in. The proof is still required: for a
correction it is the piece that shows the error.

The service refuses a correction with no reason, one pointing at a line on
another payment, and one pointing at a line that does not exist - each before
anything is written. **It appends.** `recordReceipt` contains one
`paymentReceipt.create` and no update; the unit test now sweeps every `data:`
block in the service for a total, and the database refuses the edit if
anything gets past it.

## Proof (b), through the screen, locally

Same payment, same script. Three lines entered on the page: 200 000 (2 Sept),
150 000 (5 Sept), then a correction of the second, **-50 000**, reason
_"Confirmation OMO lue 150 000, montant réel 100 000 (saisie erronée)"_. The
ledger as rendered, then read back from `PaymentReceipt`:

```
id       | amount | receivedAt | corrects | note
5d17007b | 200000 | 2026-09-02 |          |                       <- an earlier run of the same script
c24633ec | 200000 | 2026-09-02 |          |
e99347db | 150000 | 2026-09-05 |          |
3a709230 | -50000 | 2026-09-05 | e99347db | Confirmation OMO lue 150 000, montant réel 100 000 (saisie erronée)

SUM(amount) = 500000      Montant dû 340 000 · Encaissé 500 000 · Reste à percevoir -160 000
```

The original 150 000 line is there, unchanged, and the correction points at it.
The screen marks it _(correction)_. **The first line is itself evidence**: it
was recorded by a run of the script that failed at its second upload, and
nothing - not the failed run, not the next one - could remove it. That is the
property.

`ledger-total.dbspec.ts` proves the same in the test database: three lines sum
to 2 500 000 by `sumReceipts` and by `SUM()`; the corrected line re-reads
unchanged; "fixing" it is refused with `23001`; and
`UPDATE "Payment" SET "totalReceived"` fails with `42703` - there is no column.

## Gate - LOCAL ONLY

As A17's. The web build is typechecked and linted locally; no CI run has built
the image.

### L1-contact - the contact form sent nothing, and said it had - `PROUVE LOCALEMENT`

**Cost impact: None.** One table in an existing database, one route on an
existing controller surface, one job name on an existing queue consumed by the
existing processor. No new queue, no new Redis, no new dependency.

> **Naming.** The brief calls this chantier `L1 + L2`. This register already
> uses `L2` and `L3` for the **logging** series (`L2` - logging drops metadata
> at 106 call sites, `EN COURS`). They are unrelated, so the two entries here
> are `L1-contact` and `L2-contact`. **Somebody should decide which series keeps
> the bare letter** before a third arrives; recorded rather than resolved
> unilaterally.

## The premise, checked before anything was built

An external UX/CRO audit dated 9 September reported the form as submitting
nothing behind a success toast. Every claim was verified against the code
first, and every one held:

| Claim                                                       | Verdict       |
| ----------------------------------------------------------- | ------------- |
| handler: `preventDefault`, `setTimeout(800)`, toast, reset  | **Confirmed** |
| no fetch, no server action anywhere in the component        | **Confirmed** |
| `<select required>` visually hidden at ~1 px behind trigger | **Confirmed** |
| subject `<label>` has no `for`; trigger has no `aria-label` | **Confirmed** |
| no consent checkbox, no privacy link                        | **Confirmed** |
| no `autocomplete` on name / email / phone                   | **Confirmed** |
| phone placeholder is `+237 6 XX XX XX XX`                   | **Confirmed** |

Measured rather than read, on the component as it stood:

```
ACCESSIBLE NAME OF SUBJECT TRIGGER: "" (length 0)
  aria-label      : null
  aria-labelledby : null
NATIVE SELECT present: true
  required    : true
  aria-hidden : true
  tabindex    : -1
  style       : position: absolute; border: 0px; width: 1px; height: 1px; ...
LABELS:
  "Nom complet *" for="c-name"
  "Sujet *"       for="null"
FORM checkValidity() with empty subject: false
  #c-name autocomplete=null   #c-email autocomplete=null   #c-phone autocomplete=null
  phone placeholder : +237 6 XX XX XX XX
```

**Two refinements the audit did not draw, and one is worse than reported.**

1. **With no subject chosen, the form did not even show its false toast.**
   Native constraint validation runs _before_ the submit event, so
   `checkValidity()` returning `false` meant the handler never ran at all. The
   button did nothing, silently, and the browser could not display its own
   message either because the control it wanted to annotate was 1 px and
   `aria-hidden`. The fake toast was the _better_ of the two paths.
2. **`subscribeNewsletterAction` is a thinner precedent than the brief
   suggests.** It is four lines wrapping `api.post`, with no server-side
   validation of its own and one hard-coded English error string for every
   failure. What is genuinely reusable is its _shape_ - a discriminated result
   the screen renders - and that shape is what this follows. Its error handling
   is deliberately **not** copied: see below.

## What decides success, and why the emails do not

**The write.** A `201` means the row exists; the toast fires on nothing else.
The two emails are queued afterwards and **their failure does not fail the
request**: the lead is already safe, and answering "not sent" to somebody who
wrote three paragraphs makes them send it again and gives us the same lead
twice.

That is only defensible because a lost notification cannot go unnoticed - the
daily digest counts **rows**, not messages. Without the digest this would be a
silent failure; with it, it is a delayed one. The trade is written here because
it is the kind of decision that reads as carelessness to whoever finds it next.

## `CONTACT_INBOX_EMAIL`, and a decision with a cost

No default, and no real address in the repository: it comes from SSM per
environment, like every other identity.

It is **optional** in `envSchema` rather than required, deliberately. Required
is the loudest option and would refuse to boot an API that cannot announce a
lead - and it would also take the deployed API down on the next release, before
kambriq-infra has added the parameter, in exchange for a form that is strictly
better than the one it replaces. So instead:

- a request still persists, and the prospect is still acknowledged;
- the service logs at **`error`**, naming the variable, rather than skipping
  quietly - a degraded path is an explicit setting, never an inference from
  absent configuration;
- there is **no fallback to `EMAIL_FROM`**: a guessed address is a lead in a
  mailbox nobody reads;
- the **digest throws** rather than resolving, so it lands on the queue's
  failed set where `A18`'s `/health/queues/failed` can read it.

**Follow-up for infra:** add `/kambriq/{env}/api/CONTACT_INBOX_EMAIL` and wire
it into the task definition. Until then dev stores every request and announces
none, loudly.

## The subject field

`required` is off the hidden native select and the rule lives in the resolver.
The message renders under the field, `aria-describedby` ties it to the trigger,
`aria-invalid` marks it, and focus moves to the trigger - which is a thing a
person can act on and a screen reader can announce.

The trigger has an accessible name for the first time. A `for` on the label
would **not** have fixed it: `<label for>` does not name a
`<button role="combobox">`. `aria-labelledby` does.

```
before: computeAccessibleName(trigger) === ""        (length 0)
after : computeAccessibleName(trigger) === "Sujet *"
```

## Proof

`contact-request.dbspec.ts`, against a real Postgres - 7 tests. The row is read
back through a second client, so what the service says it wrote and what
Postgres holds are two separate claims. The consent timestamp is present, is
the server's, and the `NOT NULL` column refuses a row without one (`23502`).
Two CHECK constraints refuse blank content and an unpublished locale.

Locales: `contact.service.spec.ts` asserts the acknowledgement goes out in the
page's language for both `fr` and `en`, that the locale is stored on the row,
and that the **back office is written to in its own language** - a prospect
writing in English must not switch the team's notification into English.

Mutations, each run and reverted:

| Mutation                                            | Test that went red                            | Result                  |
| --------------------------------------------------- | --------------------------------------------- | ----------------------- |
| every field rule deleted from the server DTO        | `contact.dto.spec.ts`                         | **15 failed**, 7 passed |
| the server action always returns success            | `lib/actions/contact.spec.ts`                 | **6 failed**, 1 passed  |
| the subject rule made `.optional()` in the resolver | `contact-form.spec.tsx` (the no-subject test) | **2 failed**, 10 passed |

**The second mutation is the one that found something.** It first came back
**all green**: the component tests mock the server action, so making the action
always succeed left twelve tests passing. The form was proved correct given an
honest action and _nothing proved the action was honest_. A guard nothing can
redden is not a guard, so `lib/actions/contact.spec.ts` was written - and it is
the file the mutation now fails against.

## Two defects found in the guards themselves

1. **`one-processor-per-queue.spec.ts` counted its own prose.** The sweep
   matched `@Processor(QUEUES.X)` in raw text, so the three doc comments this
   chantier wrote _explaining the rule_ were read as declarations, and it went
   red naming `cleanup.processor.ts` twice and a constants file as rival owners
   of `CORE`. It is the catalogued _"a sweep that counts a token counts it in
   prose too"_, in the file whose whole job is counting tokens. Comments are
   stripped now, with two tests pinning both directions: a real declaration is
   still found, and a commented-out one is not.
2. **A timezone trap for anyone reading timestamps in raw SQL.** `TIMESTAMP(3)`
   is what Prisma maps `DateTime` to and what every table here uses. Prisma
   reads it as UTC; `node-postgres` reads the same column in the process's local
   zone, so on a UTC+2 machine they differ by exactly 7 200 000 ms. Nothing is
   wrong with the stored value - but a script comparing one against `Date.now()`
   is wrong by whole hours and looks like clock skew.

## Gate - LOCAL ONLY

`nx test api`, `nx test common`, `nx test web`, `pnpm test:db`, both
typechecks, both lints. **No CI run has confirmed any of it** - the
organisation's Actions quota is exhausted and jobs do not start. CI still has
to run all four suites on a clean runner, and needs a Postgres service on the
quality job for `nx run api:test-db`.

---

### P2 - the newsletter form, held to L1's discipline - `PROUVE`

**Cost impact: None.** No new resource. The consent is stored as attributes on
the SES contact that already holds the subscription.

`L1-contact` is this chantier's first half: the contact form. P2 stood at 95 %
for one reason, the **newsletter form had none of it**. That was checked against
the code before anything changed, and every claim held:

- no consent box and no privacy link;
- a resolver with one hard-coded English sentence on a French site;
- an action that turned every failure into another English sentence;
- a server that checked only the address.

Measured: the address field's accessible name was **`""`**, because it had a
placeholder and no label, and `computeAccessibleName` does not count a
placeholder.

Now the same shape as L1, not a better one:

- the resolver carries the rules as catalogue keys (`footer.newsletter.validation`);
- each message is visible under its field, tied by `aria-describedby`, with
  `aria-invalid` set;
- consent is an explicit box linking the privacy policy and the RGPD page, using
  the consent sentence already in the catalogues;
- the API refuses a subscription without a literal `true` consent at the DTO,
  and again in the service (`NewsletterConsentRequiredError`), before SES is
  called;
- the consent time is the server's clock. It is stored on the SES contact as
  `AttributesData` (`consentGivenAt`, `consentPolicyPath`, `locale`), and none
  of it is accepted from the wire;
- a refusal is said in a `role="alert"` region and the address stays in the
  field. A 409 is named with the catalogue's "already subscribed" sentence.

After: accessible name **`"Adresse email"`** (an `sr-only` label; the footer's
heading already says what the field is for).

**Proof.** Red first: 13 web tests failed and the controller seam failed. The
DTO and service specs failed to compile against the old code, which is not a
red, so their behavioural reds are the mutations. Eighteen mutations, each
observed failing on its own, one per expectation:

- DTO: consent optional; consent as `'true'` or `1`; a wire timestamp let through;
- service: consent guard removed; timestamp not the server's; locale not stored;
- controller: policy path dropped;
- web: resolver consent optional; action always succeeding; each `aria-describedby`
  and `aria-invalid`; the label detached; the English sentence restored in the
  resolver; the 409 unnamed; the locale hard-coded; the RGPD link redirected.

`fr` and `en` keys are pinned in lockstep by a test.

**Proven on dev, 23 September, on `sha-581f99d`** (develop run `35886840188`
green, journeys included):

- the footer's address field carries its label, `"Adresse email"`, read from the
  deployed DOM;
- one subscription through the form in a real browser, to a throwaway
  `kambriq-p2-proof-20260923163245@maildrop.cc`, answered "Inscription réussie !"
  and reset the field;
- read back with `aws sesv2 get-contact` on `kambriq-newsletter`: `AttributesData`
  holds `consentGivenAt: 2026-09-23T16:33:20.881Z` - 39 ms before SES's own
  `CreatedTimestamp`, 16:33:20.920Z, so the server's clock -
  `consentPolicyPath: /legal/privacy` and `locale: fr`.

The contact list is shared by the account, so that throwaway contact stays in
it until somebody removes it.

---

### L2-contact - the daily digest, so silence is impossible - `PROUVE LOCALEMENT`

**Cost impact: None.** A job name on `QUEUES.CORE`, handled by the
`CoreCleanupProcessor` that already owns it, scheduled by the
`CleanupScheduler` that already exists. **No second `@Processor` on that
queue**: BullMQ hands a job to exactly one worker, which is how G6's dunning
processor silently ate a payment reminder.

**A digest, not an alert, and that is the whole design.** An alert fires on a
condition somebody predicted. The contact form sent nothing for its entire life
and no alert existed to notice, because there was no traffic to compare
against. A message that arrives every day - **zero included** - inverts that:
its _absence_ is the signal, and absence is something a person notices without
being told what to look for. Same lesson as the seven months of a silent SES
client, applied before rather than after.

07:00 UTC, which is 08:00 in Douala: an overnight request is on somebody's
screen when they sit down.

## Exercised once, with a forced zero count

Run end to end: the real API against an emptied database, the real scheduler,
the real queue, the real processor. The job completed with
`{"count":0,"pending":0,"sentTo":"backoffice@contact.test"}`.

Rendered through the real template and the real catalogues:

```
To:      backoffice@contact.test
SUBJECT: Demandes de contact : 0 sur 48 h

Releve quotidien des demandes de contact
Sur les 48 dernieres heures (8 septembre 2026 - 10 septembre 2026), 0 demande(s) de contact ont ete recues.
Aucune demande sur la periode. Ce releve part tous les jours, y compris a zero : s'il cesse d'arriver, c'est le signal.
En attente de reponse (tous ages confondus)   0
La plus ancienne en attente                   Aucune
```

**Reading it as a person found a defect.** The first render put raw ISO strings
in front of the reader - `Sur les 48 dernieres heures
(2026-09-08T04:54:45.285Z - 2026-09-10T04:54:45.285Z)`. That is exactly G3's
`paymentReminder` shipping a deadline as `2026-10-06`, on the same message
surface, and it was found the same way: by rendering it and reading it rather
than by inspecting the code. Both messages now format their dates.

## Gate - LOCAL ONLY

As `L1-contact`'s.

**On dev, 26 September - the digest had never been sent, and nothing said so.**
The dev log from 19 September (the oldest line it still holds for this) to 25
September has the schedule line at every task start and **nothing at 07:00 UTC
on any day** (each of 21 to 25 September read minute by minute): no "Contact digest sent", and no
error either. `CONTACT_INBOX_EMAIL` was unset on dev (it was set by infra #66 on
26 September, found by P5), so `sendDailyDigest` threw
`DigestUndeliverableError`, BullMQ recorded a failed job, and the processor
logs nothing when a job fails. `GET /health/queues` shows 16 failed jobs on the
`core` queue, consistent with one per morning (their names were not read) -
the only place it was visible, and only to somebody asking.
**A design whose alarm is the absence of a message had its message absent, and
nobody was expecting it yet**, so the absence alarmed nobody.

The first digest on dev left at **26 September 07:00:00 UTC**:
`Contact digest sent {"count":0,"pending":0,"windowHours":48}`. Whether it
arrived is visible only in `contact@`, and this entry stays `PROUVE LOCALEMENT`
until Visquis sees it there.

**The fourth round's subject 4 asked for "an alert when the volume stays at zero
for 48 hours" as P1's last piece.** Not built. `P1` in this register is the SES
contact-list question, and the 48-hour zero case is this entry, where the
decision was a digest rather than an alert. An alert would reverse that
decision, which is his to make. Two smaller things that are not decisions,
also not built: logging a failed core job at `error`, and `CONTACT_INBOX_EMAIL`
being required at startup rather than at 07:00.

### P3 - the auth middleware was a global net, and nothing could 404 - `PROUVE LOCALEMENT`

**Cost impact: None.** No resource, no dependency. One matcher, one page, one
header on a `headers()` block that already existed.

## The premise, measured before anything was built

Every claim in the 9 September audit holds. Probed against the running app on
`develop`:

```
/zzz-does-not-exist  307 -> /login?callbackUrl=%2Fzzz-does-not-exist
/pricing             307 -> /login?callbackUrl=%2Fpricing
/tarifs              307 -> /login?callbackUrl=%2Ftarifs
/robots.txt          307 -> /login?callbackUrl=%2Frobots.txt
/sitemap.xml         307 -> /login?callbackUrl=%2Fsitemap.xml
/contact             200
/api/does-not-exist  404      <- the only path on the site that could 404
```

The matcher was a single **negative** pattern - everything except `api`,
`health`, `_next` and a handful of static files. So the middleware ran on every
URL the site does not serve, found it was not in `PUBLIC_PATHS`, and sent it to
the login page.

**Two things the audit's wording got slightly wrong, and one is a real
distinction.**

1. **There is no 404 page in this repository, and never has been.** The audit
   says one "already exists and is reachable only under `/api/*`". What answers
   there is Next's **built-in default** - the bare "404: This page could not be
   found." - which is reachable on the paths the matcher happened to exclude.
   There is no `not-found.tsx` in the history of the app. The distinction
   matters because "make the existing page reachable" and "write one" are
   different jobs.
2. **`callbackUrl` is never consumed.** `logInAction` calls
   `signIn(..., { redirectTo: '/' })`, a hard-coded literal. Four places write
   the parameter - the middleware twice, `account/page.tsx`,
   `lib/api/server.ts` - and **none reads it**. So there is no open redirect on
   this site today; the parameter is decorative. See P3's note below on why it
   is constrained anyway.

## A positive matcher, derived from the routes rather than remembered

The matcher is now a list of protected prefixes plus the three public paths
that send a signed-in user onward (`/`, `/login`, `/register` -
`REDIRECT_WHEN_AUTHED`; dropping those would have left signed-in users looking
at the marketing page, which is the kind of thing a narrowing quietly breaks).

**A negative matcher answers "what is not excluded"**, which is unbounded and
grows with every public page added. A positive one is a list somebody can read.

**Narrowing a gate is the dangerous direction**, so the list is not trusted.
`middleware-matcher.spec.ts` walks `src/app`, computes the URL of all 70 routes
on disk, and fails if any route `isPublic()` refuses is not matched. The full
table is printed by the suite and pasted in the PR: **50 routes protected before
and 50 after, and no route changed side.**

`/kamnet/apply` and `/kbs/enroll` stay behind the login wall deliberately, even
though public product pages link straight at them. That is a real defect and it
is **P5's**. Widening the gate here would have been that product change, made by
accident, with no test describing it.

## The 404

A real page: HTTP 404 (Next gives it for `not-found.tsx`), a message, and named
links back into the site rather than "go back" - somebody who arrived on a dead
link has nowhere useful to go back to.

**The tests assert the status code, not the copy.** A page saying "not found"
over a 200 is a soft 404: a crawler indexes it, a monitor calls the site
healthy, and every broken URL stops being countable. That is a worse defect than
the redirect, so it is the thing pinned.

## P4 - `NODE_ENV` could not have answered this, and that was the trap

`docker/Dockerfile.web` sets `ENV NODE_ENV=production` on the runtime image
**unconditionally, for every environment**, because that is what a Next.js
production build runs as. dev.kambriq.com therefore reports
`NODE_ENV === 'production'` exactly as prd would.

A `NODE_ENV !== 'production'` check would have put the header on nothing that is
actually deployed. The dev site would have stayed indexable, the suite would
have been green, and the chantier would have reported success having changed
nothing. It is this repository's recurring shape: **a check reading a value that
cannot distinguish the two cases it is asked about.**

There was no environment discriminator in the web app at all. `APP_ENV` is
introduced for this one decision, and read by nothing else.

**Absent means noindex.** The two failure modes are not symmetrical: if prd
forgets to declare itself it carries `noindex`, which is visible the first time
anybody opens Search Console and is fixed by setting one variable; if the
default ran the other way and dev forgot, dev is indexed under the brand name -
the defect being fixed - invisible until somebody searches, and weeks to unpick.

**This has a cost and it is named: prd must set `APP_ENV=production` when it is
first built.** prd has never been deployed. The follow-up below is for
`docs/adr/ADR-005-production-automation-prerequisites.md`.

The header joins `next.config.ts`'s existing `headers()` block rather than
becoming a second mechanism. That block already matches every path and -
measured - already applies to 404 responses, which is where a noindex header
most needs to reach. A middleware header could not have done it after P3: the
matcher now runs on protected prefixes only, so it never sees the public pages.

## `callbackUrl`, constrained although nothing reads it

`safeCallbackUrl` reduces a value to an internal path or gives up. It refuses
absolute URLs, protocol-relative `//host`, backslash variants that browsers
normalise, `javascript:`/`data:`, anything without a leading slash, and control
characters that browsers strip before parsing.

It exists **now** rather than after somebody wires the read, because the obvious
way to make the parameter work is `redirectTo: searchParams.callbackUrl`, and
written that way it is a textbook open redirect immediately after somebody types
a password. The guard sits at all four write sites and is exported so whoever
wires the read finds it already there.

## Proof

Over real HTTP, against the running app after the change:

```
PATH                      STATUS  LOCATION                        X-Robots-Tag
/zzz-does-not-exist       404                                     noindex, nofollow
/pricing                  404                                     noindex, nofollow
/tarifs                   404                                     noindex, nofollow
/robots.txt               404                                     noindex, nofollow
/sitemap.xml              404                                     noindex, nofollow
/contact                  200                                     noindex, nofollow
/mylands                  307     /login?callbackUrl=%2Fmylands   noindex, nofollow
/kamnet/apply             307     /login?callbackUrl=%2Fkamnet%2F noindex, nofollow
/admin/payments           307     /login?callbackUrl=%2Fadmin%2F  noindex, nofollow
```

And with `APP_ENV=production`, the same server:

```
/                    status=200  x-robots-tag=<ABSENT>
/contact             status=200  x-robots-tag=<ABSENT>
/zzz-does-not-exist  status=404  x-robots-tag=<ABSENT>
/mylands             status=307  x-robots-tag=<ABSENT>
```

The four pre-existing security headers are still present in both cases.

Mutations, each run and reverted:

| Mutation                                | Went red                     | Result                   |
| --------------------------------------- | ---------------------------- | ------------------------ |
| the catch-all negative matcher restored | `middleware-matcher.spec.ts` | **8 failed**, 2 passed   |
| the noindex header forced on always     | `lib/seo/robots.spec.ts`     | **4 failed**, 13 passed  |
| the `callbackUrl` constraint removed    | `callback-url.spec.ts`       | **14 failed**, 10 passed |

**The first mutation found a defect in its own test.** It initially made the
suite **fail to run** - `Tests: 0 total` - because the matcher compiler threw at
module scope on a pattern it could not model. That is the repository's own rule
that a mutation which breaks the build has not been run: a crash reports that
the test file is broken, not that the matcher is wrong, and none of the eight
assertions that matter ever executed. The compiler now returns `null`, one named
test asserts the list of unmodellable patterns is empty, and the mutation fails
eight tests with readable messages.

## Follow-ups

- **prd must set `APP_ENV=production`** at build time, on the ADR-005 bootstrap
  checklist. Until it does, a prd deployment would carry `noindex`.
- **`/kamnet/apply` and `/kbs/enroll` are public calls to action behind a login
  wall.** P5.
- **The register's `L1-contact` / `L2-contact` rename to `P1` / `P2` was asked
  for and not done here.** Those identifiers exist only on
  `feat/l1-contact-lead-pipeline` (PR #98, 8 occurrences in this file), and the
  same brief puts that branch out of scope. Doing it would mean editing another
  open PR's branch. Named rather than resolved; see the PR body for the command.

## Gate - LOCAL ONLY

`nx test api`, `nx test common`, `nx test web`, both typechecks, both lints, and
the Playwright spec run against a local server (16 passed). **No CI run has
confirmed any of it** - the Actions quota is exhausted and jobs do not start.
CI still has to run the three unit suites and the e2e suite on a clean runner,
and build the web image with the new page.

---

## P4, second half - the API carries the header too - `PROUVE`

**Cost impact: None.**

P4 was capped at 90 % for a reason measured on dev: `X-Robots-Tag: noindex,
nofollow` was on the home page, a legal page, two protected routes, a 404, the
login page and a static asset, and **absent on `/api/v1/health/version`**. So
"every route" was false on the same hostname.

Re-measured on 23 September before anything changed (`sha-581f99d`):

- `/` and `/legal/privacy` carry the header;
- `/api/v1/health/version` (200), `/api/v1/kamnet/public/agents` (200),
  `/api/v1/no-such-route` (404) and `/api/v1/users/me` (401) carry nothing.

**One rule, not two.** `isIndexableEnvironment` and `NOINDEX_HEADER` moved to
`libs/common/src/middleware/robots-header.middleware.ts`.
`apps/web/src/lib/seo/robots.ts` re-exports them, and a test asserts the web's
function **is** the shared one, not a copy that agrees. It is still `APP_ENV`,
never `NODE_ENV`, and absent means noindex. Dev sets no `APP_ENV` on either
container, so both answer noindex with no infra change. prd must set
`APP_ENV=production` on **both**, and that is the existing ADR-005 follow-up.

**Express middleware, not an interceptor.** An interceptor runs only for a
matched handler, so a 404 for an unknown route and a 401 from a guard would
leave without the header. `robotsHeaderMiddleware()` is registered in `main.ts`
right after helmet, before the global prefix. The environment is read once, at
startup.

The web import is relative, with a scoped
`eslint-disable-next-line @nx/enforce-module-boundaries`. `next.config.ts` imports
`robots.ts`, and the config loader cannot resolve the `@kambriq/common` alias:
measured, "Cannot find module '../../libs/common/...'". `next build` with and
without `APP_ENV=production` still gives `["noindex, nofollow"]` and `[]` in the
routes manifest.

**Proof so far.** The `main.ts` pins were red first, against the unregistered
app. An HTTP test boots a Nest app with the middleware registered as `main.ts`
does and sees the header on a 200, a 404 and a 401. Nine mutations, each
observed failing on its own:

- registration removed;
- registered after the prefix;
- a `NODE_ENV` fallback;
- the header sent in production;
- `next()` forgotten;
- the decision taken per request;
- `APP_ENV` not normalised;
- the web keeping its own copy;
- the header never set.

**Proven on dev, 23 September 19:38 UTC, on `sha-f0e8819`** (develop run
`35908835479` green, journeys included), by request:

| request                        | status | X-Robots-Tag                    |
| ------------------------------ | ------ | ------------------------------- |
| `/api/v1/health/version`       | 200    | `noindex, nofollow`             |
| `/api/v1/kamnet/public/agents` | 200    | `noindex, nofollow`             |
| `/api/v1/no-such-route`        | 404    | `noindex, nofollow`             |
| `/api/v1/users/me`             | 401    | `noindex, nofollow`             |
| `/`, `/legal/privacy`          | 200    | `noindex, nofollow` (unchanged) |

The same four API requests carried nothing on `sha-581f99d` that afternoon.

**What P4 cannot reach before D13.** Dev answers 200 to anonymous callers, with
no access authentication. That half belongs to D13, and P4 stays below 100 %
until D13 lands.

---

### G6 - the dunning queue and the reminder scheduler - `PROUVE LOCALEMENT`

**Cost impact: None.** One new BullMQ queue on the existing Redis, one daily
repeatable job, one table. No new dependency - `@nestjs/schedule` is absent from
this repository and stays absent.

v03 _"Rien ne peut dormir en silence"_: a payment left in `INSTRUCTIONS_ENVOYEES`
past its validity surfaces in a back-office queue, triggers an automatic
reminder, and moves to `EXPIRE` at the term with its reason. The design's own
framing is why it exists - _"Un client SES nul pendant sept mois n'a rien dit. Un
paiement oublie ne doit pas pouvoir se taire."_

## The three queues were factored, because this was the third

`ageDays` existed **twice**, defined privately and identically in
`UsersService.listPendingIdDocuments` (`A10`) and
`PaymentsService.listRequestQueue` (`G11`). Both sorted oldest-first, both aged
each row, both put the backlog's oldest on the envelope. Two copies is a
coincidence; three would be a pattern nobody shared, and the copy nobody updates
is the one that goes wrong.

`libs/common/src/dto/queue-aging.ts` now holds `ageInDays` and
`withOldestWaiting`, and all three queues use them.

**Extracting it exposed that the two existing queues disagreed.** On an empty
backlog the identity queue returned `null` and had a test pinning it; the
request queue returned `0` and had none. They are different claims - `0` says
the oldest item waited under a day, `null` says there is no oldest item. The
tested one is also the honest one, so `null` won and the request queue's silent
`0` was corrected. Found only because the third copy forced the comparison.

## The reminder schedule: two, at J-7 and J-1

The design says _"declenche une relance automatique"_ - one verb, no number - so
the number is this chantier's to choose and to defend.

**Two, not one.** A single reminder lost to a spam folder is the
seven-months-of-silent-SES failure with better manners: one attempt, no
evidence, nobody the wiser.

**Two, not five.** Every reminder is a transactional email against a reputation
this platform has only just acquired production SES access for, and a client who
has not paid after two is a phone call. The back-office queue exists so a person
picks that up.

**J-7 and J-1**, because `PAYMENT_VALIDITY_DAYS` is 30 _"parce qu'un mois est la
forme d'un virement de la diaspora"_: an international transfer takes days to
clear, so J-7 is the last moment one can still be started and land, and J-1 the
last moment anything can be said at all.

`PAYMENT_REMINDER_OFFSETS_DAYS`, default `7,1`. A schedule it cannot parse
**throws** rather than falling back to the default - a misconfigured setting that
quietly becomes `7,1` is a setting that looks applied and is not.

## `EXPIRE` without a person, and the mutation that proves it deliberate

`G1` left `EXPIRE` out of `COMMITTING_STATES` so the sweep can make that one
transition unnamed. Adding it back:

```
+  PaymentState.EXPIRE,
   PaymentState.PARTIELLEMENT_RECU,
```

**3 failed / 542 passed**, including
`PaymentsService › transitions › allows the dunning job to expire a stalled payment`.
Restored: **545 passed**. The omission is a decision, not an oversight.

## The defect this chantier introduced, and how it was found

`DunningProcessor` was declared `@Processor(QUEUES.NOTIFICATIONS)`, beside the
`EmailProcessor` that already owned that queue. BullMQ gives a job to one
worker; the dunning processor returned `undefined` for names it did not
recognise, so when it won a `send-email` it **consumed the reminder and
discarded it**:

```
one email sent instead of two
bull:notifications:wait    -> 0
bull:notifications:failed  -> 0
```

No error, no retry, no log line - **the exact silence this chantier exists to
abolish, introduced by this chantier**. Invisible to 549 unit tests because each
mocks its own queue, and obvious on the first real run.

Fixed with a queue of its own, `QUEUES.DUNNING`; the processor now **throws** on
a job it does not own rather than returning quietly.
`one-processor-per-queue.spec.ts` is the barrier and names both files when it
fires - proved by reintroducing the collision:
`NOTIFICATIONS: dunning.processor.ts + email.processor.ts`, 2 failed / 1 passed.

## The coordinate guard was blind to half of what it forbade

Proof (c) was meant to be a formality: put a coordinate in the reminder, watch
the guard fire. **It did not fire.** 36 tests green with an IBAN in the message.

`no-coordinates-in-email.spec.ts` matched only `args['bankIban']` - the bracket
form. `args.bankIban` renders exactly the same IBAN and passed. A guard that
catches one spelling of what it forbids is a guard against that spelling; the
mutation meant to prove it red proved it blind. Same shape as `A18`'s `@Public()`
sweep: what a scan does not match, it reports as clean.

Now matches both forms, plus a check on the reminder body by name. Re-run with
`args.bankIban`: **2 failed / 16 passed**. Restored: 18 passed.

## Proof, run locally end to end, against the real database and real SES

`PAYMENT_VALIDITY_DAYS=1`, `PAYMENT_REMINDER_OFFSETS_DAYS=1`, both **read by the
code under test** - `sendInstructions` computed `expiresAt` itself. Where the run
needed to be past the term the **clock** was handed to the code
(`sweep(now)`, `listOverdueQueue(query, asOf)`); **no row's dates were edited.**

```
reference : KBQ-2609-ZYFQR-Z
expiresAt : 2026-09-10T14:33:24Z      <- computed by sendInstructions from config
sweep 1   : {"remindersSent":1,"expired":0,"failures":[]}
recorded  : [{"offsetDays":1,"sentAt":"2026-09-09T14:33:24.6Z"}]
```

The queue entry, past the term:

```json
{
  "reference": "KBQ-2609-ZYFQR-Z",
  "clientName": "Ekani Marcelle",
  "state": "INSTRUCTIONS_ENVOYEES",
  "outstanding": "750000",
  "channel": "MOMO",
  "waitingDays": 1,
  "overdueDays": 0,
  "remindersSent": 1
}
```

The audit trail at `EXPIRE`:

```
(creation) -> INITIE                          actor fee0d9f9…  the client requests to pay
INITIE -> INSTRUCTIONS_ENVOYEES               actor fee0d9f9…  the back office sends the instructions
INSTRUCTIONS_ENVOYEES -> EXPIRE               actor system
   reason: Validity period elapsed on 2026-09-10 without the announced payment.
           Expired automatically by the dunning sweep.
```

After the sweep the queue holds **0 rows** and no terminal payment appears in it.

**The reminder, read in a real mailbox as a message.** messageId
`010701a086967e3f-c1250f4c-3489-47fa-b02f-63091a6af120-000000`, subject
_"Rappel : paiement KBQ-2609-ZYFQR-Z a regler avant le 10 septembre 2026"_. No
`IBAN`, no `SWIFT`, no `237`, no `DEV-COMPTE` anywhere in the raw HTML.

**And reading it found a defect nothing else would have.** The reminder said
_"Les instructions completes sont rappelees ci-dessous pour que vous n'ayez pas a
rechercher le message precedent."_ - with nothing below it. Copy left over from
the v02 template that did carry the channel block: **v03 removed the coordinates
and left the promise.** Corrected in both locales to say the details remain on
the client's space, behind their sign-in. The G3 lesson again: a message is done
when somebody has read what arrived.

## The dependency on `A18`, which is not merged

The sweep runs as a **BullMQ repeatable job**, not a `@Cron`. A `@Cron` that
throws writes a line nobody is watching; a repeatable job that throws lands on
the queue's `failed` set with its payload and stays (`removeOnFail: 200`).

So this was built to **compose** with `#91` rather than to depend on it: the
failure is durable and readable through Redis today, and `A18`'s
`/health/queues/failed` will read the same set from outside the VPC the moment
it merges. Nothing here imports anything from that branch, and nothing here is
blocked by it.

`sweep()` throws `DunningSweepError` carrying the tally and every failure, rather
than returning a count that looks like a result while three payments went
unchased.

## Gate - LOCAL ONLY

`nx test api` **41 suites / 549 tests**, `nx test common` **16 / 277**, api and
web typecheck clean, `nx lint api`/`web` clean (the pre-existing web
`exhaustive-deps` warning only). **No CI run has confirmed any of it** - the
organisation's Actions quota is exhausted and jobs do not start. `nx lint common`
still fails with the two pre-existing `@nx/dependency-checks` errors it fails
with on develop.

---

### R4 - back to hosted runners, and what a run costs - `EN COURS`

Visquis is adding a payment method with a low cap, so the bill matters and the
self-hosted Mac stops being the target. It stays **registered** - nothing was
removed - because it serialises jobs: a hosted quality stage of 118s wall clock
took 1371s on it, and one stall left two jobs queued for 19 minutes.

## The baseline, measured before anything changed

GitHub bills each job's wall clock **rounded up to the minute, per job**.

| job                     |       hosted secs | billed | self-hosted secs | billed |
| ----------------------- | ----------------: | -----: | ---------------: | -----: |
| Commitlint              | (skipped on push) |      0 |              202 |      4 |
| Quality / typecheck     |                47 |      1 |              246 |      5 |
| Quality / lint          |                58 |      1 |              307 |      6 |
| Quality / typecheck:web |                58 |      1 |              214 |      4 |
| Quality / test          |               118 |      2 |              402 |      7 |
| Build & push API image  |               151 |      3 |                - |      - |
| Build & push Web image  |               159 |      3 |                - |      - |
| Deploy to dev           |               575 |     10 |                - |      - |
| E2E Tests (dev)         |               218 |      4 |                - |      - |
| Delivery journeys (dev) |               114 |      2 |                - |      - |
| **TOTAL**               |          **1498** | **27** |         **1371** | **26** |

Hosted run `34109055661` (full pipeline, 18m01s wall clock); self-hosted run
`34142916629` (quality only, 41m45s wall clock).

**Where the waste was.** The four quality jobs billed 5 minutes to do 102
seconds of checking. Step timings: ~40s of checkout + setup-node + install per
job, paid four times, for 24 seconds of parallelism.

## What changed, in descending order of saving

**1. Concurrency.** `cancel-in-progress` is an **expression**, not `true`:

```yaml
cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

It is false on a push to develop, so **the deploy is never cancelled mid-flight**

- that run migrates the database, updates two ECS services and bootstraps the
  admins, and killing it between the migration and the service update leaves dev
  in a state no log explains. `deploy-dev.yml` keeps its own
  `concurrency: deploy-dev, cancel-in-progress: false` as a second barrier.

**2. Quality consolidated, four jobs into one.** 5 billed minutes -> 3. The
trade is 24s of extra wall clock. The image builds were **kept parallel** by the
same arithmetic run the other way: merging them saves 1 billed minute and adds
~150s to every deploy.

**3. `nx affected`, and an honest note on it.** On a PR, `--base=origin/<base>`.
On a push to develop there is no base to diff against, so develop runs the
**full set** - deliberately, because develop is what gets built and deployed.

Measured, this saves less than it sounds: a workflow-only change gives
`-t test` affected `[]`, but a change touching `libs/common` gives
`["api","web","common"]` - everything - because both apps depend on it. **The
saving is concentrated on documentation and config PRs, not on normal ones.**

**4. Caching.** `setup-node` already caches the pnpm store; the nx computation
cache is now cached on `.nx/cache`, keyed on the lockfile plus the sha with a
`restore-keys` prefix fallback. The fallback is the part that pays - without it
every run is a cold cache and the cache is decoration.

**5. `timeout-minutes` on every job**, ~2x measured: 5 for the filter and
commitlint, 10 for quality and the builds, 15 for e2e, 20 for the deploy.
GitHub's default is **360**, so one hung job burns 18% of a monthly quota.

**6. Path filters, on pull requests only.** A `changes` job reports `code=false`
for a documentation-only PR and quality is skipped.

On a push to develop it always reports `true`. That is deliberate: this project
checks that **the sha served by dev equals develop's head**, and a docs-only
merge that skipped the deploy would break that invariant for a reason nobody
would remember a week later.

## Required checks: there are none

```
GET /repos/kloudnat-digital/kambriq-webapp/branches/develop/protection
->  403 "Upgrade to GitHub Pro or make this repository public"
```

Branch protection is unavailable on this plan, so **no check is required and a
skipped job cannot block a merge**. If the plan changes, every gate above must
be rewritten as a job that always runs and exits 0 when there is nothing to do.
Written down because the cost of getting it wrong is a permanently unmergeable
PR.

## Does e2e run twice? No - but quality did

`e2e` and `journeys` are gated `github.event_name == 'push' && github.ref ==
'refs/heads/develop'`, so they never run on a PR. **`quality` had no gate**, so
it ran on the PR and again on the squashed develop commit - about 5 billed
minutes duplicated per merge.

Kept, not removed: the develop run is the gate before the build and the deploy,
and it is the run whose result licences a deployment. The nx cache is what makes
the repeat cheap rather than deleting it.

## The runner target

One repository variable, `CI_RUNNER_LABELS`, read by all jobs:

```yaml
runs-on: ${{ fromJSON(vars.CI_RUNNER_LABELS || '["ubuntu-latest"]') }}
```

Now `["ubuntu-latest"]`. Back to the Mac is one edit to that variable; **deleting
it also returns to hosted**, because that is the fallback.

---

### R3 - CI on the self-hosted runner - `EN COURS`

Actions has been dead since the organisation exhausted its 2 000 free minutes.
`#93` made the deploy runnable from a laptop; this points the pipeline itself at
`kambriq-ci`, a self-hosted runner on Visquis's Mac, because a script is a black
box while it runs and Actions gives him live logs, history and re-run.

`#93`'s script is not discarded. It becomes what the workflow calls - **once
`#93` is merged**, which it is not yet. See the honest gap below.

## What the runner actually is, read from its own registration

Not from the brief. `/Users/vmi/workspace/actions-runner/.runner`:

```
agentName : kambriq-ci
poolName  : Default            <- organisation-level Default group
gitHubUrl : https://github.com/kloudnat-digital
```

Runner 2.337.0 on macOS 26.6.2, arm64; listener process running. The machine
carries node 24.1.0, pnpm 10.22.0, docker 24.0.7 with buildx v0.29.1, jq 1.7.1,
aws-cli 2.15.8, git 2.45.2. Docker is running, server 28.5.1, and its buildx
`default` builder advertises `linux/amd64` - so amd64 is reachable by emulation,
which is not a guess: both dev images were built and pushed as amd64 from this
machine earlier today.

**`/bin/bash` on macOS is 3.2.57.** Every `run:` block and
`scripts/deploy-dev.sh` must stay inside it - no `declare -A`, no `mapfile`.

## The blocking question, answered first: service containers

**No workflow declares one.**

```
grep -rn "^\s*services:" .github/workflows/   ->  no matches
```

The API and common suites are unit tests against mocks; they need neither
Postgres nor Redis. Had a `services:` block existed the approach would have
stopped here, because service containers do not run on macOS runners and the
alternative - pointing the tests at something weaker - is the false witness this
register exists to catch.

## Credentials still work, and here is why

Every AWS step is `aws-actions/configure-aws-credentials@v4` with
`role-to-assume: ${{ secrets.AWS_ROLE_ARN }}`. **No static key appears in any
workflow.** OIDC survives the move because the token is minted by GitHub for the
job, not held by the machine - the runner only needs `id-token: write`, which
every credential-using job already declares.

## What was Linux-only, and what replaced it

Exactly **one** command, across four workflows:

| was                                  | now                                               | why                                                                                                                  |
| ------------------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npx playwright install --with-deps` | branch on `uname -s`; `--with-deps` on Linux only | `--with-deps` is `apt-get`. It does not degrade to a no-op off Debian - Playwright errors on an unsupported platform |

Nothing else needed replacing: no `apt-get`, no `sudo`, no `sed -i`, no
`date -d`, no `readlink -f`, no absolute `/usr/bin` paths. Established by sweep.

## The defect the move exposed, which is not a portability issue

**No `docker/build-push-action` step pinned a platform** - three of them, in
`ci.yml` and `manual-deploy-dev.yml`, building for whatever the runner happens
to be. amd64 on `ubuntu-latest` by accident; arm64 on the Mac.

An arm64 image builds, pushes and registers as a task definition without
complaint. It fails when ECS tries to start it, minutes later, in a place that
reads like an application defect. `platforms: linux/amd64` is now pinned on all
three, each followed by an assertion against the **registry** - the flag says
what was requested, only the registry says what arrived.

## Where the runner target lives

One repository variable, `CI_RUNNER_LABELS`, read by all 13 jobs:

```yaml
runs-on: ${{ fromJSON(vars.CI_RUNNER_LABELS || '["ubuntu-latest"]') }}
```

Set to `["self-hosted","macOS","ARM64","kambriq-ci"]`. **October's reversal is
deleting that variable** - no PR, no code change, no rebuild. The
`|| '["ubuntu-latest"]'` fallback is deliberate: an unset variable returns to
hosted runners rather than producing an empty `runs-on`, which is a job that
fails for a reason nobody can read.

## The honest gap: the deploy job does NOT call the script yet

`#93` is not merged, so `scripts/deploy-dev.sh` on develop is still the stale
145-line orphan. The deploy job keeps its own steps for now, and the
architecture assertion is written **inline in the workflow**.

That inline block duplicates `assert_amd64`, and it is labelled as a duplicate
in the file itself. When `#93` lands it must become a call to the script - and
`#93`'s anti-drift test is what will force it, since that test fails on any
workflow step the script does not implement. The alternative was stacking this
branch on `#93`, which is the shape that stranded `#89`.

## Two things for Visquis, not fixed here

**The runner is in the `Default` group at organisation level.** Every repository
in `kloudnat-digital`, and everyone with write access to any of them, can run
code on his personal Mac. Only `kambriq-webapp` needs it today. Restricting it
is a runner group with that one repository added - Settings -> Actions ->
Runner groups - and moving `kambriq-ci` into it. No workflow change.

**The runner is not ephemeral.** `.runner` carries no `ephemeral` key, so the
process persists and `_work` survives between jobs: one job can leave state that
poisons the next, and a compromised job can leave something behind for the job
after it. Making it ephemeral is re-registering with `--ephemeral`, which costs
a fresh checkout and a cold pnpm store per job.

---

### R1 - a merge can succeed and have no effect - `EN COURS`

**This is the entry that says so.**

`#89` was merged. GitHub said "Merged", closed the PR, and drew the purple icon.
Fifty-one files, 3 753 insertions, were not on develop and were not deployed, and
stayed that way for the rest of the day. The notification was true about what it
described - a merge into `feat/g9-payment-entry-point` - and said nothing at all
about the branch anybody cared about.

Two mechanisms, and both had to hold:

|                                    |                                                                                                                                                                                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the base was consumed 89 s earlier | `#88` merged the G9 branch to develop at `09:59:41`; `#89` merged **into** that branch at `10:01:10`. Its merge commit sits on a branch nothing points at any more                                                                                       |
| `#88` was **squash-merged**        | `git log -1 --format=%P f40974b` has **one** parent, `be1d509`. develop carries G9's _content_ with none of its _history_, so `211d5fc` is not an ancestor of develop, the G9 branch never registered as merged, and `#89` could still be merged into it |

Squash is why the second half is silent. A merge commit would have made the G9
branch an ancestor of develop and GitHub would have shown it merged; the squash
left a branch that looks live and is not.

## The check that was wrong, twice

`#90` and this register both recorded **"`git merge-tree` reports zero conflicts"**.
That claim was produced by

```
git merge-tree $(git merge-base A B) A B | grep -E '^CONFLICT|^<<<<<<<'
```

which found nothing because the **legacy** `merge-tree` output does not emit those
markers in that form. An empty grep was read as an empty conflict set. The real
merge:

```
git checkout -b probe origin/develop && git merge --no-commit --no-ff 230b827
->  exit 1, 11 conflicted files
```

A command that cannot fail is not a check. The correction: run the merge on a
scratch branch and read its exit code.

## What the eleven conflicts actually were

Not two edits of the same line - the squash. Nine code files conflicted because
develop holds G9's content with no shared history, so every line G11-G14 changed
looked like a concurrent edit. Verified before taking a side:

```
git diff --stat f40974b fab3f1d   ->  CLAUDE.md, docs/ops/registre-chantiers.md only
```

develop added **nothing** to any of the nine since the squash, so the branch
version is a superset and was taken whole. `CLAUDE.md` and this file are the two
develop did touch, and both were merged by hand keeping both sides.

## What closes this

Not a merge notification. Three commands, after merge and deploy:

```
git merge-base --is-ancestor 230b827 origin/develop     ->  exit 0
GET /health/version imageTag                            ->  equals develop's head
"Payment channel details loaded"                        ->  perOperator: 4, not fields: 12
```

### A18 - queue state observable from outside the VPC - `PROUVE LOCALEMENT`

**Cost impact: None.** No new resource. Two routes on an existing controller and
one service, reading queues that were already registered.

`S9` proved that an unknown job lands on the failed set rather than vanishing -
`failed=1, completed=0`. **That proof was taken locally.** On dev the same
failure is invisible: BullMQ keeps its sets in ElastiCache on a private VPC
endpoint, and `/health` reported `database-core`, `memory_heap`, `memory_rss`,
`disk` and `database-kbs-exam-questions` - nothing about queues. A failure nobody
can observe is a silent failure whatever the code guarantees.

`GET /health/queues` returns `waiting`, `active`, `completed`, `failed`,
`delayed` and `paused` per queue, plus `totalFailed`.
`GET /health/queues/:name/failed` returns the failed jobs **with their payloads**.

**Both are `@Roles(ADMIN_GLOBAL)`, unlike the three health routes beside them,
which are `@Public()`.** Counts expose operational internals and the failed route
exposes payloads that carry personal data - a notification job holds a
recipient's address. `removeOnFailed: 200` already retained them; this reads them
back.

**One unreachable queue must not hide the others.** The four are read in
parallel and a queue whose Redis call throws comes back named, with its error,
rather than collapsing the response - which would turn "one queue is unreachable"
into "queues are unobservable", the exact condition this ends. Such a queue
contributes nothing to `totalFailed` rather than a reassuring zero, and the
reader can see why.

## The proof

Against a real Redis, the real processor and the real endpoint - not a mock, and
not a unit test.

```
BEFORE  {"queue":"kamnet","waiting":0,"active":0,"completed":0,"failed":0,…}  totalFailed: 0
        enqueue kamnet.this-job-does-not-exist  ->  job id 1
AFTER   {"queue":"kamnet","waiting":0,"active":0,"completed":0,"failed":1,…}  totalFailed: 1
```

and the failed set, read through the endpoint:

```json
{
  "id": "1",
  "name": "kamnet.this-job-does-not-exist",
  "data": { "probe": "A18", "at": "2026-09-07T11:27:55.671Z" },
  "failedReason": "Unknown KAMNET job: kamnet.this-job-does-not-exist",
  "attemptsMade": 1,
  "enqueuedAt": "2026-09-07T11:27:55.689Z",
  "failedAt": "2026-09-07T11:27:55.766Z"
}
```

**Local, not dev.** The brief asks for this on deployed dev; that needs this
branch merged and deployed, and nothing is merged. The observation above is the
same act through the same code path.

## A false positive this created, and the sweep it tightened

`route-guards.spec.ts` counted `@Public()` by splitting on the token anywhere in
the file, after stripping comments. The new route's description **explains that
the route is deliberately not public** - and that sentence, inside a string, was
counted as a fourth public route on the health controller. The sweep reported the
words "this is not public" as a public route.

Comments could be stripped; strings cannot, because a decorator and a mention are
the same characters. What separates them is **position**: a decorator opens its
own line. `publicCount` now matches `/^[ \t]*@Public\(\)/gm`. Proved still
sharp by adding a real `@Public()` to the new route - expected 3, received 4 -
and removing it again.

---

### G8 - end to end on dev, deposit and balance - `PROUVE`

**Cost impact: None.** One parcel consumed on dev, on purpose.

**27 September, ninth round.** The two stops below (7 and 11 September) were
about code that had not reached dev; it did with #92. What remained was the
run. `apps/api-e2e/src/journeys/balance-journey.spec.ts` - **journey 7, opt-in**
(`RUN_BALANCE_JOURNEY=1`), because it consumes a parcel and leaves two
validated payments behind, which is not something every deploy should do.

Run against dev (image with #229) through the API a person would use:

1. the agent reserves an available parcel for a new client, who sets a
   password from the emailed link and signs in;
2. the client sends an identity document and the back office marks it
   verified - sending instructions refuses otherwise (v03 4d);
3. the client asks for the deposit; the back office sends instructions (VIR),
   moves it to announced and to verification, uploads a receipt's proof to S3,
   records the receipt for the whole amount, moves it to partly received on that
   receipt and **validates** it (ADMIN_GLOBAL); the reservation is confirmed on
   it (the deposit gate);
4. the client uploads the two required documents; the back office marks them
   received (the balance gate);
5. the client asks again and gets the **balance** (`SOLDE`), whose amount plus
   the deposit's equals the parcel's total; the same six steps; the remaining
   payment is confirmed on it;
6. the client's summary owes **0**, as an exact number; the back office's
   payment list holds `ACOMPTE:VALIDE` and `SOLDE:VALIDE` for that reservation.

**6 of 6 green.** Reservation `474807f6-a078-4441-8e79-124fee91dcfd`, deposit
`601b5fcf-b3b2-4f69-9c9b-d2184e7eae69`, balance
`a43f9d04-3386-4f13-8461-88dfe043169d` - left in place, so the back office has a
deposit and a balance side by side (the screen check #225 lacked).

**The first run failed, and why:** the test expected `purpose` on the client's
"request a payment" answer, which returns id, reference, amount and currency
only - by design; the purpose is read from the back office now. Its reservation
(`ff93951d-…`) was cancelled and its INITIE deposit annulled by hand, both
through the admin API with a reason. That surfaced `G8` follow-up: **cancelling
a reservation does not close its live payment.**

**Also:** checking that the file skips by default ran the regular journey suite
against dev once from a laptop (29 passed) - the suite CI runs after each
deploy, which cleans up after itself.

### G8 - second attempt, stopped again at Part 0 - `ARRETE`

**The re-land did not happen.** The brief said PR `#89` had been re-landed on
develop and asked me to verify rather than take it on report. Verifying is what
found it.

| Check                                                         | Result                                                                      |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `git merge-base --is-ancestor 230b827 origin/develop`         | **NO**                                                                      |
| `origin/develop:libs/common/src/payments/payment-channels.ts` | **absent**                                                                  |
| `send-instructions` routes on develop                         | **0**                                                                       |
| A new PR carrying the work                                    | **none** - open PRs: none; merged since `#89`: only `#90`, my own G8 report |
| develop head                                                  | `fab3f1d` = `#90`, on top of `f40974b` = `#88`                              |

`#90` - the document _describing_ this problem - was merged at 11:17:50Z. **The
record landed; the work did not.** The only `#89` merge is still the original one
into the dead branch at 10:01:10Z.

## Part 0, every check, as facts

Each one fails, and they all fail the same way.

| Check                                                | Evidence                                                                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Served sha matches develop's head                    | `imageTag: sha-f40974b` vs develop `fab3f1d` - **they no longer match either**, because `#90` merged after the last deploy. The deployed code is still `#88` |
| `POST /lands/client/payments/{id}/instructions` gone | **Still present.** The v02 send is live: a client's click emails every channel's coordinates                                                                 |
| Deployed receipt DTO accepts `OMO`/`MOMO`            | enum is `["VIREMENT","MOBILE_MONEY","ESPECES","ACTE_NOTARIE","INCONNU_HISTORIQUE"]` - **`OMO` no, `MOMO` no**                                                |
| Channel service reports `perOperator`                | `Payment channel details loaded {"prefix":"…","fields":12}` - **the old line**; the deploy did not carry it                                                  |
| `send-instructions` / request-queue routes           | **absent from the deployed API**                                                                                                                             |

The running task is unchanged from the previous attempt - same `startedAt`
`10:07:30.982Z`.

## Parts 2 and 3 - not run

Part 2 for the same reason as before: every step depends on undeployed code, and
running it would mean deploying the missing work first, which is stepping around
the defect to obtain the proof.

Part 3 is now unblocked _in principle_ - `A18` makes the failed set readable - but
still needs `A18` itself deployed, and half 1 marks a parcel `SOLD` while half 2
needs a deliberately broken agent lookup on shared dev. Half an answer to a
question asked as a pair settles nothing, so neither half was run.

## What unblocks G8, unchanged

Branch from `230b827`, PR to develop, merge - `git merge-tree` still reports
**zero conflicts**. Deploy. Then re-run. Until then dev sends full bank
coordinates to any client who clicks.

---

### G8 - the end-to-end proof on deployed dev - `ARRETE`

**Cost impact: None.** Nothing built, nothing applied. Read-only verification
plus one mutation run locally.

**The chantier stopped at Part 2, before the first step.** Its premise -
_"everything from G1 to G14 is merged and deployed"_ - is not true, and the
reason is a merge that went to the wrong place by ninety seconds.

## What actually happened to G11-G14

|                                                             |                                     |
| ----------------------------------------------------------- | ----------------------------------- |
| `#88` (G9) merged **to develop**                            | `2026-09-07T09:59:41Z` -> `f40974b` |
| `#89` (G11-G14) merged **to `feat/g9-payment-entry-point`** | `2026-09-07T10:01:10Z` -> `230b827` |

`#89`'s base was the G9 branch, because G11-G14 was stacked on G9 and develop did
not carry it at the time. That was correct when the PR was opened. But the G9
branch was merged into develop **eighty-nine seconds before** `#89` landed on it -
so `#89` merged into a branch that had already been consumed, and its merge commit
sits on nothing.

```
git merge-base --is-ancestor 230b827 origin/develop  ->  NO
git show origin/develop:libs/common/src/payments/payment-channels.ts  ->  absent
```

**51 files, 3 753 insertions, are not on develop and not deployed.**

## What is live on dev right now

The deployed API is `sha-f40974b`, which is G9. Its payment routes include:

```
POST /api/v1/lands/client/payments/{id}/instructions
```

That is the **v02 behaviour v03 exists to correct**: the client's own click sends
an email listing every channel's coordinates - bank account, mobile money number,
notary address - to whoever clicks. `G11-G14` deleted that route and that
template. Neither deletion is deployed.

Absent from the deployed API: the request queue, the back-office send with a
chosen channel, the client's coordinates page, the preferred-channel route, and
the reviewer route A14 needs. The deployed receipt DTO accepts
`VIREMENT, MOBILE_MONEY, ESPECES, ACTE_NOTARIE, INCONNU_HISTORIQUE` - **`OMO` and
`MOMO` do not exist in deployed code at all**, so Part 2 step 5 could not be run
even in principle.

~~**Recovery is clean.** `git merge-tree` between develop and `230b827` reports
**zero conflicts**.~~ **That was wrong** - the grep behind it could not fail. The
real merge conflicts in eleven files, all of them an artefact of `#88` being
squash-merged. Corrected in `R1`, which is what actually re-lands it.

---

## Part 1 - the deployed state, as facts

Each with what it was read from. **This part passed, and it closes `G10`.**

| Fact                                                                              | Evidence                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Served sha matches develop's head                                                 | `GET /health/version` -> `imageTag: sha-f40974b`, `gitSha f40974ba…`, and `git log origin/develop -1` is `f40974b`. **They match - and that is the problem**: develop's head is G9, not G14                                                                          |
| Sixteen channel parameters, all SecureString, none empty                          | `aws ssm get-parameters-by-path --with-decryption`: count **16**, types `{SecureString: 16}`, and the empty-value query returns nothing                                                                                                                              |
| The four per-operator parameters exist                                            | `ORANGE_MONEY_NUMBER`, `ORANGE_MONEY_NAME`, `MTN_MONEY_NUMBER`, `MTN_MONEY_NAME` are present - infra `#24` was applied                                                                                                                                               |
| Task definition revision **143** carries the three variables and no channel value | `PAYMENT_CHANNELS_SSM_PREFIX`, `PAYMENT_CHANNELS_TRANSPORT=ssm`, `PAYMENT_VALIDITY_DAYS=30`. Searching the whole container definition for every channel name and placeholder value returns **NONE**; `secrets:` holds only the four database URLs and the JWT secret |
| No `AccessDeniedException` on `ssm:GetParameter`                                  | CloudWatch filter over the startup window: **0 events**                                                                                                                                                                                                              |
| The channel service loaded                                                        | `Payment channel details loaded {"prefix":"…","fields":12}`                                                                                                                                                                                                          |

**On that last line: it says `fields: 12`, and it cannot say otherwise.** The
`required`/`perOperator`/`total` line is commit `d93c427`, which is on the
orphaned branch. So **`perOperator` is not reportable from this deployment** - not
because the parameters are missing (all sixteen are there) but because the code
that would count them is not deployed. The parameter listing above is the
reliable evidence, and it says the four are present.

## Part 2 - not run

Stopped at step 1. Every step depends on code that is not deployed. Running it
would have meant deploying the missing work first, which is the definition of
stepping around the defect to obtain the proof.

## Part 3 - not run, and for a different reason

Not a defect: an access limit and a judgement.

- **Half 2 is not observable from here.** "What the failed set holds" is a read of
  BullMQ's failed set in ElastiCache - `kambriq-dev-redis.sbdmsp.ng.0001.euc1.cache.amazonaws.com`,
  a private VPC endpoint. Nothing exposes queue counts: `/health` reports
  `database-core`, `memory_heap`, `memory_rss`, `disk`,
  `database-kbs-exam-questions` and no queue. It needs ECS Exec into the task with
  a redis client, or a queue-health endpoint that does not exist.
- **Half 2 also needs a deliberately broken agent lookup on a shared dev
  environment** - deleting or corrupting a seeded agent. That is the shape of act
  that produced `H5`/`H6`, and it is not one to take unilaterally while the
  chantier is already stopped.
- Half 1 alone (a sale whose agent exists, producing a commission row) **is**
  runnable and would mark a parcel `SOLD` on dev. Half an answer to "does it fire,
  and does it fail loudly" does not settle a question asked as a pair, so it was
  not run either.

## Part 4 - the mutation, run locally on develop

Removing the guard that forbids an automatic transition on a business event:

```diff
 ): void {
+  // MUTATION: the guard is removed.
+  return;
+
   if (!COMMITTING_STATES.has(to)) return;
```

**RED: `api` 3 failed / 469 passed, `common` 16 failed / 261 passed - 19 failures
across 3 suites. GREEN: 472 and 277.**

The nineteen name the property: _refuses a committing transition made on behalf of
a system actor_, _refuses a committing transition with no reason_, _refuses
"auto"/"worker"/"cron" as the actor_, _PARTIELLEMENT_RECU refuses an empty actor_,
_ANNULE refuses a blank reason_, and `G4`'s _refuses to validate without a reason,
through G1 guard_.

## One thing that was my working tree, not develop

The first run of develop's suite showed **5 suites failing**. That was a stale
generated Prisma client in my checkout - the local database carries the `G11`
migration, so the generated lands client had the new channel enum while develop's
source has the old one. After `prisma generate` against develop's schema:
**472 passed**. Develop's suite is green. Worth recording because "develop is red"
would have been a false alarm reported with conviction.

## What has to happen before G8 can run

1. Branch from `230b827`, PR to develop, merge. Zero conflicts.
2. Deploy. The `G11` migration runs on dev's real rows - it rebuilds the
   `PaymentChannel` enum and maps `MOBILE_MONEY` to `HIST`; dev holds **1**
   receipt, already `INCONNU_HISTORIQUE`.
3. Confirm the startup line then reads `perOperator: 4`, `fields: 16`.
4. Re-run this chantier.

### G10b (infra) - sixteen channel parameters, and importing the twelve that exist - `PLAN PRET`

**Cost impact: None.** Four additional SSM Standard parameters (free tier is
10 000). No new resource type, no new service.

`kambriq-infra` PR, opened before the `G10` apply has run - which it has not:
`kambriq-dev-api` is still on revision 141 and carries no `PAYMENT_*` variable.

**v03 section 9 now says sixteen, not twelve.** Splitting mobile money into `OMO`
and `MOMO` needs `ORANGE_MONEY_NUMBER`, `ORANGE_MONEY_NAME`, `MTN_MONEY_NUMBER`
and `MTN_MONEY_NAME`: two operators, two numbers, two account names. `PR #23` was
written when mobile money was one channel. Applying it as it stood would have
left `OMO` and `MOMO` failing at send time - the correct failure, loud and not a
boot failure, but found only on the first real send and costing a second apply.

## The old mobile-money trio is kept, and it is now read by nothing

`MOBILE_MONEY_OPERATOR`, `MOBILE_MONEY_NUMBER`, `MOBILE_MONEY_NAME` stay.
Checked against **`feat/g11-g14-identification-and-channels`** (webapp PR #89),
not against webapp develop, which does not carry the new names:

- `CHANNEL_FIELDS` sends `OMO` the Orange pair and `MOMO` the MTN pair. **No
  channel reads the three.**
- `PaymentChannelsService.FIELDS` still lists all three as **required at
  startup**, and an absent or empty one refuses the boot.

So removing them from terraform would stop the API starting on dev the moment it
deploys - trading a channel that cannot be sent for an environment that will not
run. The order is: drop them from `FIELDS` in the webapp, merge and deploy that,
_then_ remove them here. Registered as a follow-up.

## Import blocks, because `ignore_changes` does not protect a first create

The twelve were created by hand during `G3` and have never been in state.
`lifecycle { ignore_changes = [value] }` protects a value on subsequent applies
and does nothing on the first, where `overwrite = true` writes the declared value
straight over the live one.

Without importing, the plan calls them creates and **a correction made between
the plan and the apply would be silently reverted** - and the plan would say
nothing, because it has nothing to compare against. This is the same blind spot
that nearly converted twelve SecureString bank details to plaintext in `G10`.

With `import` blocks in `envs/dev/imports-payment-channels.tf` the same plan
reads **12 to import**, and the twelve changes are `description`, `overwrite` and
three tags. **`value` and `type` carry no diff marker at all** - verified across
all sixteen blocks programmatically, not by eye.

## Declared versus live, all sixteen, before planning

`aws ssm get-parameters-by-path --with-decryption`: the twelve existing
parameters match the declaration **in value and in type** (`SecureString`,
`alias/aws/ssm`, `Standard`). Zero value mismatches, zero type mismatches. The
four new ones are absent, as expected, and are genuine creates.

## The plan, unapplied

```
Plan: 12 to import, 5 to add, 13 to change, 1 to destroy.
```

5 to add = the four parameters + one task-definition revision. 1 to destroy = the
revision it replaces. 13 to change = the twelve imported (tags/description only)
plus `web_nextauth_secret`, which is **pre-existing drift on a tag's sensitivity
marking**, not from this branch.

The task definition receives exactly `PAYMENT_CHANNELS_SSM_PREFIX`,
`PAYMENT_CHANNELS_TRANSPORT` and `PAYMENT_VALIDITY_DAYS` - **no channel name and
no channel value**, checked by parsing the task-definition block out of the plan.

## Ordering that matters, and it is not obvious

**The apply must come BEFORE webapp `#88` is merged and deployed.** `#88` turns
an absent channel configuration into a startup failure - which was the requested
fix, because a completely absent configuration was the only case that merely
warned. Neither `PAYMENT_CHANNELS_SSM_PREFIX` nor `PAYMENT_CHANNELS_TRANSPORT`
is in any task definition until this apply runs. **Merging `#88` first means the
API does not boot on dev at all.**

## Fictitious, and deliberately not diallable

A Cameroonian mobile number is `+237 6XX XXX XXX`. A placeholder of that shape
can be copied into a transfer form and the money leaves. The dev values are not
numbers at all - `DEV-NUMERO-ORANGE-FICTIF-NE-PAS-UTILISER` - and say so in their
own text.

---

### G11-G14 - identification before coordinates, six channels, delivery in the platform - `PROUVE LOCALEMENT`

**Cost impact: None** in this repository. Four SSM parameters are **owed by
infra** - see "what infra must add" below - without which `OMO` and `MOMO`
cannot be sent.

Specification: `ops_kambriq_paiement-hybride_v03`, sections 4b, 4c, 4d, 5, 6.
**This corrects a design error, not a bug.** v02 sent an automatic email listing
every channel to anyone who clicked. KAMBRIQ identifies the client first, then
answers with the one channel that suits him.

## Six channels, and the code is not the label

`libs/common/src/payments/payment-channels.ts` is the single registry: code,
label, what the proof is, and whether the payer is routinely somebody else.
**Neither the code nor the label is derived from the other** - `'OMO'.toLowerCase()`
is not "Orange Money", and any code that tried would be one rename from lying.

| Code   | Canal                            | Preuve                                    |
| ------ | -------------------------------- | ----------------------------------------- |
| `VIR`  | Virement bancaire                | Avis de virement, au nom du client        |
| `DEPO` | Depot d'especes sur notre compte | Bordereau de versement, au nom du verseur |
| `OMO`  | Orange Money                     | Confirmation de l'operateur               |
| `MOMO` | MTN Mobile Money                 | Confirmation de l'operateur               |
| `ESP`  | Especes en main propre           | Recu KAMBRIQ                              |
| `NOTA` | Paiement chez le notaire         | Acte notarie                              |
| `HIST` | Historique, canal inconnu        | Aucune - lignes reprises                  |

`SELECTABLE_CHANNELS` is **derived** from the registry's `selectable` flag, so
`HIST` is offered in no list a person can choose from and a seventh channel
cannot be added to one list and forgotten in the other.

**The migration could not annotate the rows it changed, and that is the trigger
working.** `MOBILE_MONEY` maps to `HIST`, because the pre-v03 model never
recorded which operator it was and guessing puts a name on a row nobody can
stand behind. The first draft also wrote the old value into the row's `note` -
and `PaymentReceipt_append_only` refused it: _"append-only table PaymentReceipt:
UPDATE is refused. A correction is a new row, never an edit."_ A schema
migration is not an exemption from immutability, and disabling the trigger to
annotate a row would have replaced a guarantee held by the database with one
held by whoever remembers to switch it back on. **This is also the first time
that trigger has ever been observed firing** - the `G5`/`G7` assessment recorded
it as "true because nothing has broken it yet".

Forward, backward, forward on the local database: `PaymentReceipt` checksum
`536f97af2f9f6f6531460c7eaa7000ad` before and after.

## Two fields, never one

`preferredChannel` is the client's declared wish - may be null, binds nothing.
`channel` is what the back office chose and communicated. `preference-is-not-the-channel.spec.ts`
checks the pair from three directions: the send never writes the preference, the
channel never falls back to it, and both columns exist separately. Forced red
both ways - a send that also wrote `preferredChannel`, and a read with
`?? preferredChannel` - each failing on its own.

The wish is shown wherever the payment is shown, including before anything is
decided, and the send control shows it **beside** the choice with nothing
preselected: a control that arrives with the preference already chosen makes
accepting it the path of least resistance.

## The gate: verified, not submitted

`assertClientIsIdentified` refuses `INITIE -> INSTRUCTIONS_ENVOYEES` unless the
client's `idVerificationStatus` is `verified`. `pending` means a document is
sitting in a queue and says nothing about whether anybody looked at it.

**It is called twice, and that is not duplication.** In `transition`, which is
the corridor every state change passes through; and in `sendInstructions`
_before the send_, because G3's ordering sends first and transitions afterwards -
so a gate only in `transition` let an unverified client receive the notification
and merely stopped the state from moving. Found by the gate's own test asserting
nothing was sent and counting two emails.

**The exits are deliberately ungated.** A request from somebody who never
completed their identification must still be refusable, expirable and
cancellable, or an unverified client's payment would be stuck for ever.

## A14 - the review screen, because the gate needs it

The queue and the review route have existed since PR #83 with nothing rendering
them. `G12` turns that from an untidiness into a blockage: no verification, no
payment. Three screens now exist, and two defects were found building them:

1. **Identity documents came back as raw S3 keys**, unopenable. A review screen
   that cannot show the document turns "verified" into a click, which is worse
   than no review because it produces a record saying somebody checked. Signed
   now, in parallel, like the avatar beside them.
2. **The reviewer could not read the person.** v03 section 8 puts verification on
   `ADMIN_LANDS`; `GET /users/:id` is `ADMIN_GLOBAL`. Rather than widen the whole
   user record - which would hand every lands admin the user table to get at two
   photographs - `GET /users/id-documents/:id` returns the person, their contact
   and their signed documents, and nothing else.

## Delivery inside the platform

The coordinates render on the client's own page, behind their authentication.
The email says they are available and **contains none of them**.
`no-coordinates-in-email.spec.ts` fails on the G3 behaviour: reinstating
`channelBlock` turned it **5 failed / 12 passed**, and it passes 17/17 on v03.

`channelBlock` is deleted rather than left unused - an unused renderer of bank
details is one import away from being used again - and so is `instructionArgs`,
which built the message by spreading **every** channel detail.

**The reminder leaked too**, and G3's suite asserted that it did, under the name
_"repeats the instructions rather than referring to them"_. The reasoning was
sound and the conclusion was wrong: it sent the coordinates a second time, to
people who had not opened them once. Inverted.

## The channel is never in the reference

`formatReferenceWithChannel` puts the code after `·`, and
`no-channel-in-reference.spec.ts` fails on a hyphen specifically. Forced red
twice: `${reference}-${code}` and `${reference} ${code}`, one failure each.

## Proof, run locally end to end through the screens

|                                       |                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Reference                             | **`KBQ-2609-CY44P-2`**, 340 000 XAF, _Parcelle Douala Logbessou_                                                                |
| Client's declared preference          | **`OMO`** (Orange Money)                                                                                                        |
| Send attempted before verification    | **403** — _"Ekani Marcelle's identity is \"pending\" - a document is waiting in the review queue"_. Nothing sent, nothing moved |
| Identity verified from the A14 screen | by `pierre.lands@kambriq.com` (**`ADMIN_LANDS`**, the widened role)                                                             |
| Channel chosen and sent               | **`VIR`**, deliberately different from the preference                                                                           |
| MessageId                             | `010701a07b145337-193a7916-9434-43df-b204-3b15ca3397f4-000000`                                                                  |

Audit trail:

```
(null) -> INITIE                 —    client   "Acompte requested by the client for reservation 73ed3f7a-…"
INITIE -> INSTRUCTIONS_ENVOYEES  VIR  admin    "Cliente en France, compte bancaire a son nom : virement plus
                                                sur que mobile money pour 340 000 XAF. Convenu par telephone…"
```

The client's page returns `preferredChannel: OMO`, `channel: VIR`, and
coordinates containing **only** `bankName`, `bankAccountName`, `bankIban`,
`bankSwift` plus the support contact - no mobile money number, no notary address.

**Reading the email found one defect.** The footer rendered _"Ecrivez a ou
appelez le ,"_ - two blanks - because the new notification args did not carry
the support contact. The G3 lesson exactly: found by reading what arrived. Fixed
on both the notification and the reminder. The new French strings had also lost
their accents; restored.

## What the gate does to the 35 payments already on dev

Stated as a fact before anybody discovers it. On dev today: **29 `ANNULE`, 5
`INITIE`, 1 `PARTIELLEMENT_RECU`**, and **71 identity documents pending review,
the oldest waiting 3 days**. Not one of those payments belongs to a verified
client.

- The **29 `ANNULE`** and the **1 `PARTIELLEMENT_RECU`** are untouched: the gate
  only guards `INITIE -> INSTRUCTIONS_ENVOYEES`.
- The **5 `INITIE`** are the ones it would refuse - and **all five already could
  not be sent**, because they are `G1` backfill rows with `reference: null` and
  `sendInstructions` has refused those since G3.

**So the gate changes nothing for the existing rows.** It bites on the first
payment a real client creates, which is the point.

## What infra must add before OMO or MOMO can be sent

v03 splits mobile money in two _because the numbers differ_, and its section 9
still describes **twelve** required parameters carrying one operator-agnostic
number. The two cannot both hold. Four parameters are owed:

`ORANGE_MONEY_NUMBER`, `ORANGE_MONEY_NAME`, `MTN_MONEY_NUMBER`, `MTN_MONEY_NAME`

They are **not** part of the startup requirement - refusing to boot every
environment until infra catches up is a worse answer than refusing one channel
loudly - so a send on `OMO` or `MOMO` fails naming the missing parameters, and
`VIR`, `DEPO`, `ESP` and `NOTA` work today.

## Not implementable as written

**v03 section 5 contradicts section 4b on the separator.** 4b is explicit:
`KBQ-2609-7F3K2-B · OMO`, _"jamais KBQ-2609-7F3K2-B-OMO"_. Section 5's own
example then reads « KBQ-2609-7F3K2-B - Mobile money (Orange Money) » - a hyphen,
which is the character 4b forbids and which the brief asks a test to fail on.
**4b is implemented**; section 5's example is treated as prose that predates the
rule. Worth settling in v04.

## What the next chantier needs from this

The downloadable payment sheet and `ANNONCE_CLIENT` are deliberately not built.
They will need: `communicatedDetails` on the audit row (the coordinates as sent,
already written), `formatReferenceWithChannel` for the sheet's header, the
`FIELD_LABELS` map in `my-payment-content.tsx`, and a client transition route -
the client currently has no route that moves a payment at all, by design.

---

### G9 - the payment entry point, and G10's webapp half - `PROUVE LOCALEMENT`

**Cost impact: None.** No new resource. Two routes, one card on a screen that
already existed, and two variables declared.

## Who creates a payment, and why the client

**The design decides it, twice.** The state table in
`ops_kambriq_paiement-hybride_v01.docx` gives `INITIE` a "Qui le declenche" of
**"Le client, sur la plateforme"**, and section 3 reads **"Le client declenche,
la plateforme instruit, le paiement a lieu dans le monde reel, le back-office en
apporte la preuve, la plateforme valide."** The `.md` in the same folder flattens
that table and loses the column, which is why it was worth opening the `.docx`.

The two alternatives, and why not:

| Candidate                                        | Why not                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Automatic when a reservation reaches a state** | Forbidden outright: _"Aucune transition n'est automatique sur un evenement metier."_ A payment appearing because a status changed is an obligation with nobody's name on it - the `KCA_CERTIFIED` shape applied to money                                                                                                                         |
| **A back-office action**                         | Workable, and it makes the platform the initiator of a commercial act, which is the opposite of _"la plateforme n'encaisse pas, elle orchestre et elle atteste"_. It also means a client who wants their reference has to telephone somebody for it - a strange requirement for a reference whose whole purpose is to be _"dictee au telephone"_ |

And the client's own purchase page already displayed the acompte, with its amount,
and **nothing to press**. The step existed; the act did not.

`POST /lands/client/purchases/:id/payment`, `@Roles(CLIENT)`, ownership checked by
reading `clientUserId` off the row rather than trusting the request.

**There is no amount on the wire.** It is read from the reservation, because a
caller who can name their own `amountDue` can decide what they owe. A test asserts
the handler's signature carries no `@Body` at all.

## Creation is a named act, and it writes its own audit row

`createPayment` now requires `createdBy` and `reason`, and refuses a system actor
through `assertActorIsNamed` - one definition of "a named actor", shared with the
transition guard rather than copied beside it. The refusal happens **before the
sequence is touched**, so a refused creation does not burn a reference.

The payment and its `PaymentTransition` are written in **one transaction**. `G7`'s
assessment found that creation wrote no audit row at all: every trail on every
environment began at the payment's _second_ state, and the only rows with
`fromState IS NULL` anywhere were the ones the `G1` migration backfill wrote.
**Closed here rather than left to `G7`.**

## Two acts, not one

Creating the payment puts the reference **on screen**. Emailing the instructions is
a second call - `POST /lands/client/payments/:id/instructions` - for the same
reason recording an encaissement is separate from validating one: a failed send
must not cost the client their reference, and asking again must not create a second
payment. The card says so: _"Votre reference est valable meme si vous ne recevez
pas l'email."_

## One payment per reservation, and the set that is not `TERMINAL_STATES`

Asking twice returns the payment that exists. The first draft used
`TERMINAL_STATES` for "may be replaced" - and that set contains `VALIDE`, so a
client whose acompte was already settled could have created a second one and been
asked to pay twice. Only `REJETE`, `EXPIRE` and `ANNULE` allow a fresh attempt,
which is what those exits are for. Covered by its own test.

## Proof, run locally end to end through the client screen

Signed in as a real client account (`CLIENT` role, activated through the ordinary
reset flow, never a hand-written row):

|             |                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| Reference   | **`KBQ-2609-8ZEEH-Z`**                                                                                       |
| Amount      | 325 000 XAF, read from the reservation                                                                       |
| MessageId   | `010701a0791e93c2-22500886-e862-4c4c-aae4-fd65211d6439-000000`                                               |
| Audit trail | `(null) -> INITIE` by the client, then `INITIE -> INSTRUCTIONS_ENVOYEES` by the client, each with its reason |

**The email was read in the destination mailbox, not inferred from a send.** It
carries the reference, `325 000 XAF` (the currency once), and _"A regler avant le
7 octobre 2026"_ - a human date, no ISO. The three channels render the deliberately
fictitious dev values, which say in their own text not to send money to them.

**Local, not deployed.** The brief for this chantier says nothing is merged or
pushed to an environment, and the dev proof needs both this branch and `G10`'s
terraform. See the PR for what exactly remains.

## PAYMENT_VALIDITY_DAYS - a number that needs a decision

The instruction email says _"A regler avant le ..."_, so a payment needs an expiry
or the message reads _"avant le —"_. The design says a payment expires _"au-dela du
delai de validite"_ and **never says what the delay is**. 30 days is declared in
`env.validation.ts` and in terraform, and it is **a choice, not a specification** -
one month, the shape of an international transfer from the diaspora the design
names. Written down here as an open question rather than left to look like a
decided fact.

## G10's webapp half - the asymmetry, corrected

An absent `PAYMENT_CHANNELS_SSM_PREFIX` used to **warn and return**; an empty
parameter threw. That is backwards, and it cost three deploys.

Now `PAYMENT_CHANNELS_TRANSPORT` is `'ssm'` by default and the prefix is
**required**; running without channels is `PAYMENT_CHANNELS_TRANSPORT=disabled`,
which is a sentence somebody wrote rather than a variable somebody forgot. The rule
is `StorageService`'s, already in this codebase: _disabling must be a choice, never
an inference from absent configuration._

`payment-channels-config.spec.ts`, 7 tests, including the one the brief asked for:
**the unconfigured branch throws, it does not return** - asserted behaviourally
_and_ against the source, so restoring the early `return` fails even if somebody
relaxes the behavioural tests at the same time.

Writing it found one more hole: `PAYMENT_CHANNELS_SSM_PREFIX="   "` read as
configured, passed the startup check, and would have failed later inside the SDK
with a message about a malformed path. **Whitespace is absence.**

## Found, not fixed

The `mylands` surface formats money with `formatXAF`, which appends "FCFA", while
the payment card uses the single `formatMoney`. One screenshot therefore shows
_"325 000 XAF"_ in the card and _"Acompte de 325 000 FCFA attendu"_ in the step
below it. The card uses one formatter; the divergence across the wider surface is
51 call sites and is not this chantier's.

---

### G4 - the back office: recording encaissements, their proofs, and validating - `PROUVE`

**Cost impact: None.** No new resource. Proofs go to the existing
`kambriq-media-dev` bucket through the existing `StorageService`; the objects are
private and read back through short-lived signed URLs.

G1 gave the model, G2 the reference, G3 the message to the client. This is the
half a person uses: a payment list, a payment detail with its ledger, its proofs
and its full history, a form that records an encaissement with its document, and
a validate action that says what it commits before it commits it.

**The screen was inside this chantier on purpose, and that is what found the
defects.** `A10` shipped a queue the API could answer and nothing rendered, and
that is recorded here as a defect. Building the screen in the same PR as the API
turned up **five** faults that typechecking and 445 unit tests could not see,
every one of them only visible on a real request:

| #   | What was wrong                                                                                      | What it looked like                                                    |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | `libs/common/package.json` declared `"type": "commonjs"`; Turbopack applied it to the shared source | `/admin/payments` returned 500; the error named neither app            |
| 2   | `LandsAdminController` ('lands/admin', with `@Get(':id')`) was registered before the payments one   | `GET /lands/admin/payments` answered "Parcelle de terrain introuvable" |
| 3   | the web actions were typed `<{ data: T }>` over a client that already unwraps the envelope          | "Cannot read properties of undefined (reading 'reference')"            |
| 4   | `getProofUploadUrl` returned `StorageService`'s whole `{uploadUrl, fileUrl}` as `uploadUrl`         | the browser PUT the file at `/admin/payments/[object Object]`          |
| 5   | the screen could not walk the state machine, and offered `validate` where it was illegal            | the barrier fired correctly and the page rendered a stack trace        |

Numbers 3 and 4 are the same class: **a type that lies is worse than no type**,
because the compiler then agrees with the defect. Number 2 is invisible to a unit
test by construction - it tests the class, not the routing table.

**Recording and validating are two calls, and moving is a third.** `recordReceipt`
appends to the ledger and moves nothing. `validate` moves state and touches no
money. `transitionAsAdmin` walks the steps in between - and had to be built,
because the path is `INSTRUCTIONS_ENVOYEES -> ANNONCE_CLIENT -> EN_VERIFICATION ->
PARTIELLEMENT_RECU -> VALIDE` and nothing could drive it. Without it the screen
offered the one-hop jump, the transition table refused it, and a payment sat with
8 000 000 XAF in its ledger and nowhere to go.

**RBAC, and where the four-eyes guard goes.**

| Act                                         | Role                          | Why                                                                                 |
| ------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| read the list and one payment               | `ADMIN_LANDS`, `ADMIN_GLOBAL` | seeing money is not moving it                                                       |
| record an encaissement, upload/read a proof | `ADMIN_LANDS`, `ADMIN_GLOBAL` | the ledger is append-only; a wrong line is corrected by a signed line, never erased |
| move to a state in `COMMITTING_STATES`      | `ADMIN_GLOBAL`                | those are the states that commit money                                              |
| validate                                    | `ADMIN_GLOBAL`                | the act that commits, with its own control and its own reason                       |

The committing-state rule is **derived from `COMMITTING_STATES`**, the same set
`assertTransitionIsDeliberate` reads - not a second hand-written list of "the
dangerous ones", which stops agreeing the first time either changes. A test
asserts the guard contains no state name as a literal.

**The four-eyes seam is `assertFourEyesIfRequired`** in `payments.service.ts`,
called by `validate` before the transition, taking `(paymentId, actorUserId,
amountDue)`. It is empty and does nothing today. It is placed there rather than
in the controller because the rule it will hold - _the person who validates is
not the person who recorded_ - needs the ledger, and the ledger is not in the
request. Building it needs a decision this chantier was told not to take: what
happens to a payment when only one administrator is available.

**Proofs.**

- **(a) end to end, locally, through the screen.** Payment `KBQ-2609-FZKX3-Z`,
  8 000 000 XAF, reservation `45435cc6` on parcel _Parcelle Douala Akwa_.
  Two partial receipts recorded by `pierre.lands@kambriq.com` (`ADMIN_LANDS`):
  3 000 000 XAF by virement received **2 September**, 5 000 000 XAF by mobile
  money received **5 September**, both entered on **6 September** - the real
  receipt date is not the entry date, and the ledger stores both. Each carries an
  uploaded PDF: `payments/f33ba6bb-.../1788733778147-proof-1.pdf` and
  `.../1788733818505-proof-2.pdf`, 630 and 625 bytes in `kambriq-media-dev`,
  **403 to an unsigned GET**. The state was still `INSTRUCTIONS_ENVOYEES` with the
  balance fully covered - recording validated nothing. Then five named steps by
  `admin@kambriq.com` (`ADMIN_GLOBAL`), each with its reason, ending `VALIDE`.
- **(b) recording also validating goes red.** Mutation: after appending, sum the
  ledger and transition to `VALIDE` when it covers `amountDue`.
  **RED 6 failed / 439 passed -> GREEN 445 passed.** The six name the property:
  `appends to the ledger and moves nothing`, `even when the receipt completes the
amount due`, `records a receipt that has its proof`, `recording money changes no
state`, `records three partial encaissements and computes the total`, `a
correction appends a negative line and never edits one`.
- **(c) the computed total is not writable**, extended to the new endpoints.
- **(d)** a receipt without a proof is refused, and `INCONNU_HISTORIQUE` is not
  offered to a new receipt - the channel select is built from
  `RECORDABLE_CHANNELS`, so the excluded value cannot be picked on the screen
  either.
- **(e) the two display rules**, each forced red on its own:
  a hard-coded `XAF` in a heading -> _no currency is written into the screen
  beside an amount_; an `Intl.DateTimeFormat` in a component -> _the screen
  formats displayed dates through formatHumanDate and nothing else_.

**The money display test was not enough, and the mutation is what showed it.**
It banned the alternative _formatters_ - `formatXAF`, `Intl.NumberFormat`,
`toLocaleString`. A literal `XAF` typed beside a rendered amount produces
`"750 000 FCFA XAF"` just as well and needs no formatter at all; the sweep passed
straight over it. The currency itself is now banned on that surface. **An
assertion whose failure has never been observed is a claim** - this one had been
written, had passed, and did not do what its name said.

**`pnpm db:seed` was broken by G1 and is fixed here.** The seed deletes
reservations on seeded parcels; G1 made `Payment.reservationId` a foreign key and
made the ledger and audit trail append-only in the database. A reservation with
money against it therefore cannot be deleted **by anybody, including the seed** -
the run died with a bare `ForeignKeyConstraintViolation` after Core, KBS and
Kamnet had already been written. That is not a bug in the triggers: money that
arrived is not test data, and a reset that could erase a receipt could erase
evidence. The seed now skips those reservations **by name, out loud**, naming the
payment references it kept and why, and completes. dev would have hit this at G8.

**The deployed-dev pass is G8's, not this chantier's.** G8 must now also exercise:
one payment carried through the back-office screen with two partial receipts and
their uploaded proofs, and the proof read back through a signed URL.

**Found, not fixed, not in scope.** The API logs `Duplicate DTO detected:
"GetUploadUrlDto" is defined multiple times with different schemas` on every boot:
`apps/api/src/lands/dto/lands.dto.ts:163` and
`apps/api/src/kbs/courses/dto/course.dto.ts:122` are two different schemas under
one name, so the rendered OpenAPI carries whichever wins. Neither file is touched
by this chantier and fixing it means renaming a DTO across two modules.

---

### G3 - the payment instruction and the reminder - `PROUVE`

**Cost impact: None.** Twelve SSM Standard parameters (free tier is 10 000), no
new resource, no new dependency. The runtime SSM read is one `GetParametersByPath`
per minute per task at most.

G1 gave the model, G2 gave every payment a reference that cannot be miscopied
silently. This puts that reference in front of the client.

**Both templates are transactional and neither is in `SUPPRESSIBLE_TEMPLATES`.**
`A11` made the allow-list fail safe - an unclassified template is transactional -
so this needed no change to the barrier, and four tests hold it there: the
allow-list membership, `isTransactional`, the real `sendUpdate` throwing on both
templates, and the service source containing no `sendUpdate` at all.

**Channel details: the SSM SDK at runtime, and that is a decision.** `B3` found
that only 7 of 56 parameters reach the container as ECS `secrets`; the other 49
are terraform-rendered and do not change until an apply. A wrong account number
must be correctable with one command, so `PaymentChannelsService` reads
`/kambriq/{env}/api/payment-channels` through the SDK and caches for 60 seconds.
**A bank-detail correction takes effect within a minute and needs no deploy.**

**Nothing is optional.** Twelve required parameters; a missing or empty one fails
at **startup**, naming all of them rather than the first, and `get()` throws
rather than returning a set with a blank. Dev's values are deliberately
unmistakable - `DEV-COMPTE-FICTIF-NE-PAS-UTILISER` - because an invented IBAN
that looks plausible is worse than an obviously fake one.

**The ordering, which is the substance of this chantier.** Send first, transition
only if the send succeeded. The other order produces the one state the system
must never hold: a payment in `INSTRUCTIONS_ENVOYEES` that nobody was ever told
about, indistinguishable downstream from a client ignoring their instructions -
the dunning queue would chase them for a message that does not exist. This way
the worst case is a duplicate instruction, which is honest.

**Mutation:** transition-then-send. **2 failed / 404 passed** -
`leaves the state untouched when the send throws` and
`sends first, and only then transitions`. Restored: **406 passed**.

**A real email, read out of the destination mailbox.**

```
reference : KBQ-2609-3ZPQC-F   (from the real generator, off the real sequence)
messageId : 010701a078ad7052-21bd5cc8-55bd-41c4-870f-1f1e2d8ea784-000000
subject   : Votre référence de paiement KAMBRIQ : KBQ-2609-3ZPQC-F
```

**And the first one was wrong, which is the finding.** The initial send -
`KBQ-2609-PZTGM-K`, messageId `010701a078ac276f-24454f48-…` - arrived reading
**"750 000 FCFA XAF"**, the currency twice, and gave the deadline as
`2026-10-06`. Both passed every test and were invisible in the code: `formatXAF`
appends "FCFA" itself. **Found by reading the message that landed, not by reading
the template.** Kept in `CLAUDE.md`: a message is done when somebody has read
what arrived.

The corrected message reads `750 000 XAF` and `6 octobre 2026`.

**What was deliberately not built.** The scheduler that decides _when_ a reminder
fires is **`G6`**, with the dunning queue. `PaymentsService.sendReminder` is the
path G6 calls; a test asserts this chantier contains no `@Cron`, no
`setInterval` and no repeatable job. The back-office screen is `G4`.

**Also fixed on the way, because it was in the way.** `PaymentsService` was never
registered in `LandsModule` - G1 added the class and wired it nowhere, which
nothing noticed because nothing called it. Registered here with
`PaymentChannelsService`.

---

### G2 - the payment reference generator - `PROUVE`

**Cost impact: None.** One sequence in an existing database, one module, no
dependency.

Specification: `ops_kambriq_paiement-hybride_v01.md`, "La reference de
paiement". G1 defined the column, its unique index and its format `CHECK`;
nothing filled it. This fills it.

**The alphabet is derived once**, `A-Z0-9` minus `O 0 I L 1 S 5`, 29 characters.
One duplicate could not be removed - G1's `CHECK` spells the class in SQL and
cannot import TypeScript - so a test asserts the two are character-for-character
identical. **Reported as the one thing in the specification's spirit that could
not be implemented literally.**

**The check character: a weighted sum modulo 29.** 29 is prime, and that is the
whole argument. A single wrong character shifts the sum by `w·d`, never zero mod
a prime larger than both factors. A transposition shifts it by
`(w_i − w_{i+1})(v_i − v_{i+1})`, and consecutive weights differ by one, so it is
zero only when the characters are identical - when there is no error to detect.
Luhn mod N gets the first and misses specific adjacent pairs.

**Detection, measured over 2 000 references:**

| Class                                       | Tested | Caught | Rate       |
| ------------------------------------------- | ------ | ------ | ---------- |
| single wrong character                      | 20 000 | 20 000 | **100%**   |
| transposition within `YYMM`                 | 15 000 | 15 000 | **100%**   |
| transposition within the body               | 24 131 | 24 131 | **100%**   |
| transposition across the `YYMM`/body hyphen | 4 816  | 4 654  | **96.64%** |

**The boundary is not total, and the reason is exact.** A character is worth its
digit value in `YYMM` and its alphabet index in the body - `'2'` is 2 on one side
and 22 on the other - so a swap changes both values in a way the weighting cannot
cancel reliably. Most such swaps are caught by the **format** instead, because 22
of the 29 alphabet characters are letters and a letter in a digit slot is
refused. The residue needs both characters to be digits, the shift to cancel mod
29, and a person to transpose across a hyphen - the one place the eye anchors.
**Recorded as a measured limitation rather than rounded up to 100%.**

**Collision-free by construction.** The body encodes a Postgres sequence value
through a bijection over the 29^5 space. `nextval` is serialised across
concurrent transactions and never returns a value twice; a bijection cannot
collide. **Randomness would have been _unlikely_ to collide, which is a different
property and not the one asked for.** The bijection also stops consecutive
references reading as a running count of the month's business.

**When the unique index fires** - only possible if the counter wraps 20 511 149
values inside one month - `createPayment` retries with a fresh counter, up to
five times, logging each collision. `P2002` rolls the insert back so nothing
half-exists. After five it throws `ConflictException` **having created nothing**:
the payment is refused, not silently made without a reference. Proven by
mocking `P2002` twice (payment created on the third attempt, three distinct
references attempted) and permanently (five attempts, nothing created, and a
different error code passed through untouched rather than swallowed as a
collision).

**Validation rejects, it never corrects.** `O` is not in the alphabet, so a `0`
in the body is unambiguous evidence of a typo; mapping it would produce a
**different valid** reference and attach one person's money to another's payment.
Case, spaces and hyphens are normalised because they are presentation. The
restriction is **positional** - a `0` in `YYMM` is January.

**Mutation.** Removing the check-character comparison from `validateReference`:
**3 failed / 254 passed**; restored, **257 passed**. The three are
`a single wrong character is always caught`,
`two adjacent characters transposed is always caught WITHIN a segment`, and
`says why it refused, because the back office has to tell the caller`.

**Proven against a real database**, not only in tests: the migration applies on a
scratch database, `nextval` returns `1|2|3`, a generated reference inserts
successfully against G1's `CHECK`, and `KBQ-2609-O8ZD9-Y` is refused by Postgres
with `violates check constraint "Payment_reference_format"`.

**Deliberately not built.** The instruction email (`G3`), the back-office screen
(`G4`), and any extension beyond payments. If a second module ever needs paying
for, this becomes a platform allocator - G1's entry says why, and it is a
decision, not a pre-build.

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

### D3 - The four Prisma baselines were deleted by a docs commit - `PROUVE`

**Tracker correction, 27 September - proven by every deploy since.** The pending
proof was one deploy whose migration task exits 0 on the restored baselines; the
deploy fails on anything else, and every develop deploy since has passed. Today's
migration task (stream `api/api/24022681e25c4a47bfaa4c76029a67d1`) reads, for
core, kamnet, kbs and lands: `5 / 3 / 3 / 9 migrations found in
prisma/migrations`, `No pending migrations to apply` - no `db push`.

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

### L2 — Logging drops metadata at 106 call sites — `PROUVE`

**Tracker correction, 27 September - proven since L3.** The pending proof, "one
deployed log line carrying its interpolated metadata, quoted", has been on dev
since L3 lifted the payload into fields:
`{"context":"CleanupScheduler","pattern":"0 7 * * *","msg":"Contact digest cron scheduled"}`
(CloudWatch Insights `filter ispresent(pattern)` matches it). Nobody closed the
row.

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

### L3 — Log payloads as queryable fields — `PROUVE`

`%o` makes payloads **readable** but not **queryable**: the object is serialised
into the message string, so CloudWatch Insights cannot filter on `userId` or
`examId` as fields. Migrating to `PinoLogger`'s `info(obj, msg)` puts them at the
top level of the JSON, which is what the migration buys.

**Decision:** do it later, as its own chantier. Roughly 102 call sites plus DI
changes, and it should not ride along with a change whose value is that it is
mechanical. **Cost: none.**

**Done, 26 September - by a different method than the one recorded, for the
same result.** The decision was to move about 102 call sites to
`PinoLogger.info(obj, msg)` so the payload lands at the top level of the JSON.
Counted again: **161** logger calls, 119 with `%o`. But
`logging-metadata.spec.ts` already forces every one of them into one shape - a
message ending in `%o` and a single object - and nestjs-pino hands that to pino
as `({ context }, 'Contact digest sent %o', { count, pending })`. So one
`hooks.logMethod` in the API's pino options lifts that object into top-level
fields and keeps the words as the message: `{"context":"ContactService",
"msg":"Contact digest sent","count":0,"pending":0}`. **Same outcome, one point
of change, and no call site touched** - which also keeps Ulrich's code as it
is. If Visquis wanted the call sites rewritten anyway, say so and it is a
mechanical follow-up.

- A payload key that would overwrite one of pino's own fields (`msg`, `level`,
  `time`, `context`, `req`, `err`...) goes under `data` instead.
- An Error, an array, or anything but a plain object is left to pino exactly as
  before - and that surfaced a fact worth writing down: **pino prints an `Error`
  passed through `%o` as `{}`**. No call site does it today (checked).
  **Tracker correction, 26 September (eighth round): that check was wrong.** It
  looked for an Error passed as the whole payload; it missed an Error inside the
  payload (`{ error }`, three sites, written `{}`) and an Error passed without a
  placeholder (ten sites, dropped outright). See "Errors logged under err".
- **Proof, red first:** `structured-fields.spec.ts` runs the real pino-http
  logger: the payload becomes fields, a colliding key goes under `data`, non-plain
  payloads come out identical to pino alone, and without the hook the payload is
  text inside `msg` (the defect, pinned). A fifth test requires `app.module.ts`
  to carry the hook. Mutations: no lifting (fails two), no collision guard (fails
  one), the hook unwired (fails the wiring test).

**Proven on dev, 26 September (after `7bb28ee` deployed).** The CloudWatch
Insights query `filter ispresent(pattern) | fields context, pattern, msg` on
`/ecs/kambriq-dev-api` matched 6 records: `CleanupScheduler`, `pattern` =
`0 7 * * *`, `msg` = `Contact digest cron scheduled` (and the dunning and
certificate-expiry schedulers alike). The same line from the previous image,
read the same way, was `"msg":"Contact digest cron scheduled {\"pattern\":\"0 7 * * *\"}"`

- the payload was text in the message, now it is a field.

### Errors logged under err - `PROUVE`

**Cost impact: None.**

**The brief:** the logging library prints an error object as `{}`; no code does
it today, so put the rule in before the first time it hides a real error.

**The premise was mine, and it was wrong.** The seventh round wrote "no call
site does it today (checked)"; the check only looked for an Error passed as the
whole payload. Measured on 26 September, from nestjs-pino's `Logger.call` and
the L3 hook, two other shapes lose an error, and **13 call sites used them**:

- `logger.error('Core database connection failed', error)` - no placeholder,
  so pino **drops the argument**: no message, no stack. Eight Prisma service
  handlers (connect and disconnect, four databases), the readiness check, and
  the Redis client's `error` event. `logging-metadata.spec.ts` never saw the
  Prisma ones: it skips every folder named `prisma`, generated or not.
- `logger.warn('clientDocumentUploaded email failed %o', { error })` - L3 lifts
  the payload, and pino writes an Error under any key but `err` as **`{}`**.
  Three email-failure warnings in `reservations.service.ts`.

**The fix:**

- **`err` is the one key that keeps an error.** pino-http serialises a top-level
  `err` as `{ type, message, stack }`. The L3 hook treated `err` as reserved and
  moved it under `data`, where it became `{}` too; it now passes an Error under
  `err` through.
- **The 13 sites** now log `'... %o', { err: error }`.
- **`log-errors-in-err.spec.ts`** (libs/common, beside the metadata rule) refuses
  an error-named identifier (`error`, `err`, `e`, `exception`, `cause`) passed as
  a bare argument, or as a payload value under any key but `err`. It walks the
  hand-written `prisma/` service folders and skips only the generated clients.

**Proof, red first:** the static spec listed exactly the 13 sites; the hook test
("an Error under `err` is written with its type, message and stack") failed with
the error under `data`, then passed. A second test pins the old defect: an Error
under `error` is `{}`. API suite 1 114 and common 378 green.

**Pending:** one real error line on dev read with its message and stack - the
next failed email or dropped connection.

**Eleventh round - the queue path was outside the rule.** Asked to prove the
path on dev with a harmless failed queue job, the job's line turned out not to
carry `err` at all: `LoudWorkerHost` (A54) logged `error: error?.message`, a
string, so every failed job lost its error's type and stack, and triggering one
would have proved nothing about `err`. The guard did not see it because the value
is a property access, not a bare error. Now `LoudWorkerHost` logs `err: error`;
`failed-jobs-are-logged.spec.ts` requires the Error itself under `err` (red
first) and still excludes the payload. **Pending:** one failed job on dev, read
with `err.type`, `err.message` and `err.stack`.

**Proven on dev, 27 September (twelfth round).** Authorised by Visquis. One
`kamnet.sale-completed` job for an agent id that does not exist, `attempts: 1`,
enqueued from inside the API task: the processor throws at its first lookup,
before any write. The log line: `msg: Queue job failed`, `queue: kamnet`,
`job: kamnet.sale-completed`, `attempt 1/1`, **`err.type: Error`**,
**`err.message: Sale completed but the agent user does not exist in core (...)`**,
**`err.stack`** starting `at KamnetProcessor.handleSaleCompleted`. No payload in
the line. Before #247 the same job would have logged a message string and no
`err` at all.

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

### X2 — NAT gateway — `PROUVE`, option 2 applied 12 September (infra D15)

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

**26 September - the seventh round asked for the apply, and it was not made.**
The round's brief said: read the plan, report it, apply on dev under the
standing authorization. This entry says, in its last paragraph, that
**implementation is Ulrich's, on his own PR**. Of its two preconditions, S1 and
B3 are now both `PROUVE`; the ownership line still stands. The standing
authorization is explicit that when a brief and the register disagree, the
disagreement is reported rather than resolved by choosing. **Pending Visquis:**
whether this is now his to hand over, or Ulrich's PR to wait for. Nothing was
planned or applied. D15 is a tracker ID with no row here.

**Tracker correction, 26 September - the premise was false, and the hold was
right for a reason neither side saw.** Visquis's eighth-round brief: the
architecture document has said since 15 September that dev runs without a NAT,
and the bill shows no NAT line on 13 and 14 September. Checked rather than
taken on trust: `kambriq-infra` CLAUDE.md, "D15 - dev has no NAT gateway, and
the tasks are in public subnets", **applied 12 September 2026**; and
`aws ec2 describe-nat-gateways` for `available` or `pending` returns nothing.
This entry was never updated after the apply, so it still read "deliberately
unapplied". Nothing was applied on 26 September and nothing is to be.

**What remains is on the bill, and the bill is Visquis's:** the NAT's address
went away, but each Fargate task now holds one, so public-IPv4 hours go from
about 72 a day to 96-98. The net saving is smaller than option 2's -$35.34 and
is read on the invoice, not estimated here.

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

### I38 - a candidate could train inside a course they were not enrolled in - `PROUVE`

**PR #155**, merged as `5fb55f4`. Run **35509437289**, conclusion success.

**Cost impact: None.** One new file, no column, no resource.

**Six entry points, not the three the brief named.** `findQuestionsForQuiz`,
`findModuleDetail`, `findLessonById`, `findLessonView`, `markLessonComplete` and
`submitQuiz` all read a module or a lesson by id and never asked which course it
belonged to. `findLessonView` was the sixth, found by reading rather than by
being told.

**Two of the six write.** `KbsCandidateProgress` and `KbsLessonCompletion` were
banked against a course the candidate was not studying, so the damage outlived
the request.

**The fix.** `apps/api/src/kbs/settings/active-course.ts`: `readActiveCourse`
returns the settings row, because `examPoolShortfall` and `findModuleDetail`
read counts from it; `assertInActiveCourse` refuses with `NotFoundException`
rather than `ForbiddenException`, so a candidate does not learn that a foreign
module exists, and it reuses `kbs.module.notFound` and `kbs.lesson.notFound` so
no user-facing wording was invented. The three write paths refuse; the read-only
display paths tolerate an absent settings row, because `I21` established that a
missing row is a state and not a 500.

**Proved red against a real database.** `kbs-quiz-course-scope.dbspec.ts`, new,
against Postgres and the real kbs migrations. Before the guard the five refusal
assertions **resolved instead of rejecting**, and the two absence assertions
found rows that should not exist.

**Why no unit test could have caught it.** Every existing quiz unit test mocks
`kbsModule.findUnique` returning a module with **no course context at all**. The
discriminating data was not in the fixture, so no amount of running those tests
could ever have produced a difference to observe.

**Reported, not fixed.** Injecting `KbsSettingsService` was measured and
rejected: about seventeen spec files construct these services with explicit
provider lists, and a new constructor dependency makes each **fail to
instantiate** - and a suite that fails to build is not red. The function takes
the `KbsPrismaService` all four services already hold. `submitQuiz`'s
`previousModules` check is **not** redundant after the guard: the guard proves
the module is in the active course, that check proves the earlier modules were
passed.

---

### I42 - the seed undid the course switch on every run - `PROUVE`

**PR #156**, merged as `2314c80`.

**Cost impact: None.**

**What it did.** `seed.ts` upserted the KBS settings row with
`update: { activeCourseId: IDS.KBS_COURSE }`, and `IDS.KBS_COURSE` is the
two-module **demonstration** course. So any re-seed silently pointed the active
course back at the demonstration data, undoing a switch to KCA1 with no message
and no failure.

**The fix, and why it is a `where` clause.** `prisma/kbs-settings-apply.ts`:
create carries the id, a NULL row is repaired, and a row naming a course is left
alone whichever course it names. The condition is a `where` on `updateMany`, so
**Postgres holds the rule** rather than this code remembering to check it. It
returns an outcome - `created`, `repaired` or `left-in-place` - and the seed
prints it, because a mechanism that reports success by saying nothing is the
defect being fixed.

**Proved red in three states, each watched.**

| state                                                  | "a switch survives a re-seed"                         | "a NULL row is repaired"                       |
| ------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------- |
| `update: { activeCourseId }` - develop's code          | **RED** `Expected "…33467a4a" / Received "…672c3721"` | green                                          |
| `update: {}` - the obvious fix, forbidden by the brief | green                                                 | **RED** `Expected "…615b8585" / Received null` |
| the fix                                                | green                                                 | green                                          |

Either assertion alone passes for the wrong reason, which is why there are two
and why both wrong fixes were run rather than reasoned about.

**A test defended the defect.** `seed-ids.spec.ts` asserted the id appeared in
the upsert **twice** - accurate about the code, wrong about the requirement, and
green for exactly as long as the defect existed. Inverted, not deleted: it pins
the wiring while the dbspec proves the behaviour.

**Proved by execution** against local docker through the real `pnpm db:seed`,
in the discriminating form: a row switched to another course is reported
`left alone` and is unchanged; a row set to NULL is `repaired`. The first run
reported "left alone" over a row that already held the seeded id, where leaving
it and rewriting it look identical, which is why the switched row was the proof.

---

### I17 - the candidate routes carried no role - `PROUVE`

**PR #157**, merged as `9663f47`.

**Cost impact: None.**

**`RolesGuard` returns true when a route declares no roles.** `kbs-candidate.
controller.ts` declared none, at class level or route level, so **21 candidate
routes were open to any authenticated user**. Route-level roles were added, never
class-level: 4 role-free, 17 guarded.

**The first red was vacuous, and that is the lesson.** The loop iterates the
routes that _have_ roles, and in the red state that list is empty, so every
assertion inside it was satisfied while not one route carried a role. A second,
independently failable assertion was added:

```
● the role-free candidate routes are exactly the pre-candidate surface
    - Expected  - 2
    + Received  + 21

● every other candidate route demands CANDIDATE_KBS
    Expected length: 19
    Received length: 0
```

**Escalated, and decided by Visquis: `GET /kbs/me` and
`GET /kbs/certificate/me` stay role-free.** They are the "am I enrolled / do I
hold a certificate" probes, which only have a point when the answer may be no.
Guarding them turns a 404 into a 403, and the web's `nullOn404` catches exactly
404 while `create-action.ts:40` rethrows everything else - so `/kbs/enroll`, the
page the public call to action links straight at, would have rendered an error
overlay instead of its form. Healthy for everyone already enrolled, broken for
exactly the population being added.

**A count in the brief was wrong and is corrected here**: the controller carries
21 routes, not 22, so 17 are guarded rather than 20. It changes neither the
design nor the risk.

**Reported, not fixed.** `getCourseModules` carries an `if (!candidate)` branch
for non-enrolled users that is now unreachable. Guarding `GET /kbs/courses`
forecloses a pre-enrolment catalogue; nothing calls it today, and a public
catalogue would belong on `kbs-public.controller.ts`.

---

### P9 - sponsorship stops at the direct sponsor - `PROUVE`

**PR #158**, merged as `f52e21f`. Repaired by **PR #160**, `22a5c79`.

**Cost impact: None.** One query is smaller.

**The arbitration, taken by Visquis on 20 September**, written into the code:
`KAMNET_MAX_SPONSORSHIP_DEPTH` 3 to 1, and `MANAGER_REFERRALS` removed - MANAGER
is ten completed sales and nothing else. `_count: { referrals: true }` came out
of `checkPromotion`, because a count loaded for a condition that no longer exists
is a query nobody can explain later. `findById` keeps its own count: that is the
profile's `referralCount`, and referrals still exist and still matter.

**Both fixtures were chosen to discriminate.** The depth fixture is four deep in
both directions, so an answer of one level proves the **clamp** and not the shape
of the data; a shallow fixture agrees with every possible limit. The promotion
fixture has **zero** referrals, because ten-sales-and-ten-referrals is promoted
under the old rule and the new one alike.

**A hardcoded 3 the constant never reached.** `DEPTH_FOR_TIER` in
`agent/network/page.tsx` held a literal `3`, so the page went on asking for a
depth the action silently clamped. It is also why one of the three inverted tests
did not go red when the constant changed: it was agreeing with the page rather
than with the platform.

**It turned develop red, and that is the part worth keeping.** The sweep that
followed the constant searched its **name** and corrected nine comments and three
web tests. It missed `kamnet-network-isolation.spec.ts`, which encodes the old
value **numerically** - `network(eric, 3)` - and describes its effect **in
prose** - "four below him: Eric sponsors three directly, one of whom sponsors
Amina". Neither string contains `KAMNET_MAX_SPONSORSHIP_DEPTH`, `N3`, or the
digit in any form the sweep looked for.

```
● does not put Eric's referrals in Sylvie's network
  Array [ "AGT-2025-0002", "AGT-2025-0003", -"AGT-2025-0004", "AGT-2025-0005" ]
```

`AGT-2025-0004` is Amina, at N2 - exactly the level the constant had removed.
The platform was right and the test was stale. **The delivery journeys are
skipped on pull requests and run only on the push after a merge**, so no PR gate,
however green, could have caught it. #160 proved the repair red first against
`sha-f52e21f` with `EXPECTED_SHA` set: 1 failed / 5 passed before, 6 passed
after.

**A second journey test was passing for the wrong reason.** `answers a depth of
3 for a JUNIOR` was `I32`'s live evidence - a JUNIOR asking for 3 received N1 to
N3, proving the server never reads the caller's tier. Clamped to 1 for everybody
it still passed and proved nothing. It now asserts the levels present rather than
a count, against Eric, whose data goes two deep; Sylvie's subtree is one level
deep in the seed, so "stops at N1" would hold for her under any clamp at all.

**`I32` is not closed.** `getMyNetwork` still never reads the caller's tier; the
rule lives in the page. The depth change shrinks what that gap can expose,
because everyone is clamped to N1 anyway. **A narrowed blast radius is not a
fix**, and the day the depth rises the hole is the size it always was.

**Reported, not fixed.** The depth DTOs still `.max(3)` and the `ApiQuery` still
lists `[1, 2, 3]`, so a caller may ask for 3 and be clamped rather than refused.
`KamnetCommission.level` remains an `Int` that accepts 2 and 3, and the admin
create-commission endpoint still does too, though nothing produces them.

---

### P20 and P21 - the public site stopped promising what does not exist - `PROUVE`

**PR #159**, merged as `78a8bec`.

**Cost impact: None.**

**P21: a commission schedule that exists nowhere.** `products.kamnet.commissions`
published, in French and in English, _"3 % de la valeur de vente, versés à J+15
après validation de la transaction"_ and _"1 % de la valeur de vente, versés à la
confirmation de la réservation"_. A rate, a base and a payment deadline: the
precision is what makes it a promise. **No rate exists in the platform** - see
`C14` in the dated decisions - the 5% lives in three seed literals and a comment,
and the grid has never been settled. The site promised agents a remuneration that
nothing computes, nothing pays, and nobody arbitrated. **P20** was the milder
form of the same thing: three service promises the page did not keep.

**Proved red on six assertions**, naming the offenders: `commissions.saleDetail`
and `.reservationDetail` for a rate quoted as remuneration in both languages,
`saleDetail` again for the `J+15` / `D+15` deadline, and ten (fr) / eleven (en)
keys for the earning promise.

**The pin was narrowed, because it flagged two honest strings** - the shape this
repository keeps relearning, where the copy that explains a thing is the first
casualty of a sweep that bans the word. `products.kbs.modulesDetail.items[3].
lectures[3].title` is a KCA1 lesson title, _"Argent & commissions - Pourquoi
l'agent ne touche jamais l'argent"_, which teaches the opposite of a promise;
banning it would delete curriculum. `products.kbs.hero.certificateBadge` (en) is
"Earn your KCA certificate", which earns a certificate, not an income.

**Why the ban is narrow, stated so nobody widens it carelessly.** Eight honest
public strings carry a percentage - "100% en ligne", "Score minimal : 80 %",
"évite 80% des erreurs terrain", "plus de 95% du territoire", and four
"Acompte ... 5%" lines. **The buyer's 5% deposit is real, implemented and
charged.** A guard that refuses it is deleted by the first person it blocks, so
what is banned is a percentage **with remuneration wording**, plus any `J+n` /
`D+n` delay - a pattern that occurred exactly once in the file, in the string
being deleted.

**Proved by mutation**: reinstating one removed string trips three assertions -
the rate ban, the delay ban, and the fr/en parity check, because the key came
back in one language only.

**Two dead components deleted**, which goes beyond copy and is a judgement call:
`commissions-model.tsx` rendered the schedule and `kamnet-hero.tsx` the old hero,
and neither symbol appeared outside its own file. **Worth knowing: the schedule
therefore had no mounted renderer** - it shipped in the message bundle rather
than on a rendered page. A component that still renders a deleted commission
schedule is how it comes back.

**Copy invented, for Visquis to approve**: `products.kamnet.hero.title` and
`.subtitle`, both languages, written around the chain the code already enforces -
candidate, KBS, certified, then agent application - and never around what an
agent earns. Four further strings were factual corrections rather than editorial.

**The guard's surface is narrower than its sentence, and this is open.** The ban
covers a hand-written list of message namespaces, and `landTypes` is not in it.
The public LANDS page, which addresses the **buyer**, still lists "Avantages
Agent KAMNET" per label, including "Commission rapide" for TFL - a remuneration
argument on a public page, which is exactly what this chantier removed elsewhere.
A hand-maintained list of namespaces drifts; the list of public namespaces should
be derived from what the public pages actually render. Same family as
[a negative matcher is a list of what somebody remembered to exclude](#a-negative-matcher-is-a-list-of-what-somebody-remembered-to-exclude).

**Reported, not fixed.** The login wall on `/kbs/enroll` is `P5`.
`whyKbs.network.description` and `whyAgent.exclusiveAccess.description` still
promise the exclusive catalogue, which is `P10`. `apps/web/src/app/kamnet/apply/
page.tsx` is a hardcoded French form with no API wiring behind it.

---

### P21 follow-up - the remuneration that survived, and the guard turned inside out - `PROUVE`

**Cost impact: None.**

**The row said:** the ban covers a hand-written list of namespaces and
`landTypes` is not in it. **That is half wrong** (tracker correction, 27
September): `landTypes` was in `PUBLIC_NAMESPACES`. Two things let the text
survive:

- the **rate** ban needs a percentage beside a remuneration word, and
  "Commission rapide, processus simplifié, client sécurisé." quotes none;
- the **earnings** ban read only `products.kamnet.*` and `products.kbs.*` - the
  enumeration was there, one level down - and its pattern knew "gagnez" but not
  "gagner", so `quickActions.questions.kamnetAgent` ("Comment rejoindre le réseau
  KAMNET™ et gagner des commissions ?", the pre-filled WhatsApp question) survived
  too, in both languages.

**The guard, inverted** (Visquis's instruction, the way P10's is built):
`public-copy-promises-no-rate.spec.ts` now reads **every string of both message
files** unless an `EXEMPT` entry covers it, each with its reason - `app` (the
signed-in spaces, where an agent sees their own commissions, 19 September),
`landsAdmin` (staff only), `products.kbs.modulesDetail` (the KCA syllabus
teaches how an agent is paid; it promises nothing). And C14 being unsettled, the
new rule is wider than a rate: **no public string mentions remuneration at
all** (word-bounded, so "learn" and "earn your KCA certificate" pass). Two
guards on the guard: every exemption must name something that exists, and a
namespace invented in the test ("brandNewPage", "gagnez des commissions") is
caught without being listed.

**Proof it catches what the old one missed:** the old spec was green on develop
with both strings present. The new one failed on exactly four entries -
`landTypes.tfl.advantages.agent` and `quickActions.questions.kamnetAgent`, fr and
en - and nothing else. A mutation restoring an enumerated list fails the
"added tomorrow" test.

**The copy, by deletion only** (no new wording, copy is Visquis's):
"Processus simplifié, client sécurisé." / "Simplified process, secured client.";
"Comment rejoindre le réseau KAMNET™ ?" / "How to join the KAMNET™ network?".

**Proven on dev (`96edf6c`, 27 September):** /fr, /en, /fr/products/lands,
/en/products/lands and /fr/products/kamnet carry "Processus simplifié, client
sécurisé" / "Simplified process, secured client" and "Comment rejoindre le
réseau KAMNET™ ?" / "How to join the KAMNET™ network?", and none of the old
wording.

### A38 - CI runs on every pull request, whatever its base - `PROUVE`

**PR #161**, merged as `4d722d8`. Gate run **35645150062**, conclusion success.

**Cost impact: None**, and it can only reduce: every expensive job stays gated on
push-to-develop.

**`ci.yml` declared `pull_request: branches: [main, develop]`**, so a pull request
whose base is a working branch matched no trigger and ran **no workflow at all** -
and GitHub still reported it mergeable. #155 carried 10 checks; #156, #157, #158
and #159 carried **zero**.

**It is worse than `A35`.** There, a green pull request does not prove the image
builds. Here there is not even a green to misread: there is nothing, and the
interface says everything is fine.

**The fix and why it is safe.** The `branches` restriction comes off
`pull_request`; `push` still restricts to `[main, develop]`. All five expensive
jobs carry `github.event_name == 'push' && github.ref == 'refs/heads/develop'`,
so widening the trigger cannot build, push to ECR, deploy, or run the journeys or
e2e. What it adds on a pull request to any base is `changes`, `commitlint`,
`quality`, `test-db` and `gate`.

**`ci-runs-on-every-pull-request.spec.ts`**, four assertions including a vacuity
guard. Watched red before the fix: 1 failed / 7 passed, the failure being
assertion 2 alone, `Expected pattern: not /^\s*branches:/m`. Both mutations
watched failing on their own: putting `branches` back fails assertion 2; removing
the `journeys` job's `if:` fails its own assertion. It parses text, not YAML,
because neither `js-yaml` nor `yaml` is a dependency and two sibling specs
already read build files as text.

**The behavioural half is an observation, not a test.** Nothing automated covers
GitHub's own dispatch.

**A correction to the finding, made by asking the API rather than my notes.** All
four stacked pull requests **were** re-targeted to develop before merging, and
all four were gated: 35620911896, 35623641855, 35626085692, 35642046441, every
one a success. What is true is the defect stated from the other side - while they
were stacked their original heads carried nothing at all, and still do:
`7cc8f53`, `d4ef20e`, `5bea3ca` and `a2cecef` each have **0 runs ever**. The
re-targeting is what gave them CI, and without it they would have merged with no
checks while GitHub called each one mergeable.

**Reported, not fixed.** `ci.yml` is deliberately left un-prettier-formatted.
Checked in place, develop's own copy is equally non-conforming, yml sits outside
the lint-staged globs, and `--write` rewrites 27 lines across eleven hunks in
jobs this chantier never touches.

---

### P11 - the public directory of certified agents - `PROUVE`

**PR #162**, merged as `2522278`. Develop's push run **35870416761** green,
journeys included; dev answers the directory with 200 and an empty list, which is
correct until an agent consents.

**Cost impact: None.** One nullable column, one public route, one page.

**What it is.** Agents consent to be listed - `publicListingConsentAt`, null by
default - a public directory lists only consenting agents, and the certificate
verifier gets a front door. 36 copy keys, fr and en, approved by Visquis on 22
September with four changes, applied.

**The defect Visquis caught, and it is the sharpest thing here.**
`app.agentProfile.emptyTitle` was rendered both when the caller has no agent
record **and when the read failed**, so a real agent opening `/agent/profile`
during an outage was told they were not an agent - a false statement about them,
made at the moment we could not check. The page now forks three ways. The action
`nullOn404`s a 404 and rethrows everything else, and `createAction` rethrows
anything that is not a `ServerActionError`, so a 500 or an unreachable API
arrives as a **rejected promise** rather than a failure envelope, which is why
the call is wrapped in `.catch(() => null)`. Both "it threw" and "it answered
`success: false`" mean unavailable, and the consent control renders in neither: a
control that cannot read the current consent cannot honestly offer to change it.
The test that asserted the old behaviour was **inverted, not deleted**, and the
one that matters asserts on the words rather than a `data-` attribute, because
the defect was the sentence.

**The certificate must provably belong to the agent.**
`toPublicDirectoryEntry` took the agent and the certificate as separate arguments
and never checked they described the same person - and the link between
`KamnetAgent.userId` and `KbsCandidate.userId` crosses two databases with no
foreign key, so it rested entirely on the caller being right.
`findNewestCertificateFacts` now carries `ownerUserId` out with the facts and the
projection refuses unless it matches. Proved red with a fixture pairing agent A
with agent B's valid certificate, both listable on their own so nothing else can
refuse the pair.

**The verifier is throttled now, rather than documented as open.**
`GET /kbs/public/verify/:kcaNumber` answered anonymously with no rate limit and
`kamnet-public.controller.ts` recorded that in a comment - on a public repository
that is an open weakness with a signpost beside it, and the numbers are guessable
by the service's own admission: `KCA-YYYYMMDD-XXXX` is a date and four hex
characters, 65 536 per issue date. It carries
`@Throttle({ default: { limit: 30, ttl: 60_000 } })` now, and
`public-routes-are-throttled.spec.ts` keeps it: a public route either throttles
or is named in an exemption list with its reason. Proved by mutation rather than
by a first green - removing the decorator fails 2, and adding the route to the
exemption list **also** fails 2, because the named assertion refuses the escape
hatch.

**The catalogues are pinned in lockstep**: 1606 key paths in each, none unique to
either side. The `P21` pin passes 9/9 over the new copy, which is what nesting
the directory under `products.kamnet` buys, since that namespace is already
swept.

**Merged under the bounded authorisation of 23 September. The independent review
was skipped deliberately, not forgotten.**

**Follow-ups opened and not started: `A41`** - throttle the five anonymous auth
routes - **and `P22`** - batch the certificate read and bound the directory.

---

### Audit 2026-09-23, wave 1 - security - `EN COURS`

**`e0caaf1` on `fix/wave1-security`. Not merged, not deployed.** Pending proof is
the merge, then the four fixes read on dev against the deployed sha.

**No tracker id is assigned here.** The 2026-09-23 audit was run in this
repository and its subjects have not been entered in Visquis's tracker;
inventing an `A`-series number here would collide with it. The two waves are
recorded under their content until an id is issued.

**Cost impact: None.** No resource. One dependency upgrade, described below.

**Four findings closed.**

- **The public contact form injected live HTML into the back office.**
  `libs/common/src/email/templates/index.ts` interpolated `${args['message']}`
  raw into the HTML of `contactRequestReceived` and `contactRequestNotification`,
  and `contact.dto.ts` accepts 5000 unauthenticated characters. Rendering the
  real template with `</p><a href="https://phish.example/reset">` produced a live
  anchor in the mail that lands in `contact@`. Closed by `libs/common/src/email/
html.ts` and pinned by `no-unescaped-email-markup.spec.ts`.
- **A refresh token was a valid access token.** `auth.service.ts` signed both
  from one payload with one secret, and `JwtPayload` carried no type claim - so
  every "sessions revoked" claim was true of refresh and false of API access.
- **Any agent could read any client's ID documents.** `lands-agent.controller.
ts` called `findOne(id)` with no owner check, while `cancel` two methods below
  passed `enforceOwnership: true`. Pinned by
  `agent-reservation-ownership.spec.ts`.
- **`/health/ready` answered 200 with the database down**, while its own
  `@ApiResponse` promised 503. `Dockerfile.api` and `deploy-dev.yml` both read it
  with `curl -f`, which fails only on 400 and above, so a database outage read as
  ready to both the container health check and the deploy gate. It throws
  `ServiceUnavailableException` now; the status code is the whole signal and the
  body is read by nobody. Pinned by `readiness-status.spec.ts`.

**The fifth finding is NOT fixed and is open.** `apps/web/src/app/layout.tsx:80`
passes the whole `auth()` session into `<Providers>`, which is `'use client'`, so
the API bearer token serialises into the RSC payload of every page.
`app/api/auth/[...nextauth]/route.ts` exists to strip exactly this from
`/api/auth/session`, and its comment says a grep confirmed it - **the grep asked
whether anything reads it, not whether it is shipped.** Verifiable with
`curl -b <cookie> https://dev.kambriq.com/mylands | grep -c accessToken`.

**The `next` 16.3.6 and `next-auth` beta.32 upgrade was folded into this commit
rather than kept separate**, so a revert takes the four security fixes with it.
That was a deliberate trade and it is the one thing worth knowing before
reverting. `next-auth` beta.30 fails auth checks **open**; beta.32 is the patch.

---

### Audit 2026-09-23, wave 2 - correctness - `EN COURS`

**`46061f4` on `fix/wave1-security`. Not merged, not deployed.** Pending proof is
the merge, then `GET /kbs/me` read on dev for a KCA1 candidate.

**Cost impact: None.**

**The headline: `GET /kbs/me` was the surviving unscoped KCA1 ratio.**
`candidates.service.ts` counted the denominator, the numerator and the module
list without filtering on `activeCourseId`, while the correct form sat 700 lines
below it in the same file. A candidate who had passed all four KCA1 parcours read
`4/6` and could not reach the exam. The three are now derived from one value,
because **scoping only the denominator is worse than scoping neither**: the
numerator would still count modules passed in another course, and the ratio would
report a finished course to a candidate who is halfway. Proved at both levels -
`progress-counts-course-scope.dbspec.ts` against a real database, and a rewritten
unit spec whose mock **answers the `where` it is handed**. The test it replaces
mocked `kbsModule.count` to 3 whatever argument it was given, so the scoped and
unscoped calls returned the same number and neither side of the ratio could be
observed; it was green through the entire life of the defect.

**`no-console` as an eslint rule, not a convention spec**, so it fires in the
editor and on the pull request that adds the line. `warn` and `error` stay: the
env validation banner prints before any logger exists, and `apps/web` has no
logger at all. Tests and the root `prisma/` scripts are exempt, each with its
reason at the exemption.

**And the exemption taught something that is now in the brief.** The rule was
verified with `pnpm run lint`, which is `nx run-many -t lint --all` and covers
**the six nx projects only**. The root `prisma/` directory belongs to none of
them, so 72 `no-console` errors in the CLI scripts were invisible to that command
and the pre-commit hook - which runs eslint from the repository root over staged
paths - rejected the commit. Two scopes, and the script name names neither.

**`"strict": true` on `apps/api/tsconfig.app.json`.** `tsconfig.base.json` sets
neither `strict` nor `strictNullChecks`, and `apps/web` and `libs/common` each
set it locally, so the API alone compiled with them off: every `T | undefined`
collapsed to `T`, and `dto.bio.length` typechecked on a DTO whose Zod schema
declares `bio` optional. Turning it on cost **one** error in the whole shipped
tree, in `queue-health.service.ts`, and it was real. Pinned by
`api-compiles-strict.spec.ts`, because removing the line resolves any strict
error and nothing else would report it.

**The seed gained two preconditions and lost five false commissions.** It upserts
users on **email** while every other module keys on the **id**, so an account
already at a seeded address keeps its own id and the seed's `IDS.USER_*` constant
is never written - across separate databases, where no foreign key can refuse the
dangling reference that follows. And five seeded `KamnetCommission` rows named
three reservation ids **nothing in the repository ever created**; they are
re-aimed at the two real reservations, the fifth is gone rather than re-aimed
because it claimed a sale on a parcel seeded `AVAILABLE`, and `main()` now checks
the references resolve after both modules are seeded.

**A flaky web test was repaired at its cause rather than its symptom.**
`contact-form.spec.tsx` failed once in ten runs on `toHaveFocus` pointing at the
email input. `user.type` sends a 240-character message one keystroke at a time
through a controlled input; under load the typing does not finish, the email is
validated partial and invalid, and react-hook-form correctly focuses the first
invalid field. Raising the timeout would have looked like the right repair and
left the assertion failing at a higher number. `delay: null` and a paste instead:
30/30.

**Two measured changes to the test scripts.** `nx run-many` at its default
`--parallel=3`, each project running jest at its own default worker count,
oversubscribes the machine; `--parallel=1` measured **faster** (55 s, 55 s, 49 s
against 63 s) and deterministic. `.nvmrc` carries `24` and `.npmrc` sets
`engine-strict=true`, so a machine on another major is refused with a message
naming the file rather than warned and allowed to continue.

**Also in the commit, and the user's own work:** a repository-wide comment
rewrite, and **section 9 of `CLAUDE.md`** setting the tone for code comments and
documentation.

**Still open from the same audit**, none of it started: the RSC bearer token
above; `/admin/verify` and `/kamnet/apply`, which are mocks behind real roles
that toast success and write nothing; the Mapbox build `ARG` in `Dockerfile.web`
that no workflow passes, so the land-search map is dark in every image; and the
legal exposure on `legal/mentions/{fr,en}.mdx`, which publishes
`Capital social : XXX XXX XAF` and `N° RCCM : XX / XXX / XX` on a public page.

---

### Audit 2026-09-23, wave 3 - the record - `PROUVE`

**On `fix/wave1-security`, not merged.** Proved locally, and nothing here needs a
deployed environment, which is why the state is `PROUVE`.

**Cost impact: None.**

**What it fixed, and it was this document.** Between 18 and 23 September the work
of PRs #155 to #162 was written into a `WAVE_STATUS.md` at the repository root
rather than here. Both files were maintained, by different people, and they
disagreed: this one still read _"Last closed: Friday 4 September"_ and mentioned
none of `I38`, `I42`, `I17`, `P9`, `P20`, `P21`, `A38` or `P11`. **The file every
session is told to load was the stale one**, so a reader who followed the
instructions got the wrong answer with the confidence the instruction lends.

Those eight chantiers now have entries above, and the wave note is archived at
`docs/ops/waves/2026-09-20-wave.md`, frozen, with a banner saying it is not the
record. It is kept rather than deleted because it carries the working detail an
entry condenses: the mutation tables, the premises checked one by one, the copy
approved key by key.

**Three further defects were sitting in this file and none had been noticed**,
which is the measure of how much it was actually being read:

- the `## Open` table **existed twice**, back to back, each copy carrying rows
  the other lacked. 66 rows in the first, 60 in the second, 12 of them found
  nowhere else, and a develop commit had updated a `P4` row that existed only in
  the second. Merged into one table;
- **`H1`'s entry had lost its heading**, so a `PROUVE` chantier's body hung off
  the end of that table and `### H1` matched nothing;
- **the states table declared four states while the document used eight.**
  `PROUVE LOCALEMENT` was carried by fourteen entries and defined nowhere, so
  whether it meant "nearly done" or "not deployed" was a guess. All eight are
  declared now.

**`C14` and `C15` were pulled out of the Drive base document** and entered in the
dated decisions, because nothing in this repository carried either and `P21`
rests on both.

**The guard: `register-is-the-record.spec.ts`**, seven assertions. One Open
table, no chantier listed twice, no state the document has not declared, every
open chantier either carrying an entry or named in an inventory pinned in both
directions, and no second file in the repository shaped like a record of work.
**Six of the seven were each watched failing alone**, on a register regenerated
clean between mutations - the first attempt let the mutations accumulate, and a
run that fails for a reason you introduced is not evidence about anything.

The duplicate-table mutation had to be made realistic before it proved anything:
inserted immediately after the header it corrupted the parse and tripped four
assertions, so the parser now stops at a second header and the assertion is
independently failable.

**Reported, not fixed: twenty-eight open chantiers have no entry in this file.**
Most are the 18 September wave, tracked in Visquis's tracker outside this
repository. The list is in the spec, pinned in both directions, so writing an
entry means removing its line.

---

### Audit 2026-09-23, wave 4 - two records that money arrived - `EN COURS`

**`fix/wave1-security`, not merged, not deployed.** Pending proof is one acompte
carried on dev: a client requests the payment, the back office records the
encaissement and validates it, and the admin step is refused before that and
accepted after.

**Cost impact: None.** No column, no resource, one extra read on a step taken
once per reservation.

**`confirmDownPayment` wrote `downPaymentConfirmed` and `status: CONFIRMED` in
one bare `landReservation.update`, with no amount, no currency, no receipt, no
evidence and no audit row.** `G1` separated recording money from agreeing that it
settles a payment and put every guarantee on `Payment`: the append-only ledger,
the single write path to the state, `assertTransitionIsDeliberate`,
`assertTransitionIsEvidenced`. `LandReservation` is a different table, so the
whole barrier was bypassed by one admin button.

**And `payments.service.ts` described it in the past tense while it was live**:
_"The old `confirmDownPayment` did both in one `update`, which is how a payment
becomes settled because somebody typed an amount."_ That sentence was written by
`G1` about the code `G1` was replacing, and nobody checked that the replacement
had reached the reservation. A comment refuses nothing, and a comment in the past
tense about live code is worse, because it reads as evidence the work was done.

**The direction it failed in is the dangerous one.** The reservation told the
client their acompte had been received while the ledger held nothing at all, and
`complete()` requires `CONFIRMED`, so the agent's KAMNET commission was
downstream of a checkbox.

**The fix is `I15`'s rule applied to a reservation step**: a field that projects
a record is written only after the service that owns the record says so.
`assertAcompteIsValidated` refuses unless the reservation carries a `Payment` in
`VALIDE` - the only state that means the acompte arrived **and** was agreed to
settle the payment, reached through `transition`, which demands a named actor, a
reason, and a receipt on that payment's own ledger. `PARTIELLEMENT_RECU` is
refused on purpose: part of the acompte is not the acompte, and it is the state
an operator is most likely to read as close enough.

The refusal lists every payment on the reservation with its state, because the
operator's next action differs completely between "no payment exists", "the
client has not paid yet" and "money arrived and nobody validated it".

`confirmedBy` and `confirmedAt` still record who advanced the reservation, which
is a different fact from who validated the payment. They were conflated while
this was the only record; they are not now.

**Proved red, then each expectation isolated.** Against the guard removed, which
is develop's behaviour, `acompte-projects-the-ledger.spec.ts` gives **5 failed /
3 passed**. Five further mutations, each watched failing on its own:

| mutation                                       | the one assertion that fired                     |
| ---------------------------------------------- | ------------------------------------------------ |
| `PARTIELLEMENT_RECU` accepted as settled       | refuses on `PARTIELLEMENT_RECU`                  |
| `payments[0]` instead of `.some(...)`          | accepts a `VALIDE` payment beside a refused one  |
| the ledger read moved ahead of the step guards | still answers the step guards first              |
| the refusal stops naming the payments          | names every payment and its state in the refusal |
| the guard moved after the write                | writes nothing and tells nobody when it refuses  |

**`reservation-money-projects-the-ledger.spec.ts`** keeps it the only writer, the
same shape as `single-state-write-path.spec.ts` for `Payment.state`: every Prisma
write to `landReservation` anywhere under `apps/api/src`, `libs/common/src` and
`prisma/` is read, and exactly one may claim the acompte. Four of its five
assertions were watched failing alone; the fifth is its vacuity guard.

**A defect in the sweep itself, found by running it.** The enclosing-method regex
borrowed from `single-state-write-path.spec.ts` walks back to the nearest
`name(...) {`, and `if (...) {` matches that shape - so the sweep reported `if()`
as the writer of the acompte. It now walks back to a declaration at class or
module indentation, with control-flow keywords excluded by name.

**Open, and stated rather than half-fixed: step 4, the balance, has no ledger at
all.** `requestPaymentForReservation` only ever creates the acompte, and `VALIDE`
is not in `REPLACEABLE_STATES`, so once the acompte settles no second payment can
be created against the reservation. Gating `confirmRemainingPayment` the same way
would block step 4 with nothing able to unblock it. It therefore still records the
balance on the reservation alone, with no amount and no receipt. The reason is
written at the method and the chantier is in `## Open`.

**And a consequence worth knowing before the merge**: every `PENDING` reservation
on dev carries no payment, so the admin confirm button will refuse until a payment
is created and validated for that reservation. That is the correct answer to the
question being asked, and it is a behaviour change an operator will meet on the
first click.

### A40 - the image optimizer fetched from any `*.amazonaws.com` host - `PROUVE`

**Cost impact: None.** One build argument and one GitHub variable, no resource.

The A40 triage (`AUDIT_a40-dependabot.md`, 23 September) classified 111
critical and high Dependabot alerts by what the images actually ship. Exactly one
critical was reachable by an anonymous visitor: GHSA-2xp9 (Next.js image
optimizer, RCE through AVIF), with the two `sharp`/libheif advisories behind it.
The web image runs `NODE_ENV=production` on every environment, so the optimizer
is on, and `images.remotePatterns` allowed `**.amazonaws.com` - which matches any
S3 bucket, including one anybody can create. Shown on dev with two benign URLs:
`s3.amazonaws.com` passed the allowlist and was fetched, `example.org` was
refused.

The wildcard was never a requirement. Its own comment said _"update with the
actual bucket hostname when configured"_ - a comment refuses nothing.

**The fix, without a dependency bump.** `src/lib/security/image-hosts.ts` is the
one list: `images.unsplash.com` (the home hero and the KBS page still load it)
and the media bucket, read from `MEDIA_BUCKET_HOST` at `next build`. The bucket
is `kambriq-media-<env>` in `eu-central-1` (terraform `modules/s3-media`, SSM
`/kambriq/dev/api/AWS_S3_BUCKET` compared without printing), with no CloudFront
in front. `next.config.ts` takes `remotePatterns` and the CSP `img-src` from that
list, so the two cannot drift. Unset variable: the bucket is refused, never
replaced by a wildcard. A malformed value fails the build.

What the bucket entry allows, stated plainly: any path and any query on that one
host, over https, on the default port. It has to accept any query, because
avatar and land URLs are presigned and every signature differs.

**Proof so far.** `image-hosts.spec.ts`, 25 tests. Red first against the old
config (the two `next.config.ts` tests), then green. Seventeen mutations, each
observed failing on its own, among them the brief's own (`**.amazonaws.com` back
in `next.config.ts`), a wildcard in the list, a fallback-open on a missing
variable, a loosened validation, a dropped port rule, drift between CSP and
patterns, and each of the three build-arg sites removed. The optimizer's own
matcher (`hasRemoteMatch`) accepts a URL presigned by the API's SDK with the API's
options, and refuses another bucket, `s3.amazonaws.com`, CloudFront and an
explicit port. `next build` with and without the variable produced exactly the
expected `remotePatterns` and `img-src`. The built standalone server, run
locally, answered the triage's request with `"url" parameter is not allowed`.

**Proven on dev, 23 September, on `sha-581f99d`**, built with
`MEDIA_BUCKET_HOST=kambriq-media-dev.s3.eu-central-1.amazonaws.com` (read from the
build log's `--build-arg`):

- the triage's request, `/_next/image?url=https://s3.amazonaws.com/&w=64&q=75`,
  answers **400 `"url" parameter is not allowed`**, and so does another bucket in
  the same region;
- two genuine bucket images - a land photo and an avatar, presigned locally with
  the API's SDK and options - come back through `/_next/image` as **200
  `image/jpeg`**, resized to 256 px;
- the CSP `img-src` on dev names `https://kambriq-media-dev.s3.eu-central-1.amazonaws.com`;
- under that enforced CSP, on a dev page in a real browser, the presigned avatar
  **loaded** (2048x1365, no violation) while an image from another bucket was
  **blocked** with an `img-src` violation.

**A regression on the way, recorded because it was mine.** #163 merged before the
variable existed, and dev ran `sha-239d13e`, from its deploy until the next one, refusing its own
bucket: land photos through the optimizer, and avatars too, because the CSP stopped
naming the bucket. The PR had warned only about the land photos. Setting the
variable and the next deploy (`sha-581f99d`) cleared both.

**Not observed:** the avatar on the account screen itself, which needs a signed-in
session. What was observed is the same URL shape under the same enforced policy.

**Not fixed here, and why A42 exists.** Naming the hosts removes the anonymous
way in. `sharp` and the optimizer are unchanged, so an image in our own bucket,
which any signed-in user can upload an avatar to, still reaches the same
library.

**Observed, not changed:** the CSP `connect-src` names no S3 host, while the
avatar uploader `PUT`s to a presigned S3 URL from the browser.

---

### A45 - the API counts rate limits per visitor, not per web task - `PROUVE`

**Cost impact: None.** One standard SSM parameter, which is free, once the
infra half described below is applied.

**Measured on dev before anything changed (23 September, `sha-f0e8819`), from
the API's own request log and marked requests:**

- the API's TCP peer is always the ALB (`10.0.1.x`), never the caller;
- a direct call arrives as `x-forwarded-for: <caller>`, one hop, and the guard
  picks the caller;
- a forged header arrives as `forged, <caller>` and
  `forged1, forged2, <caller>`: the ALB **appends** and never replaces, so the
  guard's last hop cannot be chosen by the caller;
- a call the web server makes for a visitor arrives as `x-forwarded-for:
3.71.109.x`, one hop - the web task's public IP, matched against its ENI - with
  `user-agent: node`. Nothing identifies the visitor;
- the web task's address changes at **every deploy**: four different addresses
  on 23 September (`18.197.188.x`, `18.184.213.x`, `3.70.216.x`, `3.71.109.x`).
  The CI runners that run the journeys also send `user-agent: node`, from Azure
  addresses.

So every limit on a route the web calls - login and register 10/min,
forgot-password and resend-verification 5, contact and newsletter 3, and the
global 100 - was counted once for the whole site. Someone calling the API
directly kept a bucket of their own.

**Why not the brief's shape.** "Accept the claim only when the connection comes
from the web service" cannot be checked. The connection is always the ALB, and
the web's address is new at every deploy. The web and the API share no secret
today: the web has `AUTH_SECRET` and `JWT_EXPIRES_IN`, and the API has four
database URLs and `JWT_SECRET`.

**The rule.** The web vouches for the visitor:

- it sends `x-kambriq-visitor-ip`, the last `X-Forwarded-For` hop of the
  incoming request, which the same ALB appended;
- it proves it is the web with `x-kambriq-caller-secret` (`WEB_CALLER_SECRET`).

The API believes the address only when that secret matches (constant-time, over
SHA-256 digests) and the value is a single IP address. Anything else falls back
to the old rule unchanged: no secret configured, none sent, a wrong or repeated
one, or a value that is not an address. The secret is shorter than 32
characters? Startup fails. It is unset? One warning at startup, and today's
behaviour. The secret header is redacted from the request log.

**Found, not fixed - opened as A46, open.** Only this subject's own header is
redacted here.

**Proof so far:**

- `rate-limit-per-visitor.spec.ts` runs over real HTTP through the real guard,
  with the requests shaped as the ALB delivers them. Red first: visitor B was
  refused (`Expected 200, Received 429`) after visitor A exhausted the web's
  shared bucket. Now visitor A's third call is 429 and visitor B is 200. Forged
  claims, with no secret or a wrong one, still count against the caller.
- `caller-identity.spec.ts` covers one rule per test, and runs the redaction
  through `pino-http` with the app's own paths.
- `visitor-headers.spec.ts` covers the web helper, and pins that all four
  NextAuth fetches and the API client carry the headers.
- Eighteen mutations, each observed failing on its own:
  - API: a claim believed without the secret (which also turned the two HTTP
    forgery tests red); believed when no secret is configured; a longer wrong
    secret; a non-address; a repeated secret; the first hop instead of the last;
    the guard ignoring the vouched visitor; a short secret; redaction
    unregistered; redaction aimed at the wrong header; IPv6 refused;
  - web: the first incoming hop; headers sent without a secret; an error
    escaping outside a request; a non-address; IPv6 dropped; the refresh fetch
    and the API client each forgetting the headers.

`next build` passes. Its eight "Dynamic server usage" messages are identical, on
the same seven routes, in builds made before this change.

**The infra half - kambriq-infra #65, open, not applied.** One `random_password` of 48
characters written to a SecureString, `/kambriq/dev/shared/WEB_CALLER_SECRET`,
and referenced as a `secret` named `WEB_CALLER_SECRET` in both the web and the
API task definitions. Same pattern as A30's database password. Until it exists
the code is inert and counts exactly as before, so the merge order is free.

**Known limit, named.** A call NextAuth makes outside a request scope (a token
refresh triggered while `proxy.ts` runs, if `headers()` is unavailable there)
sends no claim and still counts against the web task. Where a person is known -
refresh and logout carry a refresh token - a per-account key is the better
answer, and it belongs to A41.

**Proven on dev, 24 September, on `sha-43ef4ab`**, API `:205` and web `:159`,
both carrying `WEB_CALLER_SECRET` (kambriq-infra #65, applied by run
`35955366789`). The API's startup logged the missing-secret warning once before
the secret existed (04:23) and not after it (04:34).

- **Per visitor.** Two visitors went through the same web task (`3.76.44.x`):
  mine (`90.25.230.x`) and the E2E runner (`20.168.103.x`). From 04:49:15 to
  04:49:55 their `/auth/login` counters fell independently, in the same seconds:
  mine from 9 to 1, the runner's from 9 to 6. Mine had been held at 429 from
  04:48:52 to 04:49:08, and the runner's first call at 04:49:15 found a full
  bucket.
- **A forged claim ignored.** Thirty-two direct calls to the certificate
  verifier (limit 30), each claiming a different visitor with a wrong secret,
  gave 30 x 200 then 429, 429: everything counted against the caller.
- **The four paths, end to end, in a real browser, with a throwaway maildrop
  account.** Register `POST /auth` 201. The emailed link: `verify-email` 200.
  `forgot-password` 204, then the emailed link: `reset-password` 204. `login`
  200 with the new password, landing on `/mylands`. Each call reached the API
  through the web task, carrying the visitor, with the secret logged as
  `[redacted]`.
- The journeys and E2E ran green on the develop run after the secret existed.

**The known limit did not show.** NextAuth's refresh calls, triggered by the
page while the proofs ran, carried the visitor claim too.

**Observed, not A45's, opened as a subject.** Every `POST /auth/refresh` on dev
answered 400: 7 of 7 in the 16 hours before A45 deployed, and 27 of 27 after.
No refresh succeeded in that window.

---

### A41 - the five anonymous auth routes get a rate limit each - `PROUVE`

**Cost impact: None.**

P11 listed `refresh`, `logout`, `verify-email`, `reset-password` and
`reactivate` as exempt, "inherited and not examined". They could not be examined
honestly before A45: every call the web makes for a visitor counted against the
web task's own address, so a limit here would have been a limit on the whole
site. A45 is proven on dev, so limits now count per visitor. Only the global
default of 100 a minute applied to these routes until now.

**Measured before choosing**, per caller - the vouched visitor, otherwise the
last hop, the same key the guard uses - over the API's request log (7-day
retention, 17-24 September):

| route            | calls | callers | peak per caller / 60 s | limit / 60 s | why                                                                                   |
| ---------------- | ----- | ------- | ---------------------- | ------------ | ------------------------------------------------------------------------------------- |
| `refresh`        | 91    | 6       | 15                     | **30**       | NextAuth refreshes in bursts. Too low logs people out mid-session, so double the peak |
| `logout`         | 0     | 0       | 0                      | 10           | one per sign-out; the house auth value                                                |
| `verify-email`   | 123   | 48      | 3                      | 10           | a journeys run verifies three users from one runner; a double click is 2              |
| `reset-password` | 73    | 25      | 3                      | 10           | journey 5 sets, resets and replays; the 64-character token cannot be guessed          |
| `reactivate`     | 0     | 0       | 0                      | **5**        | it checks a password and issues tokens, like login; five tries, as `forgot-password`  |

Every caller is the Next server, apart from the journeys and one browser on
`verify-email`. The web client and the journeys were read to confirm it.

**Proof so far.** `auth-anonymous-routes-throttled.spec.ts` reads each
handler's `@Throttle` metadata. It was red first: five routes read `undefined`.
The P11 pin no longer exempts them. Eight mutations, each observed failing on its
own: each of the five decorators removed, which fails its own test and the P11
sweep; the refresh limit changed; the TTL changed; a stale exemption put back.

**Caught on the way.** A comment between `@Public()` and `@Throttle` hid
`@Public()` from the P11 sweep: its parser strips comments and stops at the
blank line they leave. All five routes vanished from the public list, which
would have made the throttle assertion vacuous. The route-count floor caught
it, and the comments now sit above the decorator stack. This is the trap P11
already recorded.

**Proven on dev, 24 September, on `sha-66d7ee8`** (#166, develop run `35959233220`
green, journeys and E2E included):

- during that run the five routes answered `verify-email` 200 x5,
  `reset-password` 204 x2 and one 400 (journey 5's deliberate replay of a used
  token), with no 429 on any of them;
- `reactivate` for an address with no account, seven times in a row: 404 x5,
  then 429, 429 - the new limit of 5, counted per caller.

**Observed, not A41's, a new subject:** every `POST /auth/refresh` on dev answers
400, before A45 as after it. That is why NextAuth retries it in bursts. When
refresh works again, the measured peak will fall, and 30 will be generous.

> **Corrected on 25 September (A47).** "Every refresh answers 400" was measured
> over a 16-hour window and written as if it described the route. Over 7 days
> the web's refreshes answered 200 x3, 409 x2 and 400 x59: refresh worked one
> call at a time and failed in bursts. The cause is recorded under **A47**. The
> sentence above is kept, because the correction only means something beside
> the claim it corrects.

---

### A46 - log hygiene - `PROUVE`

**Cost impact: None.**

Opened by A45. The request logger now writes no token, password or credential
header. `request-log-redaction.ts` owns the paths it never writes, and
`app.module.ts` registers them.

**Proof so far.** `request-log-redaction.spec.ts` sends a real request through
`pino-http`, configured with the app's own paths, and reads back the line
written - the bytes CloudWatch receives. It was red first against the paths as
they stood. Five mutations, each observed failing on its own: each of the four
paths removed, and the registration in `app.module.ts` removed.

**Proven on dev, 24 September, on `sha-df4d523`** (#169, develop run
`35961004092`). The develop run's E2E suite, a real user logging in through the
web, and the delivery journeys, covering registration, verification, login and
reset, ran against the new build. Then everything the API wrote after its new
task started at 05:49:38 UTC was searched in CloudWatch: 2 001 lines, and no
credential-shaped content. The credential headers appear only as `[redacted]`,
which also shows the requests are still logged. The same search over the hour
before the deploy did not come back clean, and that is what gives the clean
result meaning. The web's log group: nothing.

Lines written before the deploy expire with the log group's 7-day retention.
Deleting them is a decision for Visquis, not for this subject.

---

### A47 - a session survives its access token's expiry - `PROUVE`

**Cost impact: None.**

**The brief's premise, corrected first.** "`/auth/refresh` answers 400 every
time" was my own report of 24 September, measured over 16 hours. Over the
API's 7-day log the web's refreshes answered 200 x3, 409 x2 and 400 x59.
Refresh worked one call at a time. It failed in bursts, and in a way that
reached the user. The brief asked for the cause among four candidates: what the
route expects, what the web sends, where the token is kept, and whether it
reaches the API. It is none of them. The route expects a token in the body, the
web sends one, and it reaches the API, which then rejects it (the 184-byte "invalide ou
expiré" body, not the 171-byte "absent" one). The API itself refreshes correctly
when called once after a pause (200, 200, then the replayed old token 400).

**Three defects, each measured on dev before anything changed:**

1. **Concurrent refreshes with a single-use token.** One navigation reads the
   session several times at once - the proxy, the page, the root layout,
   server actions - and each read of an expired session refreshed with the
   same token. The API log shows it on 20 September (200, then 400 16 ms later)
   and on 21 September (200, then 409 twice, then 400s). In a real browser on
   25 September, one navigation to `/mylands` made three refreshes in 27 ms:
   200, 400, 400.
2. **Refreshes that are never saved.** Only the proxy writes the session cookie
   back. A plain `auth()` in a page or an action drops the `set-cookie`: next-auth
   `lib/index.js` returns `getSession(...).then(r => r.json())`. The root layout
   calls `auth()` on every page, so a refresh on a page outside the proxy's
   matcher was thrown away, and the browser kept a token that had just been
   revoked.
3. **Two tokens in the same second were identical.** Same claims, same `iat`,
   same `exp`, so a refresh made in the same second as its login answered 409:
   the new token's hash hit the unique index.

**The journeys never exercised refresh.** No call to `/auth/refresh` and no
journey longer than the 15-minute access token, which is why they passed.

**The fix:**

- `lib/auth/refresh-session.ts`: the web server remembers what each refresh
  token was exchanged for. A request follows that chain to the newest tokens,
  refreshes only when those are due and with their own token, and shares one
  call between every request asking at the same moment. A stale cookie then
  leads to the current tokens, and it catches up when the proxy next runs.
- A refused session stops asking. A transient failure is retried.
- The API gives every token a `jwtid`.
- The map is in the web server's memory. A restart forgets it and falls back to
  today's behaviour; with several web tasks, each keeps its own. One task runs
  on dev.

**Proof so far:**

- `auth-refresh.spec.ts` calls the real `jwt` callback: 7 tests, red first
  (three calls for three concurrent reads; a second call with the old token; a
  refused session asking again).
- `token-uniqueness.spec.ts` uses the real `JwtService`, red first: identical
  tokens.
- Journey 1 now refreshes straight after its login, rotates again, and has the
  used token refused. Run against dev before the fix: `Expected 200, Received 409`.
- Mutations, each observed failing on its own:
  - web: sharing removed at the point it happens; an exchange forgotten when it
    settles; a refused session asking again; a transient failure remembered; a
    refusal treated as transient; the chain not followed; due tokens returned
    as current; the refresh fetch without the visitor headers;
  - API: `jwtid` removed from the refresh token, and from the access token.
- One check inside `exchange` never failed under mutation, because the chain
  lookup already covered it. It was removed.

**A41's limit.** 30 was chosen from a peak of 15 produced by these bursts. Once
concurrent reads share one call, a person refreshes about once per access
token, so 30 is generous rather than wrong, and it is left alone.

**After the merge (#171, `sha-99a95ba`, develop run `36096965253` green):**

- Holds: journey 1's new steps ran green on dev. The journeys' refreshes were
  200, 200, then 400 for the deliberately replayed token, with no 409.
- **Does not hold: the public-pages sign-out.** A fresh session, then at 05:36:51
  UTC, after its access token came due: `/legal/privacy` refresh **200**;
  `/legal/terms` **made no refresh call** (the remembered exchange answered, as
  designed); `/mylands`: the **proxy** refreshed with the **old** token, got
  **400**, and redirected to `/login`.
- One web task was running, so this is not two servers.
- **Hypothesis, not verified:** Next bundles the proxy separately from the pages,
  so each holds its own copy of the module-level map. The pages share their
  exchanges; the proxy - the only place the cookie is written - never sees them.
  Verifying it, and choosing a store both can reach, is the next step.
- **What is fixed:** the same-second 409 (`jwtid`), and concurrent reads
  within the pages.
- **What is not:** a person browsing public pages after their access token
  expires is still signed out at the next protected page.

**Stopped here** under the standing authorization: a proof that does not hold.
#171 stays merged: it removes the 409 and the page-side bursts, and the
sign-out is no worse than before it.

**Second half (#173) - refresh only where the cookie can be written.**

The runtime claim, measured on the build rather than taken on trust. The brief
said the proxy runs in the Edge runtime, in a separate isolate. **It does not:**

- `middleware-manifest.json` declares no Edge function (`middleware: []`);
- the proxy is `server/middleware.js`, CommonJS, loaded through
  `require("./chunks/[turbopack]_runtime.js")`, requiring `node:async_hooks`;
- it runs in the Node runtime, in the same process as the pages.

**What is true** is that it has its own Turbopack runtime context: the refresh
code is bundled into two chunks, one for the proxy and one for SSR. So there are
two module instances and two maps - which is why #171's map never reached the
proxy.

The brief's direction holds either way: only the proxy writes the cookie, so the
refresh belongs there. The same process means `globalThis` can hand the proxy's
exchange to the page render of the SAME request, which still reads the old
cookie. That is a handoff within one request, not a store: the browser's cookie
is rewritten.

**The change:**

- **Matcher.** The proxy RUNS on every public page, listed one page at a time
  (23, one of them dynamic), never as a prefix. It GATES exactly what it gated
  before: `proxy.ts`'s decision is unchanged. An unknown URL is still not matched
  and still 404s, and P3's assertion to that effect is unchanged.
- **P3's pin.** "Public pages are not intercepted, except three" pinned running
  and gating as one thing. It is now "every public page runs through the proxy",
  plus "the matcher lists exactly the public pages on disk, never a public
  prefix". `proxy.spec.ts` walks every public literal through the real decision:
  anonymous, signed in and stale all pass.
- **Two NextAuth instances over one cookie.** The proxy, the `/api/auth`
  handlers and `signIn`/`signOut` refresh. The `auth()` that pages and actions
  import uses `pageAuthConfig`, whose `jwt` never calls `/auth/refresh`: it takes
  what the proxy obtained, or a refusal it recorded, and otherwise leaves the
  session as it found it.
- **The exchange map lives on `globalThis`.**

**Proof so far:**

- `auth-page-read-only.spec.ts`, red first: a page render called refresh (1,
  expected 0), and a second module instance saw nothing.
- Seven mutations, each observed failing on its own:
  - pages reading with the refreshing jwt;
  - the store back in module scope;
  - `auth.ts` giving pages the refreshing instance;
  - the proxy wrapped in the read-only one;
  - a public page dropped from the matcher;
  - a public prefix instead of pages, which also trips P3's unknown-URL test;
  - a recorded refusal ignored by a page. That one survived until its test was
    written, and was then seen failing.
- A local standalone build: `/about`, `/legal/privacy` and
  `/verify-certificate/…` answer 200; `/zzz-does-not-exist` and
  `/legal/does-not-exist` answer **404**; `/mylands` redirects to login.
  `X-Robots-Tag` is on every one.

**Cost baseline on dev before the change** (anonymous time to first byte, 15
requests each): `/legal/privacy` median 76 ms, p90 158; `/about` 97 / 180;
`/products/lands` 103 / 180.

**Proven on dev, 25 September, on `sha-ccce5b9`** (#173, develop run
`36100991632` green, journeys and E2E included). Signed in at 06:19:18 UTC.
After the access token fell due, at 06:33:

- `/legal/privacy` made **one refresh, 200**, in the proxy, written back;
- `/legal/terms` made **no refresh**;
- `/mylands` made **no refresh**; its data call `GET /lands/client/purchases`
  answered 200, and the page rendered signed in.

None was refused. That is the exact path that signed the person out at 04:58
and at 05:36 that morning.

**Cost, measured on dev** (anonymous time to first byte, n=15 each), before and
after the proxy ran on public pages:

| page              | before (`6bc6294`)    | after (`ccce5b9`) |
| ----------------- | --------------------- | ----------------- |
| `/legal/privacy`  | 76 ms median, p90 158 | 79 ms, p90 160    |
| `/about`          | 97, p90 180           | 95, p90 105       |
| `/products/lands` | 103, p90 180          | 101, p90 170      |

No measurable change.

### I43 - a screen that is not built says so, and promises nothing - `PROUVE`

**Cost impact: None.** Copy, one component, two test files.

**Proven on dev** at `sha-383828e` (#177, develop run `36148357376`, journeys
and E2E green), 25 September. Signed in as the seeded `admin@kambriq.com`, which
reaches all ten screens, each was read over HTTP in both languages. Every one
answered 200, and its `<main>` held exactly three things, e.g.:

- `/fr/agent/commissions`: `Commissions | Pas encore disponible | Cet écran n'est pas encore construit.`
- `/en/agent/commissions`: `Commissions | Not available yet | This screen has not been built yet.`

The other nine read the same, each under its own title. No list, no subtitle,
no roles, no French on an English page.

**Measured on develop (`de40c29`), and the count holds.** Ten signed-in screens
render `PlaceholderPage`: `/settings`, `/profile`, `/welcome`, `/client/verify`,
`/admin/escalations`, `/admin/reservations`, `/admin/kamnet`,
`/agent/dashboard`, `/agent/commissions`, `/agent/escalation/new`. Their
`features` lists hold 38 strings, all hardcoded French, all features that do not
exist. The ten KAMNET agents about to sign in for the first time would have read
"Export des relevés" and "Graphique des commissions (6 derniers mois)".

**The component promised on its own too, as the brief suspected.** Above every
list, the card said "En construction - Cette page est en cours de
développement": a claim that somebody is building it. Under the list, "Rôles
autorisés" showed `ROOT` and `OPS`, two roles the platform does not have (`I18`
removed `ROOT`), and `/profile` and `/welcome` added "Tous les utilisateurs
authentifiés", in French whatever the language. Each screen also carried a
subtitle describing what it would do: "Suivi de vos commissions et revenus"
over a screen that tracks nothing.

**What changed.** `PlaceholderPage` takes a namespace and a title, nothing else.
It renders the screen's name and "Pas encore disponible - Cet écran n'est pas
encore construit." (en: "Not available yet - This screen has not been built
yet."), both from the translations. The ten screens pass only those two props.
Removed from both catalogues because nothing reads them any more:
`app.underConstruction`, `app.underConstructionDesc`, `app.features`,
`app.authorizedRoles`, the nine placeholder subtitles, and every
`app.agentDashboard` key but `title` - a dashboard's worth of strings
("Commissions (6 derniers mois)", a sales pipeline) that no component read. No
screen was built.

**New copy for Visquis to approve:** `app.notBuilt.title` and
`app.notBuilt.description`, fr and en, as quoted above.

**Two guards, one for each defect.**

- `components/placeholder-page.spec.tsx` finds the placeholder screens by
  reading `src/app` for the import and renders each in both languages. It
  asserts the WHOLE text of the screen: its name and the two statements, nothing
  else, and no list item. A list, a subtitle or a row of roles cannot come back
  under a new name. The ten screens are pinned by path, so an eleventh is a
  decision somebody reads.
- `i18n/no-hardcoded-copy.spec.ts` is P21's sibling. P21 reads the catalogues
  and could see none of the 38, because they never entered one. The sibling reads
  every `.tsx` under `apps/web/src`, new files included. It parses the TypeScript
  and finds prose written into JSX: text, a string given to a prop, or strings in
  an array or a conditional handed to JSX. Only a file declared in
  `HARDCODED_COPY_DEBT`, with its reason, may hold any. An entry whose file no
  longer owes anything fails. **Its limit, stated in the file:** a string kept in
  a constant and passed to JSX by name is not seen.

**Proof, all watched red before green:**

- against develop, the sibling named exactly the ten screens and their strings,
  and the render test showed the whole promise on each, e.g. `Received:
"EscaladesGestion des incidents et signalements.En constructionCette page est
en cours de développement.Fonctionnalités prévues• Liste de toutes les
escalades…Rôles autorisésOPSADMIN_GLOBALROOT"`;
- a hardcoded `features` list put back on `/agent/commissions`: the sibling
  fails, naming the file and the string;
- a translated list put back in the component: the render test fails on every
  screen;
- a second line of copy under the title: the render test fails;
- the statement hardcoded in French: the English render fails;
- a new file with hardcoded prose: the sibling fails;
- a debt entry for a file that owes nothing: the stale-entry test fails.

**Two defects in the guard's first version, found by running it.** Its prose
pattern allowed only spaces between words, so "Catégories d'escalade (litige,
fraude, blocage)" passed. It now allows punctuation between words. And the image
`sizes` prop read as prose; it is on the list of props nobody reads.

**Found, not fixed - larger than I43.** 30 files still hold hardcoded copy. All
are declared, and most are the payments back office (G4, G9), the identity queue
(A10), KBS admin (in English) and the public certificate verdict. Each reads in
one language to a reader of the other. Each is a translation subject of its own,
and the list shrinks one entry at a time.

### P24 - a land title number is shaped like a Cameroonian one - `PROUVE`

**Cost impact: None.**

**Proven on dev** at `sha-85c8966` (#178), 25 September:

- `/fr/products/verify` and `/en/products/verify` show `TF 4129/M` on the card;
- `PATCH /lands/admin/:id` with `TF-12345-ABCD` answered **400** with "A land
  title number is shaped TF <number>/<department letters>, e.g. TF 4129/M", and
  the stored title was unchanged;
- the eight seeded fixtures still held the invented titles, and were rewritten
  through the same route from phone-typed input, each stored canonical:
  `tf1187 / wb` -> `TF 1187/WB`, `TF-3462-WB` -> `TF 3462/WB`, `TF N° 4803/WB`
  -> `TF 4803/WB`, `tf 912/mi` -> `TF 912/MI`, `TF 6075 / MF` -> `TF 6075/MF`,
  and three more. Each answered 200.

**A premise of mine, corrected.** The entry said the seed rewrites the titles on
every run, and that is true of a run. **No deploy runs it**: the seed step in
`deploy-dev.yml` is opt-in (`run_seed`, meant for a first deploy). So dev kept
the invented titles after the deploy. I did not run the seed to fix that,
because it deletes reservations on seeded parcels, and a deletion on dev is
Visquis's decision. The fixtures were written through the API instead, which is
also the proof above.

The first develop run after the merge went red on journey 1: maildrop answered
HTTP 520 and the journey could not read its verification mail. The journey says
so itself ("not a product failure"). The failed job was re-run once maildrop
answered 200, and it passed.

**The business fact is Visquis's (25 September).** A titre foncier is written
`TF <number>/<letters>`. The letters are one to three and name the department:
`M` Menoua, `SM` Sanaga-Maritime, `WB` Wouri B. `TF 4129/M` is well formed.

**The brief's three findings, confirmed, and two more it did not have:**

1. `products/verify/hero.tsx` rendered `TF-12345-ABCD`, hardcoded, on the public
   verify page;
2. `prisma/seed.ts` invented `TF-CM-LT-2025-001` and seven more like it;
3. nothing validated a title: `z.string().optional()` on the web,
   `z.string().max(100)` on both API DTOs;
4. **not in the brief:** the admin land form's placeholder was
   `TF/MFOUNDI/2024/0421`, a fourth format, and the VERIFY back-office table and
   `data/mock-lands.ts` carried the same `TF/<REGION>/<year>/<n>` shape;
5. **not in the brief:** the seed's `update` restored status, publication, price
   and label, but not `titleNumber`. Rewriting only the seed's values would have
   left dev showing the invented titles for ever, since `create` runs once. This
   is the "idempotent is not restorative" defect again.

Measured on dev before the change: 20 lands, 8 carrying the seed's invented
titles and 12 carrying none. No other title exists there, so the new rule
refuses no stored value once the seed has rewritten them.

**The rule: the shape, never a list.** `libs/common/src/lands/title-number.ts`
is one parser used by the web form (a courtesy) and by both API DTOs (the rule).
It accepts `TF`, one to six digits, a slash or hyphen, and one to three letters.
It forgives case, spaces and `N°`, and stores `TF 4129/M`. The digits are a
range because a title's number is its rank in its registry. Empty stays
accepted: the field is optional. `KNOWN_DEPARTMENT_CODES` is kept apart and
empty. `isUnlistedDepartment` may one day warn from it, and returns `false`
while it is empty. Nothing reads it to accept or refuse.

**The refusal says the shape, with an example.** The title field rendered no
error at all, which cost nothing while nothing was refused. It now renders the
translated message under the field, tied by `aria-describedby`. The API refuses
the same input with the same example, in English, like its other DTO messages.

**Copy and data for Visquis to check:**

- `products.verify.heroCard.tfExample` = `TF 4129/M` (his example), fr and en;
- `landsAdmin.form.titleNumberInvalid`, fr: "Un numéro de titre foncier s'écrit
  TF, le numéro, une barre oblique, puis une à trois lettres du département -
  par exemple TF 4129/M." / en: "A land title number is written TF, the number,
  a slash, then one to three department letters - for example TF 4129/M.";
- `landsAdmin.form.titleNumberPlaceholder`: "Ex. TF 4129/M" / "e.g. TF 4129/M";
- the seeded and mock titles are fictitious. `WB` for the Douala parcels is his
  code. **`MF` (Mfoundi, Yaoundé), `FA` (Fako, Buea), `MI` (Mifi, Bafoussam),
  `BE` (Bénoué, Garoua) and `OC` (Océan, Kribi) are my inference** and wait for
  his correction. The numbers are invented.

**Proof, all watched red before green.** Against develop, the DTO tests failed
on the refusals and on the canonical form, and the seed test on the missing
restore. Then eleven mutations, each observed failing its own test:

- the API accepting anything;
- exactly four digits;
- a closed department list deciding;
- an empty title refused;
- storing the title as typed;
- a warning while the list is empty;
- `TF-12345-ABCD` back in the hero (caught by a sweep over every title-shaped
  literal in the web source);
- the seed no longer restoring the title;
- an invented seed title back;
- the web form accepting anything;
- an invented example in the `en` catalogue.

A twelfth mutation hid the field error, and the render test failed in both
languages. One mutation first broke the syntax instead of the rule, so the suite
crashed rather than failed. It was redone as a clean change.

**Found, not fixed:**

- `/admin/lands/search` and `/admin/lands/compare` render `MOCK_LANDS`: invented
  parcels, with invented prices, shown to administrators as if they were real;
- the VERIFY back-office table renders four invented requests the same way.

Only their title format is changed here.

### P27 - the product marks, everywhere on the website - `PROUVE`

**Cost impact: None.**

**Proven on dev** at `sha-e059503` (#179, develop run `36154067949`, journeys
and E2E green), 25 September. Twelve public pages were read in both languages, as
rendered text with scripts removed: the home page, the four product pages, the
directory, the plan, about, method, terms, FAQ and contact. **Every page: 0
unmarked names, 0 `KBS™`.** Marked names per page: 14 on the home page, 20 on
LANDS, 10 on VERIFY, 15 on KAMNET, 27 on KBS, 4 in the terms, and the rest
between 6 and 8. French and English counts match.

**Decided by Visquis on 25 September:** KAMBRIQ LANDS, KAMBRIQ VERIFY and KAMNET
carry `™` everywhere, in both languages. KBS does not: it is a school, not a
product mark.

**Measured on develop before the change, in each language:** VERIFY carried the
mark 20 times out of 21, LANDS 0 out of 15, KAMNET 0 out of 53. The brief counted
18 of 19 and 0 of 49; develop had moved since. The one unmarked VERIFY is a KBS
syllabus line naming the ecosystem, "KAMBRIQ / LANDS / KAMNET / KBS / VERIFY".
The decision applies there too, and KBS stays bare.

**What changed:** every string value in both catalogues (68 per language, keys
never), four MDX files (the plan page and the terms of use, fr and en, each
naming KAMNET once), and three hardcoded strings that render: the KAMNET
application page twice and the KAMNET back office's title. **The terms of use
are a legal document**, so their one-word change is named here for Visquis.

**The guard reads everything, and its list is of exceptions.**
`trademark-marks.spec.ts` watches every namespace unless it is declared in
`EXEMPT_NAMESPACES`, which is empty and fails when it names a namespace that no
longer exists. It also reads every MDX file under `src/content`. The brief asked
to reuse P21's inverted list, but on develop P21 still reads a hand-kept list:
the inversion exists only in #174 (P10), which is not merged. So the mechanism
is now `i18n/watched-namespaces.ts`, shared, for P21 to use when #174 lands,
instead of a second copy of it.

**The trap, tested before the rule.** A mark after every `LANDS` would double
`KAMBRIQ LANDS™` and fire inside a URL. The check is "a name not followed by
`™`", read outside URLs and paths. A separate test refuses a double mark and a
marked KBS.

**Proof, all watched red before green.** Against develop: 68 unmarked strings
per language, and the MDX. Then six mutations, each failing its own test:

- one unmarked LANDS in `fr`;
- a fresh `en` namespace carrying "Join KAMNET", with the guard untouched;
- a double mark;
- `KBS™`;
- an unmarked KAMNET in an MDX file;
- a stale exemption.

**Found, not fixed - outside the website.** The API's email and notification
copy names KAMNET without the mark: 16 strings per language in
`libs/common/src/i18n/*/email.json` and 4 in `kamnet.json`. The decision says
everywhere. The emails are their own subject, with their own tests. The
hardcoded-copy debt files of `I43` are not read by this guard, and after this
change none of them names a product unmarked.

### P25 - one unstyled MDX table, and two consent sentences split into columns - `PROUVE`

**Cost impact: None.**

**Proven on dev** at `sha-828c509` (#180, journeys green), 25 September, with
the same Playwright scripts as the "before" set (iPhone 13 emulation and a
1280 px desktop, fr and en):

|                             | before                                                                | after                              |
| --------------------------- | --------------------------------------------------------------------- | ---------------------------------- |
| verify table, cell padding  | 0 px everywhere                                                       | 16 px everywhere                   |
| verify table, desktop width | 369 / 405 px, columns touching                                        | 768 px, header row, separated rows |
| newsletter consent links    | block columns, 39 px tall ("politique de / confidentialité" in 80 px) | inline in the sentence, 15 px tall |
| contact consent label       | 3 flex children, link 46 px tall                                      | 1 child, link 17 px tall           |

Read as pictures too: the price sits in its own padded column, and each consent
reads as one sentence that wraps like prose. The screenshots are kept out of the
repository.

**The report, and the hypothesis measured rather than believed.** Visquis saw the
price table on `/products/verify` render "Vérification externe (terrain trouvé
par vous)99 €". The brief suspected Next was not finding
`apps/web/mdx-components.tsx`, which would leave all eight MDX pages unstyled.

**The hypothesis is false.** The deployed HTML on dev (`sha-383828e`) is its own
sentinel: every MDX heading carries the mapping's classes (`mt-10 mb-4 text-xl
font-semibold text-gray-900`), and so does the rule. Only `<table>`, `<th>` and
`<td>` came out bare: cell padding measured 0 px at both widths, in both
languages. `@next/mdx` looks for the file at the project root, which is where it
is, and the Next docs agree.

**The cause:** MDX runs the component map over elements it builds from Markdown.
A lowercase tag written literally, as the verify table was, is emitted as it
stands. It was the only literal HTML in the sixteen MDX files. Markdown table
syntax would need GFM. `remark-gfm` is a declared dependency but not enabled, and
enabling it would change how all eight pages parse (autolinks, strikethrough),
which is its own decision. So each table renderer is now defined once in
`mdx-components.tsx` and offered under two names, `table` for Markdown and
`Table` for MDX written as tags. MDX resolves capitalised tags through the same
map. The verify table uses `<Table>`, `<Th>` and `<Td>`.

**The footer, looked at before changing it.** At both widths and in both
languages, the newsletter consent read as four side-by-side fragments. At phone
width in French: the sentence, then "politique de / confidentialité" squeezed
into 80 px, then "et au", then "RGPD". Nothing was clipped. The shared `Label` is
a flex container, and the sentence was handed to it as loose children, so flex
made each fragment a column. The contact form's consent had the same structure
and the same defect: at phone width in English, "privacy policy" sat in 47 px.
Both sentences are now one inline element inside the label.

**Guards, watched red on develop first:**

- `content/mdx-literal-html.spec.tsx` reads every MDX file and refuses any tag
  the map styles, written literally. On develop it named the twelve tags of the
  verify table, fr and en. It also pins each capitalised alias to the same
  renderer as its lowercase element;
- the newsletter and contact specs pin the label to a single child holding the
  links. Both failed against develop's components (7 and 3 children).

**Screenshots, "before", from dev** (Playwright, iPhone 13 emulation and a
1280 px desktop; kept out of the repository): the verify table, the footer and
the contact consent, fr and en, phone and desktop.

**Found, not changed:** every price on the public site is in euros only: `99 €`
on the verify page and `249€` in the KBS enrolment notice, in both languages, for
services sold in Cameroon. As the brief says, naming these is useful and
changing them is not ours to do.

### A44 - an avatar is a key in the caller's own storage, and the browser may upload it - `PROUVE`

**Cost impact: None.**

**Proven on dev** at `sha-689bd2e` (#181), 25 September, in Chromium
(Playwright), signed in as the seeded admin, with the same script that measured
the refusal before:

- the page's `connect-src` now names `https://kambriq-media-dev.s3.eu-central-1.amazonaws.com`;
- choosing a PNG on `/fr/account`: the presigned **PUT answered 200**, no CSP
  error in the console, and the page then loaded the avatar from the bucket
  (GET 200) into its `<img>`;
- `GET /users/me` returns it presigned, so what is stored is a key that storage
  resolved, not an address;
- `PATCH /users/me` with `https://evil.example/tracker.png` answered **400**:
  "La photo de profil doit être envoyée depuis votre compte, avec le bouton de
  téléversement."

The "before" run of the same script printed a presigned URL, with its
temporary session token, into the operator's console. Every later capture strips
query strings, and no signature or token is written here.

**Both premises verified before anything was built, and both hold.**

1. **The address was not checked, and on more paths than the brief named.**
   `PATCH /users/me` took `avatarUrl: z.string()`, anything at all. The KAMNET
   agent profile took any URL (`z.url()`). `StorageService.getDownloadUrl`
   hands back an `http(s)` value as it stands. And
   `kamnet/agents/public-listing.ts` carries `avatarUrl` into the public
   directory's API response. A foreign address would therefore have travelled
   to anonymous readers, which is the brief's point about a stored value outliving
   the one surface a CSP guards.
2. **The upload was already broken on dev, and nobody had noticed.** Measured in
   Chromium (Playwright) on 25 September, signed in as the seeded admin: choosing
   a PNG on `/fr/account` made the browser refuse the presigned PUT with
   "violates the following Content Security Policy directive: connect-src 'self'
   https://api.mapbox.com …". No request left the page. On dev, 0 of the 699
   users has an avatar stored.

**What "KAMBRIQ's own storage" means here, decided.** The upload route issues
`users/<id>/avatar/<timestamp>-<name>` and the web sends that key back.
Storage resolves keys. **No URL is legitimate, not even one on our own bucket**,
because a second accepted form is a second way in. So the rule is a shape bound
to the caller: `core/users/avatar-key.ts` defines the key once, for the upload
route and for the check, and `updateMe` refuses anything else before writing.
Both write paths end in `updateMe`. The KAMNET DTO took a URL and so refused the
real key: it now takes a string and leaves the decision to the service. Empty
still removes the photo. The refusal is translated: "La photo de profil doit
être envoyée depuis votre compte, avec le bouton de téléversement."

**No host list is written for the API**, because no host is accepted. The
brief's "same single source" applies to the web half: `connect-src` gets the
bucket from `uploadConnectSources`, beside `imgSrcSources` in
`lib/security/image-hosts.ts`, from the same variable. It gets the bucket only:
the browser uploads nowhere else, so no other image host is opened for writing.

**Stored addresses that would now be refused: none.** No avatar exists on dev,
so nothing was changed.

**Proof so far, all watched red before green:**

- against develop, the five refusals (a foreign site, our bucket as a URL,
  another person's key, the caller's own identity document, a key climbing out
  of its folder) all stored the value, and the KAMNET DTO refused the real key;
  the `connect-src` tests failed;
- seven mutations, each failing its own test: the check removed, any person's
  folder, anything under the folder, our bucket's URL accepted, removal refused,
  every image host opened for upload, `connect-src` back to Mapbox only;
- `users.service.spec.ts` stored `https://img.test/avatar.jpg` as its example
  profile write. That is a test encoding the defect, and it now uses a key.

**Found, not fixed:**

- in the same browser session, the Switzer stylesheet from `api.fontshare.com`
  is refused by `style-src 'self' 'unsafe-inline'`, so the site's intended
  typeface never loads on dev;
- ~~identity-document addresses are stored as full `https://` URLs (seen in the
  admin user list)~~ **Retracted by A49, 25 September.** The admin list signs
  every stored key on the way out, and I read its output as stored addresses.
  All 241 documents on dev are keys in their owner's folder. What was true: the
  write path accepted any string. A49 closes that.

### A43 - the API's documentation is served only where it is declared local - `PROUVE`

**Cost impact: None.**

**Proven on dev** through the deployed environment, anonymously, 25 September:

| request                    | before (`sha-689bd2e`)        | after (`sha-7ec907b`, #182)             |
| -------------------------- | ----------------------------- | --------------------------------------- |
| `GET /api/v1/docs`         | 200, the Swagger UI           | **404**, "Cannot GET /api/v1/docs"      |
| `GET /api/v1/docs-json`    | 200, 145 303 bytes of OpenAPI | **404**, "Cannot GET /api/v1/docs-json" |
| `GET /api/v1/health/ready` | 200                           | 200                                     |

The 404s come in the API's own envelope, so the routes are simply not mounted.

**The premise, verified.** `main.ts` mounted Swagger whenever
`NODE_ENV !== 'production'`, and the dev API runs with `NODE_ENV=development`.
Measured anonymously on dev on 25 September, before the change:

- `GET /api/v1/docs`: **200**, the Swagger page;
- `GET /api/v1/docs-json`: **200**, 145 286 bytes, **145 paths**, the whole API
  with its schemas and examples.

**Decided: not served on an open environment**, rather than served behind
authentication. The API's JWT travels in a header, which a browser opening
`/docs` never sends, so an authenticated docs page would have taken Swagger away
from every developer.

**The signal is `APP_ENV`, as for the robots header, and the default is the
opposite one.** `APP_ENV` is set nowhere today: not in `kambriq-infra`, not in
the workflows, not in the API image. So dev and a laptop both have it absent,
and both have `NODE_ENV=development`. Absence therefore cannot mean "serve", or
dev would still serve. `servesApiDocs` in `libs/common/src/config/api-docs.ts`
answers yes only for an explicit `local`. `pnpm start` and `start:dev` declare it
with `APP_ENV=${APP_ENV:-local}`, which a developer can still override, and
`.env.example` documents it. No deployed image runs those scripts
(`start:prod` does not declare it). An environment that forgot to declare
itself serves nothing, which is the safe direction to be wrong in.

**Proof so far, all watched red before green.** Against develop, the `main.ts`
and start-script pins failed. Four mutations each failed their own test:
absence meaning open, an exact-spelling-only match, `main.ts` back on
`NODE_ENV`, and the start script no longer declaring `local`. The first version
of the `main.ts` pin banned the word `NODE_ENV` and so failed on the comment
explaining why it is not read. It now bans reading it.

**Other places that gate on `NODE_ENV` when they mean the environment - named,
not fixed, as the brief asks:**

- `app/app.module.ts`: the pino log level (`debug` unless `production`) and its
  pretty-printing: dev logs at debug level;
- `core`, `kbs`, `kamnet` and `lands` `*-prisma.service.ts`: Prisma query
  logging when `development`, **so dev logs every SQL query**;
- `health/build-info.ts`: `env` in `/api/v1/health/version` reports `NODE_ENV`,
  so dev reports itself as `development`, which says how it was built, not
  where it runs;
- `libs/common/src/config/env.validation.ts`: `NODE_ENV` defaults to
  `development` when unset.

`kambriq-infra/kamtech-ws-context.md` still says Swagger is served "in
non-production". That line is now stale and lives in the infra repository.

### P22 - the public directory at scale - `PROUVE`

**Cost impact: None.** One query where there were N, fewer connections held.

**Proven on dev** at `sha-caf8f98` (#183), 25 September. The directory on dev
was empty before and after the deploy, because nobody has consented yet (`P23`).
An empty list returns before the grouped query, so that proved nothing. The
seeded agent fixture `eric.mbou@kambriq.com` therefore consented through
`PATCH /kamnet/agents/me/public-listing`, and the anonymous
`GET /kamnet/public/agents` answered **one entry**: Eric Mbou, paired with his
own certificate `KCA-20250101-0001`, certified since 2025-01-01, seven fields.
The consent was then withdrawn: **0 entries**, and dev is as it was.

**The finding, confirmed in the code.** `listPublicDirectory` read the
consenting agents with no bound, then asked the KBS database for each agent's
newest certificate with `findNewestCertificateFacts(userId)`, one per agent, all
at once inside a `Promise.all`, against a pool of ten connections. Harmless at
ten agents, and linear in the number of agents after that.

**What changed:**

- `KbsCandidatesService.findNewestCertificateFactsForUsers(userIds)` answers for
  every user in **one** Prisma call and keys the newest certificate by its owner.
  The owner is spread last, so no field of the certificate row can overwrite the
  pairing that `toPublicDirectoryEntry` checks. The per-user method had no
  other caller and is gone.
- The agents are read with `take: KAMNET_MAX_PUBLIC_DIRECTORY_ENTRIES` (100),
  oldest consent first. This is the convention `KAMNET_MAX_FULL_TREE_ROOTS`
  already set, and when the cap is reached the log says so at `warn`.

**Bounded rather than paginated, decided.** The web reads this endpoint as a
bare array and treats any other shape as "register unavailable"
(`getPublicAgentDirectory`). The admin list's `{ data, meta }` would change a
public contract and the page with it. With ten agents today, a cap of a hundred
is news when it is reached, and the warning makes it seen.

**Proof, watched red before green.** The test counts the shape of the access,
not its speed. On develop, the certificate lookups for 3 agents and for 12
agents were **`[3, 12]`**, one per agent. They are now `[1, 1]`. Seven mutations,
each failing its own test:

- one lookup per agent again;
- no bound;
- the cap logged at `log` instead of `warn`;
- a warning one short of the cap;
- one Prisma call per user inside the lookup;
- certificates keyed to the wrong user;
- a query for nobody.

**Its limit, stated.** The test counts calls into the certificate layer and
Prisma calls inside it, not SQL statements: Prisma may load a relation in two
statements. That number is also constant in N. The directory's database suite
re-implements the queries rather than calling the service, so it could not
count them. Wiring the service across three databases and Redis for one count
was more than this subject.

A first version of the lookup test left an `ownerUserId: undefined` on the
certificate fixture, and the spread order let it erase the owner. The fixture
now matches what the select returns, and the owner is spread last.

### A48 - no behaviour in the API is decided on `NODE_ENV` - `PROUVE`

**Cost impact: a saving.** Half of the dev API's log volume goes away (below),
and CloudWatch ingestion is billed per GB.

**Proven on dev** at `sha-3425132` (#185), 25 September.
`/api/v1/health/version` reports `env: development` (how the image was built)
and `appEnv: undeclared` (where it runs). The API's CloudWatch stream was read
for the first ten minutes after the deploy, each line attributed to its task:

- **the new task: 293 lines, all JSON at level 30 (`info`), no `prisma:query`,
  nothing pretty-printed**;
- the one `prisma:query` line and five pretty lines in that window came from
  the previous task, draining during the rolling deploy (last event 20:22:01);
- eleven more non-JSON lines came from a one-off migration task (`npm notice`);
- the hour before the deploy held 300 `prisma:query` lines.

**Third time, so the whole class in one pass.** P4 moved the robots header to
`APP_ENV`, and A43 moved the Swagger documentation. Everything else that decided
on `NODE_ENV` in `apps/api` and `libs/common`:

| where                                                  | decision                                   | on dev, before                    |
| ------------------------------------------------------ | ------------------------------------------ | --------------------------------- |
| `core`, `kbs`, `kamnet`, `lands` `*-prisma.service.ts` | Prisma logs every query when `development` | every SQL statement logged        |
| `app/app.module.ts`                                    | pino level `debug` unless `production`     | debug level                       |
| `app/app.module.ts`                                    | pino-pretty transport unless `production`  | pretty-printed, multi-field lines |

All of them now read `libs/common/src/config/app-env.ts`: `prismaLogLevels`,
`apiLogLevel` and `prettyLogs`, beside `servesApiDocs`, which now shares
`isLocalEnvironment` with them. Only an explicit `APP_ENV=local` turns the
conveniences on, and `pnpm start` declares it (A43). `APP_ENV` is set on no
deployed environment today, so dev gets the quiet behaviour.

**Measured on dev before the change** (CloudWatch, `/ecs/kambriq-dev-api`, 25
September):

- in the last hour, **360 of 720** log events were `prisma:query` lines;
- over 24 hours, of the first 3,000 `prisma:query` lines, **2,993 were the
  health check's `SELECT 1`**. The rest were full statements: certificate and
  agent reads, and `DELETE`s of refresh and verification tokens.

**The brief's premise, corrected on one point.** "Queries carry values": in
this log format they do not. Prisma prints statements with `$n` placeholders,
and **none** of those lines contained a literal value. What was exposed is the
schema and the traffic pattern (which tables, which columns, which rows get
deleted), not customer data. It was one log option away from values.

**What still reads `NODE_ENV`, and why that is allowed:**

- `health/build-info.ts` reports it as `env`, which is how the image was built.
  It decides nothing. It now reports `appEnv` beside it (`undeclared` on dev
  today), and its docstring says which is which;
- `config/env.validation.ts` declares the variable's schema and default; it is
  not a read.

**The web, named and not converted.** The web image sets `NODE_ENV=production`
on every environment, so there it genuinely means "how the code was built":
React Query devtools (`providers.tsx`), the logger level (`lib/logger.ts`), the
dev-only API URL checks (`lib/api/server.ts`) and `images.unoptimized`
(`next.config.ts`) all distinguish `next dev` from a production build.

**The guard, so there is no fourth time.** `no-node-env-gates.spec.ts` reads
every source file in `apps/api/src` and `libs/common/src` (132, generated
Prisma clients excluded), with comments stripped so an explanation cannot trip
it, and refuses any `NODE_ENV` read outside `MAY_READ_NODE_ENV`. An exemption
that is no longer used fails too. **Watched red on develop:** it named exactly the
five files above.

**Mutations, each failing its own test:**

- one Prisma service back on `NODE_ENV`;
- SQL logged everywhere;
- debug level everywhere;
- pretty printing everywhere;
- nothing declared counting as local;
- comments no longer stripped;
- an unused exemption.

My own guess of "over 300 files" for the sweep's floor was wrong. The true count
is 132, and the floor is 120.

### J11 - the site's typeface was refused by the CSP, and had never loaded - `PROUVE`

**Cost impact: None.**

**Proven on dev** at `sha-87b1d13` (#186), 25 September, with the same script as
the "before" set (home page, 1280 px and iPhone 13, fr and en):

|                                   | before                                    | after                                                         |
| --------------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| CSP errors in the console         | 1 on every load (`style-src`)             | **0**                                                         |
| Switzer faces in `document.fonts` | none                                      | 400, 500, 600, 700 loaded; 800 registered                     |
| served `style-src` / `font-src`   | `'self' 'unsafe-inline'` / `'self' data:` | `+ https://api.fontshare.com` / `+ https://cdn.fontshare.com` |

The 800 face stays `unloaded` because the home page sets no text at that
weight, and a browser fetches a face when text first needs it. The screenshots
side by side show different letterforms, wider-set headings, and the navigation
spacing shifted. That is the site's typeface, rendered for the first time. They
are kept out of the repository.

**Measured on dev before the change** (Chromium through Playwright, home page,
1280 px and iPhone 13, fr and en, 25 September): every load logged "Loading the
stylesheet 'https://api.fontshare.com/css?…' violates the following Content
Security Policy directive: style-src 'self' 'unsafe-inline'". `document.fonts`
held **no Switzer face at all**, so text asked for `Switzer, system-ui,
sans-serif` rendered in `system-ui`. `document.fonts.check('16px Switzer')`
returned `true` all the same, because it reports "nothing to wait for" when no
face exists. The empty face list is the signal, not that call.

**Two hosts, not one.** The stylesheet comes from `api.fontshare.com` (for
`style-src`), and its `@font-face` rules load the files from
`cdn.fontshare.com` (for `font-src`, which allowed `'self' data:` only). This
was read from the stylesheet's own `src:` URLs.

**One list, as A40 taught.** `lib/security/image-hosts.ts`, already the CSP's
source for `img-src` and `connect-src`, now also holds `FONT_STYLESHEET_URL`,
`styleSrcSources()` and `fontSrcSources()`. The layout links the stylesheet and
preconnects from those. `next.config.ts` builds `style-src` and `font-src` from
them, and neither file names a fontshare host any more.

**Proof so far, watched red first.** The layout and `next.config.ts` pins failed
against develop. Four mutations each failed their own test: `style-src` without
the host, the font host written into `next.config.ts`, the layout linking its
own URL, and the wrong file host.

### A49 - an identity document is a key in its owner's storage, nothing else - `PROUVE`

**Cost impact: None.**

**Proven on dev** at `sha-23a2b97` (#187), 25 September:

- develop run `36188370177`: delivery journeys and E2E green. Journey 2 uploads a
  real document and attaches it through `PATCH /users/me/id-document`, so a
  legitimate key still passes;
- `PATCH /users/me/id-document` with `https://evil.example/cni.png`, signed in as
  the seeded agent: **400**, "Les pièces d'identité doivent être envoyées depuis
  votre compte, avec le bouton de téléversement." It is refused before anything
  is read or written.

**The premise, corrected first: it was mine.** A44's entry said identity
documents "are stored as full `https://` URLs". Measured properly on dev on 25
September: **241 documents, all keys** in their owner's own folder
(`users/<id>/id-documents/<timestamp>-<name>`), all written by the delivery
journeys' throwaway accounts. The admin user list signs every stored key on the
way out (`getDownloadUrl`), and I had read those signed URLs as stored values.
All 241 came back signed, and a stored address would come back unsigned. **So no
stored document needs a decision.** That line in A44 is struck through and
retracted.

**What was true, and is closed here.** `PATCH /users/me/id-document` took
`z.string().min(1)` (any string) and stored it. `getDownloadUrl` hands an
`http(s)` value back as it stands, so an address on anybody's server would have
travelled into the identity-review queue as a customer's identity document.

**A44's mechanism, reused rather than copied.** `core/users/avatar-key.ts`
became `core/users/storage-keys.ts`: one `userFileKey` for the upload routes and
one `isOwnUserFileKey(userId, folder, value)` for the write paths, with the folder
(`avatar` or `id-documents`) part of the rule. `submitIdDocument` refuses before
reading anything when any document is not a key the upload route could have
issued to this person in their `id-documents` folder. The refusal is translated.
The DTO message "Must be a valid URL", which invited the defect, is gone.

**Tests that encoded the defect, corrected.** `users.service.spec.ts` submitted
`https://s3.example.com/...` and `pending-id-documents.spec.ts` submitted
`s3://a.pdf` as their examples. Both now use keys. The "already verified" test
asserted only `rejects.toThrow()`, so it would have passed on the new refusal
instead of the `Forbidden` it exists for. It now asserts `ForbiddenException`.

**Proof so far, watched red first.** On develop, all five refusals stored the
value: a foreign site, our bucket as a URL, another person's document, this
person's avatar, a key climbing out of its folder. Three mutations each failed
their own test: no check, any folder of the person (which also fails A44's
test, proof that the rule is shared), and only the first document checked.

**Found, not fixed:** the KBS candidate's `cvUrl` has the same defect, with
`z.string().min(1, 'Must be a valid URL')` stored unchanged. It is the next field
for this rule, and not this brief's.

### A51 - the language-switch E2E test depended on a style injection that the CSP refuses - `PROUVE`

**Cost impact: None.**

**Proven on develop** at `ad56d1a` (#190), run `36190495431`, **attempt 1**:
E2E green, `✓ [firefox] › locale-routing.spec.ts:109 › switching language keeps
the visitor on the same page` passed first time, and the run reported 118 passed
with nothing failed, flaky or retried.

**The cause, named.** `locale-routing.spec.ts` › "switching language keeps the
visitor on the same page" called `page.addStyleTag` before each click, to hide
the TanStack Query devtools' launcher. In Firefox that call itself failed:
"Content-Security-Policy: The page's settings blocked a JavaScript eval
(script-src) … (Missing 'unsafe-eval')". The page's CSP rightly has no
`'unsafe-eval'`. It failed on develop runs `36163313789` and `36184349270`, and the
first went green only through a re-run.

**Its premise was false as well.** The comment said the devtools render because
the suite runs against a `development` build. CI runs it against the deployed
dev site, and the web image is a production build on every environment (A48
lists the web's `NODE_ENV` gates). So on dev there was nothing to hide, and the
only thing the injection did was fail.

**The rewrite.** No injection. The switcher is focused and activated with
Enter, which is what a keyboard user does. A key press is not intercepted by an
element drawn over the button, so the same test also holds against `next dev`,
where the launcher does exist.

**Measured, against dev, retries forced to 0** (`CI=1`, `--repeat-each=10`):

- before: **2 failed of 10** in Firefox, both inside `addStyleTag`;
- after: **20 passed of 20**, ten in Chromium and ten in Firefox.

Playwright's Firefox build was installed locally for this, the same install CI
runs.

### P29 - the product marks in the emails and notifications - `PROUVE`

**Cost impact: None.**

**Proven on dev with delivered mail**, 25 September, at `sha-abfacdb` (#188).
Develop run `36192076554` had journey 4 create the throwaway client
`j4.portal.…@maildrop.cc`. Its inbox, read through maildrop's public API, held
four messages from `KAMBRIQ <noreply@kambriq.com>`:

- "Bienvenue sur votre portail client KAMBRIQ": "…Votre agent **KAMNET™** :
  Eric Mbou…";
- "Votre réservation a été annulée": "…veuillez contacter votre agent
  **KAMNET™**…";
- **0 unmarked product names** across them.

No reservation or account was created for the proof.

**Visquis's decision of 25 September was about the mark, not a surface.** P27
applied it to the website. The API writes its emails and notifications from its
own catalogues, `libs/common/src/i18n/{fr,en}/*.json`, which named KAMNET
without the mark in **20 strings per language**: 16 in `email.json` and 4 in
`kamnet.json`. They cover nine templates: `clientPortalAccess`,
`applicationSubmitted`, `applicationApproved`, `applicationRejected`,
`agentPromotion`, `agentSuspended`, `agentReactivated`, `certificateIssued` and
`reservationCancelled`. LANDS and VERIFY appear in none.

**P27's guard extended, no second rule.** `trademark-marks.spec.ts` now also
reads every file in the API's catalogues as a namespace, watched unless declared
in `API_EXEMPT_NAMESPACES` (empty, with stale entries failing). It uses the same
`unmarked` rule and the same refusal of a double mark and of `KBS™`.
Code strings that name KAMNET (internal error messages and Swagger summaries)
are not copy a customer reads, and are left as they are.

**Proof so far, watched red first.** On develop, the extended test failed on 20
strings per language. Two mutations each failed it: one email string unmarked,
and a new API catalogue file naming KAMNET with the guard untouched.
`email.templates.spec.ts` pinned the sentence "Votre agent KAMNET : Eric Mbou"
to prove the agent's name is printed. It follows the decision, now "KAMNET™".

### I44 - the administration screens show no invented data - `PROUVE`

**Cost impact: None.**

**Proven on dev** at `sha-d90e9cb` (#189), 26 September, signed in as the seeded
administrator, each screen read over HTTP:

| route                  | fr                                                      | en                                                  |
| ---------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| `/admin/lands/search`  | Recherche de terrains · Pas encore disponible           | Land search · Not available yet                     |
| `/admin/lands/compare` | Comparaison de terrains · Pas encore disponible         | Land comparison · Not available yet                 |
| `/admin/verify`        | Administration KAMBRIQ VERIFY™ · Pas encore disponible | KAMBRIQ VERIFY™ administration · Not available yet |

None of the invented parcels, clients or statistics is rendered. The words "En
attente" do occur in the French page source, but every occurrence is inside the
translation catalogue next-intl ships to the browser (for example
`depositPending`), not in rendered text, and none of them is the invented
statistic.

**The finding, confirmed.** `/admin/lands/search` and `/admin/lands/compare`
rendered `data/mock-lands.ts`: parcels with invented titles ("Terrain Dibamba"),
prices and title numbers. `/admin/verify` rendered four invented verification
requests (Jean Dupont, Alphonse Biya, Sandra Njoh, Roland Fouda) under invented
statistics (4 pending, 3 in progress, 18 completed this month, 2 rejected). An
administrator read them as the business. It is the same lie as I43 and as the six
invented agents on `/agent/network`, moved to the back office.

**Honest empty state, not real data, decided.** None of the three has a real
source: VERIFY has no backend yet, and the search and compare screens were built
over the mock (map, filters, comparison table). Wiring real data would be
building those features. So each is now I43's placeholder, its translated name
and "not built" and nothing else, and I43's own test covers them. Its pinned list
of placeholder screens grew from ten to thirteen, which is the review that pin
exists to force. `verify-requests-table.tsx`, invented rows and nothing else, is
deleted, and its two entries leave I43's hardcoded-copy debt list, paid.

**The pin, like `/agent/network`'s.** `admin/invented-data.spec.tsx` renders the
three screens in both languages and refuses every invented value: the four
requests and their places, the four statistic labels, and every title and title
number in `MOCK_LANDS`, read from the file so the list cannot drift. **Two
defects in the test's first version, found by running it:**

- compare passed on develop, because with nothing selected the screen showed
  nothing. The test now selects two mock parcels first, as an administrator
  arriving from search would have;
- search and compare failed on a crash, because `next/image` refuses remote
  hosts under Jest, and not on a value. `next/image` is now a plain `img` in
  this spec. The red is then "Terrain Dibamba" on both screens.

**Proof so far:** red on develop for all three screens, fr and en. Three
mutations each failed: search back on the mock, compare back on the mock, and
verify's invented statistics back without the table.

**Found, not changed:** the search and compare components and `MOCK_LANDS`
remain in the repository, rendered by no route, as the base for wiring real
data. `StatCard` is now used by nothing.

### P5 - the KAMNET application form stored nothing and said it had - `EN COURS`

**Cost impact: None.**

**The finding, confirmed.** `/kamnet/apply` rendered a form whose submit
waited 800 ms and toasted "Candidature soumise !", and whose "Brouillon" button
toasted "Brouillon sauvegardé". Nothing was sent and nothing was stored. With
recruiting live, every submission was a real person told they had applied.

**The API already had the real flow, and the page never called it.**
`POST /kamnet/applications` stores a `KamnetApplication` for the signed-in user.
It requires an active KCA certificate whose number matches, emails the applicant
(`applicationSubmitted`), and the administration can list and review
(`GET /kamnet/admin/applications`, `POST …/:id/review`). What was missing: the
web call, a notification to KAMBRIQ, and any screen listing applications
(`/admin/kamnet` is an I43 placeholder).

**The floor, landed first as its own PR.** The page now says, in both
languages, that online applications are not open and that no form on it records
anything. It sends people to the contact form, whose "Devenir agent KAMNET™"
subject is stored and notified since L1. It goes through the translations, so it
leaves I43's hardcoded-copy debt list. The copy is mine, for Visquis:
`kamnetApply.closed.*`.

**The real thing, on top of the floor.** The page reads where the signed-in
person stands (`getMyApplicationStanding`) and shows one of four states, each
from the API:

- **no valid certificate** (a 404, or the 403 somebody who never enrolled in
  KBS gets): no form, a link to the KBS training and one to the contact page;
- **standing unreadable**: it says so, and never says "not certified", which
  would be a false statement to the very person being recruited;
- **an application exists**: its real status and date;
- **may apply**: a form that posts to `POST /kamnet/applications`.

The form never claims success itself. A stored application re-renders the page
from the API, and a refusal is shown where it happened.

**Visquis's defaults, and where I departed from them:**

- _Store with the data the form already collects, do not enlarge it._ I shrank
  it. The old form asked for name, email, phone and address, which the account
  already holds and the API does not take. Collecting them to drop them would
  have been a smaller version of the same lie. It now asks for a sponsor code
  (optional) and a motivation (50 to 1000 characters, as before). The KCA
  number the API requires is read on the server from the applicant's own
  certificate, never typed and never taken from the browser;
- _Notify by email to `contact@kambriq.com`_: done, through `CONTACT_INBOX_EMAIL`
  as the contact form does, in the back office's language, with a new
  `kamnetApplicationNotification` template (name, email, phone, certificate,
  sponsor code, motivation). As in L1, the record is the success. Both mails,
  the applicant's confirmation and the inbox notification, are logged loudly on
  failure and never fail the request. Before this, a failed confirmation mail
  failed the request after the application was stored, and sent the applicant
  back to a 409;
- _A minimal back-office list if natural_: **not built.** `GET
/kamnet/admin/applications` and `POST …/:id/review` already exist, but
  `/admin/kamnet` is an I43 placeholder, and a list there is a screen of its own.
  **The list is missing.** Applications are seen through the notification and
  the API;
- _I26 shares a storage shape?_ I26 is not in this repository's register. The
  application is `KamnetApplication`, which the API already defined, so no new
  shape was invented.

**Proof so far.** The page states and the actions were tested on their own (the
L1 lesson, since the page tests mock the actions). The notification cases:
announced, stored when the announcement fails, stored when the applicant's mail
fails, and loud when no inbox is configured. Escaping of the new template is
tested. Four mutations each failed their own test: any failure read as "not
certified", the browser's KCA number trusted, the inbox given the wrong mail,
and the applicant's mail able to fail the request.

**New copy for Visquis:** `kamnetApply.*` and
`email.kamnetApplicationNotification.*`.

**Proven on dev**, 26 September, in Chromium (Playwright), signed in as the
delivery journeys' throwaway certified accounts (`j3.kbs.…@maildrop.cc`, never a
person):

- before submitting, the page showed the form and the account's own
  certificate (`KCA-20260925-1VZK`). After submitting, it re-rendered from the
  API: "Candidature en attente de revue - Votre candidature a été enregistrée le
  26 septembre 2026 à 06:19", and a reload shows the same;
- **stored**: `GET /kamnet/admin/applications` lists it, `PENDING`;
- **the applicant's mail received**: each inbox holds "Demande KAMNET™ reçue"
  from `noreply@kambriq.com`, at the second of submission.

**The notification was not being sent, and the logs said so.** The first two
submissions logged, at `error`, "stored but not announced: CONTACT_INBOX_EMAIL
is not set". L1 had recorded that infra follow-up on its own day ("until then
dev stores every request and announces none, loudly") and it was never done,
so **no contact request had ever been announced on dev either**. Added in
kambriq-infra #66 as a dev environment variable of the API task
(`contact@kambriq.com`, not a secret). The plan was read first (the API task
definition replaced, nothing else) and applied under the standing
authorization: `1 added, 0 changed, 1 destroyed`. The 1 destroyed is revision
204, which nothing ran. The variable reached the running task at the next
develop deploy (revision 233, `sha-d917d42`). The third submission then logged
`Email sent to contact@kambriq.com messageId=010701a0dc6fbbca-cbb891ef-41cf-46fd-af79-998b8386f0cd-000000
subject="Nouvelle candidature KAMNET™ - Journey Three"`.

**What I cannot show is that message arriving in `contact@`.** That is D19's
blind spot: the mailbox is not observable from here, and SES accepting a send
is not receipt. **Visquis confirms it** by finding the message above in
`contact@`.

**The login wall stays.** The register's own P5 row records that the public
product pages link to `/kamnet/apply` behind the login wall, kept deliberately
(P3): widening it is a product change.

### G8 blocker - only the chosen channel's details leave - `PROUVE`

**Cost impact: None.**

**The row was stale for 19 days, and the exposure it described was closed on
7 September.** The row said "re-land `230b827` … until then dev emails every
channel's coordinates to whoever clicks". Measured on 26 September:

- `230b827` is PR #89's G11–G14 work, and it is **not** in develop's history;
- **it did not need to be**: `5c35aa2`, "fix: re-land the G11-G14 work on
  develop (#92)", is, and its code is identical to `230b827`'s (an empty diff
  across `apps`, `libs` and `prisma`).

**How it was lost - the process defect, named.** #89 was stacked on #88, with
`feat/g9-payment-entry-point` as its base. #88 merged at 09:59:41 on 7
September, and #89 merged into the already-consumed branch at 10:01:10,
**89 seconds later**. GitHub called it merged, and nothing reached develop. It
was found and re-landed as #92 at 14:36 the same day. CLAUDE.md has recorded
this rule since then ("a stacked PR must be re-based when its base merges, or it
merges into nothing"). **What went wrong after that is the register itself**:
this row was never updated, so it described an open exposure for 19 days after
the fix. That is the stale-record defect `register-is-the-record` exists for,
surviving because it was a row about a single commit.

**What was actually exposed, and to whom - narrower than "every channel to
whoever clicks".**

- _Before_ the re-land (v02, until #92 deployed on 7 September): the
  instructions email (and the reminder after it, `paymentReminder`) listed
  every channel's coordinates, and went to the
  signed-in client who requested a payment on their own reservation. It was
  not open to "whoever": the code refused unless `reservation.clientUserId` was
  the caller (read at `230b827~1`), so the recipient was authenticated and the
  payment was their own. On dev the coordinates are deliberately fictitious
  (`DEV-COMPTE-FICTIF-NE-PAS-UTILISER`, see CLAUDE.md), and no production
  environment exists. So what was sent was the design error v03 corrected:
  every channel instead of the chosen one, to the right person, with fake
  values;
- _Since #92_: `sendInstructions` takes the one channel the back office chose,
  after the client's identity is verified. It fetches only that channel
  (`detailsFor(by.channel)`) and stores what was communicated. **The email
  carries no coordinates at all** (`no-coordinates-in-email.spec.ts`), and the
  client reads them on their own authenticated page. KAMBRIQ's support phone
  and email ride along by design, so the client has somebody to call.

**The test the brief asked for.** `payment-instructions.spec.ts` proved that
`sendInstructions` asks for one channel, but it mocks `detailsFor`, so nothing
proved what `detailsFor` hands back. `one-channel-leaves.spec.ts` runs the real
service with every channel's parameters present, the worst case, and requires,
for each selectable channel, exactly its own fields plus the named support
contact, and no value belonging to another channel. **My own first version was
wrong**: it failed on the support contact, which is by design and not a
leak. The allowed set now names it. Mutations: sending every channel's fields
failed six cases, and adding one foreign field failed five (all but OMO, whose
own field it is).

**G8 stays open.** It carries the deferred dev proofs of eleven other
subjects. Only this blocker is closed.

### A52 - a KBS candidate's CV is a key in their own folder, nothing else - `PROUVE`

**Cost impact: None.**

**Proven on dev** at `sha-d5fd78e` (#195), 26 September, in Chromium, signed in
as an E2E throwaway account (`e2e-login.…@maildrop.cc`) that had not enrolled:

- on `/fr/kbs`, an identity image and a PDF CV were chosen. Both presigned PUTs
  answered **200**, to `users/<id>/id-documents/…` and
  `kbs/candidates/<id>/cv/1790406285517-a52-cv.pdf`. The page moved to
  "Inscription en attente de validation";
- the admin candidate detail returns the CV **signed**, so what is stored is a
  key, the one issued in the owner's CV folder;
- the same account posting `https://evil.example/cv.pdf` to `POST /kbs/enroll`:
  **400**, "Le CV doit être envoyé depuis votre compte, avec le bouton de
  téléversement.", refused before anything is read.

**Same defect as A49, one field further.** `enroll` took `cvUrl:
z.string().min(1, 'Must be a valid URL')`, which is any string, and stored it,
and `getDownloadUrl` returns an address as it stands.

**Counted before concluding, as A49 taught.** On dev: **136 candidates, none
with a CV stored.** The detail route returns `cvUrl` (the key is present and
`null` in every one), so the count is not a missing field read as absence.
**No stored record would be refused.** The journeys ask for a CV upload URL but
never enrol with one.

**One rule, not a third.** `core/users/storage-keys.ts` now names each folder by
its own path (`users/<id>/avatar`, `users/<id>/id-documents`,
`kbs/candidates/<id>/cv`), and one `isOwnUserFileKey(userId, folder, value)`
answers for all three. The CV upload route issues its key through the same
`userFileKey`. `enroll` refuses a CV that is not a key issued to this person in
their CV folder, before anything is read or written, with a translated message.

**Proof so far, red first.** On develop, the five refusals (a foreign site, our
bucket as a URL, another candidate's CV, this person's identity document, a key
climbing out of its folder) all enrolled the candidate. Three mutations each
failed: no check, the CV folder widened to the whole candidate folder (which
then refuses the legitimate key), and a check against the wrong folder. A44's
and A49's specs still pass, so the rule is shared, not forked.

### A53 - dead code that still carried the invented data I44 took off the screens - `PROUVE`

**Cost impact: None.** Less code in the web bundle's source.

**Proven, 26 September:** develop's own run on `844cf32`, the first head after
the merge whose run finished (#199 repaired the red below), run `36226927320`:
Quality (lint, both typechecks, the web and API suites), database suite, both
images, deploy to dev, delivery journeys and E2E, all green. That run is
"nothing breaks" measured on the deployed site.

**Removed, because nothing rendered it after I44 and nothing imported it:**
the land search components (`search-content`, `lands-map`, `land-card`,
`compare-bar`, `filters-bar`, and the `land-detail-modal` folder), the compare
components (`compare-content`, `compare-cards`, `compare-table`,
`compare-empty`), `data/mock-lands.ts` with its four invented parcels,
`store/lands-search.store.ts`, and `dashboard/shared/stat-card.tsx`. That is 17
files. Dead code carrying invented data is how the six invented agents lived
for months: somebody finds it useful and wires it back.

**Kept, and why:** ~~the `landSearch` namespace, which the real admin lands
screen also reads~~ (retracted below); Mapbox, which the client land map uses. **Named, not removed:** the
`landsCompare` namespace is now read by no component. It holds labels, not
invented data, and removing it would ripple into the copy pin that #174
rewrites.

**The pin survives its source.** `admin/invented-data.spec.tsx` read the
invented parcels from `MOCK_LANDS`. It now keeps them as literals ("Terrain
Dibamba", "TF 421/WB"…), the way `/agent/network`'s spec keeps its six names.
Mutated: `/admin/lands/search` showing "Terrain Dibamba" again fails it in both
languages. `brand-palette.spec.ts` lost the entry for the deleted `lands-map.tsx`.

**Proof so far:** the web typecheck is clean with the files gone, the whole web
suite passes (665 tests), and lint is clean.

**Retraction, 26 September: `landSearch` was never read by the admin screen.**
The admin lands screen reads `landsAdmin`. Its search box keeps its state in a
variable called `landSearch`, and a text search for the name found the variable
and I took it for a reader. The only readers were the components this chantier
deleted. So `landSearch` was as dead as `landsCompare`, and kept on a false
reason.

**Both namespaces are removed** (148 lines per language), with their two
entries in the P21 copy sweep's namespace list. `every-namespace-is-read.spec.ts`
now fails on any top-level namespace no source file names; watched red on
develop, it named exactly `landSearch` and `landsCompare`. The removal touches
one line #174 also rewrites (that list, which #174 replaces as a whole); the
catalogue hunks do not overlap.

**Develop went red, and it was mine.** The merge (`54e9e50`) failed develop's
Quality job on `role-code-literals.spec.ts`: an API convention test that reads
web files had an exemption for the deleted `land-detail-modal/dialogs.tsx`, and
an exemption that matches nothing fails, by design. **My local gate for A53 ran
the web suite, web typecheck and lint, and not the API suite** where that test
lives. That is the whole cause, and the rule it breaks is in this file ("full
gate"). The fix removes the exemption. Because the red run never reached the
delivery journeys, the CI Gate refuses every pull request until develop's head
is green again, the fix included, so the fix needs `merge-on-red-develop`, which
is Visquis's alone. The merge also went in under the PR's title rather than a
lowercase commit subject, because my merge script took the wrong field; the
script is corrected.

### I43 follow-up - the client payment screens read in the customer's language - `PROUVE`

**Cost impact: None.**

**Proven on dev, 26 September, in Firefox, against web `sha-cf56bc1`**, signed
in as the G8 throwaway client `g8.client.1789151649764@maildrop.cc`, read only:
`/en/mylands/payment/449d7584-…` (validated, bank transfer), `/en/mylands/payment/cdbebecc-…`
(requested, details not yet sent) and `/en/mylands/purchase/380d2626-…` (the
request card) read in English throughout: "AMOUNT DUE", "How to pay - Bank
transfer (VIR)", "Account number / IBAN", "Keep your receipt", "Your request has
arrived", "Pay the deposit", "Get my payment reference". What is still French is
data, not copy: parcel names, and the deliberately fake dev channel values from
SSM ("DEV - aucune banque reelle").

**The first reading was of the wrong build, and it said French.** I waited for
the API's `/api/v1/health/version` to report the new sha, and the deploy
rolls the API out first: the web was still the old image. The web answers its
own identity at `/health`. The second reading waited for that.

**Found, not changed:** the purchase page writes the same deposit as "170 000
XAF" in the card and "170 000 FCFA" in the journey, and shows a remaining
payment of "1 631 830 000 FCFA" on that parcel. P28 says touch no price, so it
is named here.

`components/mylands/my-payment-content.tsx` (the client's payment page) and
`request-payment-card.tsx` (the card that issues the payment reference) were
French only and on I43's hardcoded-copy debt list. They are read by customers,
many in the diaspora, and an English speaker paying a deposit read "Montant à
régler". These two are off the list; **28 debt entries remain**, all back-office
or public-page copy.

**The strings were not the whole of it.** Translating the sentences alone
would have left an English reader with French channel names (from the shared
`PAYMENT_CHANNELS` labels, via `ChannelLabel`) and French coordinate labels (a
`FIELD_LABELS` table in the component). Both now come from `myPayment` on these
client screens. The shared admin component is untouched. `HumanDate` takes an
optional locale, French by default as before, and the client screens pass the
reader's. The "follow my request" link goes through the locale-aware `Link`.

**For Visquis:** the French keeps today's wording, with accents the shared
labels lacked ("Dépôt d'espèces", "Espèces en main propre"), and the error "La
preference n'a pas ete enregistree" gained its accents too. The English is mine.
Amounts are formatted as before, and **no price or currency is touched** (P28).

**Proof:** `client-payment-screens.spec.tsx` renders the payment page (with
coordinates, and waiting for identity) and the request card (before and after a
reference) in both languages, and checks that the English render holds none
of the namespace's French-only strings. Against develop's components: the three
English tests fail and the French ones pass. `next-intl-mock` gains `t.has`.

### A19 - develop linted one project of six - `PROUVE`

**Cost impact: not recorded in the sources.**

The row: _"develop linted 1 project of 6 for seven months: the workflow promised
"the full set", `pnpm run lint` was `nx lint api`. Widened to `nx run-many -t
lint --all`; manifest corrected; proved in both directions"_.

The commit is `44e27a2 fix(a19): lint every project on develop, and make the
manifest true` (11 September). It touches `ci.yml`, `package.json`,
`libs/common/package.json` and `libs/common/eslint.config.mjs`.

CLAUDE.md, "A check that never runs looks exactly like a check that passes",
records the detail. `libs/common` had two undeclared dependencies, `ioredis` and
`@jest/globals`. The defect surfaced when `#98` touched `libs/common`. The proof
in both directions was: _"`nx lint api` succeeds against the reintroduced defect
and `nx run-many -t lint --all` fails naming both errors"_.

### A31 - the seed left parcels AVAILABLE under a reservation - `PROUVE`

**Cost impact: none (the row: _"Cost: none"_).**

The row: develop went red on journeys 4 and 5 from 08:22 UTC on 14 September.
_"The seed kept payment-carrying reservations, reset their parcels to AVAILABLE
anyway (8 on dev), and the first available parcel answered 409. Fixed in the
seed and proved locally."_ **Pending, per the row: "merge, one seed run on dev,
a green journeys run on develop".**

`3734818 fix(seed): a parcel held by a reservation the seed kept stays held
(a31) (#126)` is on develop (15 September). It adds
`prisma/seed-data/parcel-status.ts` and
`apps/api/src/__test__/seed/parcel-status.spec.ts`. No source quotes the seed
run on dev or the journeys run that the row names as the proof.

CLAUDE.md, "A postcondition that counts a word has not checked the thing", says
four merges went in on top of the red. The old postcondition counted eighteen
AVAILABLE rows and passed. The new check asks that _"no seeded parcel is
AVAILABLE while a reservation holds it"_. It was proved on develop's seed with
only the new check added: the count passes and _"the new check alone refuses,
naming the parcels"_.

**Row corrected, 26 September:** it said the merge was pending; the commit
above is on develop, so the row now names only the dev-side proof, which no
source quotes yet.

**Proven, 26 September.** Read in `kambriq_lands` on dev: **0** parcels `AVAILABLE` while a reservation other than `CANCELLED` holds them - the state the fix protects, and the one that turned develop red. Develop's delivery journeys were green on every run that day (for example `36246336133`). The seed has not been observed running on dev since #126 (it is opt-in and deletes reservations); what is proven is the state, not a seed run.

### A32 - the CI gate reads develop at its head - `EN COURS`

**Cost impact: each push to develop blocks merges for about 20 minutes (the
row: _"each develop push blocks merges ~20 min"_).**

The row: _"Gate reads develop's HEAD sha, then its run
(`scripts/ci/develop-gate.sh`): green passes; red, never started or not yet
verified refuses; label `merge-on-red-develop` plus re-run releases. v1 read a
list and passed #134 on a stale run; 12 stub cases run in every CI Gate."_ The
row names no pending proof.

Two commits, both 15 September: `23af837 ci(a32): the gate refuses while develop
is red on the journeys (#130)` (v1), and `4a4b349 fix(ci): the develop gate reads
develop's head by sha (a32) (#141)`. The second adds
`scripts/ci/develop-gate.sh` and `scripts/ci/develop-gate.test.sh`.

CLAUDE.md, "A gate that only sees the pull request cannot see develop", records
why. On 14 September six pull requests merged on a red develop. On 15 September
the list-based v1 _"answered #134 with a run six merges old"_. The gate fails
closed, and it _"stops the stacking, not the breaking"_. Labels are read live
through the API, because a re-run replays the original event.

The gate is recorded in use twice. The wave note, "P11 merged - #162, 23
September", has _"`merge-on-red-develop` was not used"_. The `A53` entry has
_"the CI Gate refuses every pull request until develop's head is green again
... the fix needs `merge-on-red-develop`, which is Visquis's alone"_.

### A36 - the journey client waits out a 429 - `PROUVE`

**Tracker correction, 27 September:** proven by every develop run since - the
delivery journeys green on `b063685`, `61388d9`, `e4fdfd4` and `daddcd9`, all from
one runner address, `call()` waiting out the throttle window as built. The web
E2E suite met the same shared budget on the login route the same day (I45,
#242).

**Cost impact: up to 120 s added to a journeys job that is actually throttled,
none otherwise (the row).**

The row: develop went red on `70a5e07`. Both journey suites run in one
`runInBand` process from one runner address, and `getTracker` keys on the last
X-Forwarded-For entry. So they _"legitimately share one bucket of 100 requests
per 60000 ms"_: 9.33 s apart PASSED on `1cbde1a`, 0.36 s and 0.35 s apart
FAILED on `70a5e07`. `call()` now waits one full window and retries, at most 3
attempts. `getTracker` has 11 tests. The spec runs in `Quality` through a new
`test` target. **Pending, per the row: "a green `Delivery journeys (dev)` on
develop".**

The commit is `8f84b4f fix(journeys): wait for the throttle window on a 429, and
the exam passing score is 80 (#150)` (18 September). It adds
`apps/api-e2e/jest.unit.config.cts`,
`apps/api-e2e/src/unit/support.call.spec.ts` and
`throttler-behind-proxy.guard.spec.ts`. It also carries `I31`.

Three CLAUDE.md sections come from A36:

- "A prose guarantee is a claim, and the system is not obliged to keep it" (the
  comment _"In CI the suite runs once per deploy and never sees it"_, run
  `35306506751`, and the two fixes that were refused);
- "A test has to live somewhere that runs, and a project can have nowhere";
- "The code that decides who owns the bucket had no test" (the `parts[0]`
  mutation fails five).

No source quotes the pending journeys run.

### Audit 2026-09-23, unwaved - findings with no wave assigned - `A FAIRE`

**Cost impact: not recorded in the sources.**

The row lists three findings. `/admin/verify` and `/kamnet/apply` are _"mocks
behind real roles that toast success and write nothing"_. The Mapbox build `ARG`
_"reaches no workflow, so the land-search map is dark in every image"_.
`legal/mentions/{fr,en}.mdx` publishes _"`Capital social : XXX XXX XAF` and
`N° RCCM : XX / XXX / XX` on a public page"_.

The same list is in the `Audit 2026-09-23, wave 2 - correctness` entry, under
_"Still open from the same audit, none of it started"_. There it also names the
RSC bearer token, which the wave 1 row says wave 5 closed, and it places the
Mapbox `ARG` in `Dockerfile.web`. The `Audit 2026-09-23, wave 6 - SEO` entry
says the structured data _"carries no RCCM number and no share capital"_,
because _"the public mentions légales still serves `XXX XXX XAF"`_.

Later rows cover two of the three findings: `I44` (`PROUVE`) for `/admin/verify`
and `P5` (`EN COURS`) for `/kamnet/apply`. See contradiction 3 at the top. No
source records work on the Mapbox `ARG` or the mentions placeholders.

**Row corrected, 26 September:** `/admin/verify` (I44) and `/kamnet/apply` (P5,
#193) are no longer mocks; the row now says so and keeps the two findings still
open.

### G22 - an annulled payment showed its amount as still owed - `PROUVE`

**Cost impact: None.**

Seen on 27 September reading #225's screens: the payment list showed annulled
payments with their whole amount under "Reste". In a back office where money
decisions are made, that figure gets read, added up and used.

**The cause:** five reads computed `outstanding` as `amountDue - received`
whatever the state - the back-office list and detail, the overdue queue, the
client's payment page and `validate`'s answer.

**The rule, in one place:** `outstandingOf(state, amountDue, received)` in
`libs/common/src/payments/payment-state.ts` - nothing outstanding for `ANNULE`,
`REJETE` and `EXPIRE`, which no longer ask for money; otherwise the amount due
less what the ledger received. Money such a payment did receive stays visible
as `amountReceived` on its ledger; returning it is a separate act. All five reads
call it.

**Proof, red first:** `outstanding.spec.ts` (the three closed states owe nothing,
with or without receipts; the six others owe the difference) failed before the
function existed; `annulled-owes-nothing.spec.ts` holds the back office's list
and detail to `outstanding: '0'` with the receipt still counted. Removing the
rule fails three.

**Pending:** the back-office list read on dev after the deploy.

**Proven on dev (API `sha-bec5ebd`), 27 September,** reading the back office's
payment list as the test administrator: **46 `ANNULE` payments, every one at
`outstanding: 0`**, the one that had received money still showing its
`amountReceived`; the 6 live `INITIE` requests still owe their amount; the
validated ones owe nothing.

### G21 - cancelling a reservation annuls its live payment - `PROUVE`

**Cost impact: None.**

**Was `G8` follow-up** (27 September, journey 7's first run): `POST
/lands/admin/reservations/:id/cancel` answered 200 and left the reservation's
INITIE deposit INITIE, in the back office's request queue under a CANCELLED
reservation.

**Decided by Visquis, 27 September:** cancelling a reservation **annuls** its
live payment, with a written reason - consistent with G1, nothing disappears and
everything is traced, and a client who withdraws is never stuck behind a ghost
payment. Rejected: refusing the cancellation while a payment lives, which
strands the client behind a back-office action.

**Built:** `LandReservationsService.cancel` finds every payment of the
reservation that is not in a terminal state and moves each to `ANNULE` through
`PaymentsService.transition` - the one write path for a payment's state, which
writes the audit row with the canceller as actor and the reason
`Reservation <id> cancelled: <the cancellation's reason>`. Before the
reservation itself, so a refusal leaves both as they were. **What stays:** a
`VALIDE` payment (money that arrived is not annulled; a refund is its own act),
and every receipt - the ledger is append-only, and a partly received payment is
annulled with its receipts still on it. The service now takes `PaymentsService`
(same module, no cycle).

**Proof, red first:** `cancel-annuls-live-payment.dbspec.ts`, on the real lands
migrations with the real `PaymentsService`: a live payment ends `ANNULE` with an
audit row from `INSTRUCTIONS_ENVOYEES`, the canceller as actor and the reason
readable; the annulled payment then **refuses VALIDE** (nothing validatable left
behind); a partly received payment keeps its receipt; a VALIDE payment is left
alone. Red before the change (the service had no way to reach a payment); a
mutation that finds no live payment fails three of the four.

**Proven on dev, 27 September:** the delivery journeys on `b063685` - 29 passed,
6 skipped (journey 7, opt-in) - with journey 4's client asking for the deposit
before the cancellation, and the payment read back `ANNULE` with
"automated journey cleanup - returning the fixture parcel" in its last
transition's reason.

### G1 - the payment model - `PROUVE`

**Proven on dev, 27 September,** by G8's end-to-end run (journey 7): a deposit
and a balance, each INITIE to VALIDE through the back office, BigInt amounts,
receipts on the append-only ledger, every step in the audit trail.

**Cost impact: None. Three tables in an existing database, no new resource
(`docs/ops/g1-payment-model.md`).**

The row: _"payment model in `lands`: BigInt money, 9-state machine, append-only
ledger and audit. Pending proof is G8, one payment end to end on dev"_. The
commit is `73931c0 feat(g1): the payment data model and state machine (#82)`
(6 September).

`docs/ops/g1-payment-model.md` covers the rest:

- The tables are `Payment`, `PaymentReceipt` (the ledger) and
  `PaymentTransition` (the audit trail). Both append-only tables carry a
  `BEFORE UPDATE OR DELETE` trigger that raises.
- The states are `INITIE`, `INSTRUCTIONS_ENVOYEES`, `ANNONCE_CLIENT`,
  `EN_VERIFICATION`, `PARTIELLEMENT_RECU` (which loops), `VALIDE`, and the exits
  `REJETE`, `EXPIRE` and `ANNULE`.
- `assertTransitionIsDeliberate` refuses a committing transition that has no
  named person and reason. `EXPIRE` is the one automatic exception.
- The schema is `lands` rather than `core` because there are no cross-database
  foreign keys.
- The document's "What is still missing" table leaves one thing undecided:
  whether, above a threshold, the validator must be a different person from
  the recorder.

CLAUDE.md "Money, and the three rules that hold it" states the same rules.

The pending proof is G8, and the `G8` row is `ARRETE`. The `G8` blocker row
(`PROUVE`) ends _"**G8 itself stays open**"_.

### G10 - channel parameters applied - `PROUVE`

**Cost impact: not recorded for G10. The `G10b (infra)` entry records _"None.
Four additional SSM Standard parameters (free tier is 10 000)"_ for G10b.**

There are three rows. `G10`: _"applied and observed: 16 SecureString parameters
none empty, task definition 143 with the three variables and no channel value,
0 AccessDenied"_. `G10` (webapp): _"an absent channel prefix now fails the boot
exactly as an empty parameter does; disabling is
`PAYMENT_CHANNELS_TRANSPORT=disabled`"_. `G10` (infra), `PLAN PRET`: _"twelve
parameters + the prefix into terraform. Plan run and shown, **nothing
applied**"_.

The observation is in the `G8 - the end-to-end proof on deployed dev` entry,
"Part 1 - the deployed state, as facts". It has 16 SecureString parameters,
none empty; task definition revision 143 with `PAYMENT_CHANNELS_SSM_PREFIX`,
`PAYMENT_CHANNELS_TRANSPORT=ssm` and `PAYMENT_VALIDITY_DAYS=30` and no channel
value; and 0 `AccessDeniedException` events. It ends _"This part passed, and it
closes `G10`"_.

The webapp half is in the `G9` entry, section "G10's webapp half - the asymmetry,
corrected": `payment-channels-config.spec.ts`, 7 tests, and _"Whitespace is
absence"_. The reader design is in CLAUDE.md "Channel details are configuration,
and the reader decides whether a fix needs a deploy". The spec's own reason for
this row is _"entry folded into G10b"_. The `G10` (infra) row and the `G10b`
entry contradict the bare row; see contradiction 2 at the top.

**Rows corrected, 26 September:** the `G10` (infra) row said "nothing applied".
Read on dev that day: the running API, `kambriq-dev-api:250`, carries
`PAYMENT_CHANNELS_SSM_PREFIX`, and 13 SecureString parameters exist under
`/kambriq/dev/api/payment-channels` (names and types only, no value). The row
now says `PROUVE`.

### I15 - the certificate is the truth, and renewal - `PROUVE`

**Cost impact: none (both rows: _"Cost: none"_).**

The `I15` row: _"CERTIFIED only by issuance, `isUserCertified` reads revocation
and decides at KAMNET submit and approval, KCA_CERTIFIED not settable by hand, a
daily sweep withdraws it on expiry. Dev: 60 holders, 0 without certificate, 0
expired. Pending: merge, first sweep on dev."_ The `I15` renewal row: _"a
renewal issues a new certificate (candidateId no longer unique, migration drops
one index); the old one stays verifiable. Proven locally through the real API
and page ... Pending: merge, migration on dev."_

Both are on develop, 15 September: `f79d4bb fix(kbs): the certificate is the
source of truth, kca_certified reflects it (i15) (#133)` and `ed60327 feat(kbs):
a renewal issues a new certificate, the old one stays verifiable (i15) (#139)`.
No source quotes the first sweep or the migration on dev.

CLAUDE.md, "A role that projects a record is not a setting", states the rule and
tags it `(I15)`. `record-derived-roles.ts` closes the admin doors, and the role
is withdrawn on revocation and on expiry. "Is this person certified" is asked of
`findActiveCertificate`, not of the role. CLAUDE.md "A barrier guards a table"
calls the wave 4 acompte fix _"`I15`'s rule at one boundary further out"_.

**Row corrected, 26 September:** it said the merge was pending; the commit
above is on develop, so the row now names only the dev-side proof, which no
source quotes yet.

**Proven, 26 September.** The dev API log holds the daily sweep: `Expired certifications withdrawn {"count":0,"renewedAndKept":0}` at 02:30 UTC on 22, 23, 24, 25 and 26 September (seven-day retention). Nothing to withdraw, and the sweep that would is running. The renewal row is proven with it: migration `20260915160000_i15_certificate_renewal` was applied on dev on 15 September at 18:08:22 UTC and never rolled back.

### I16 - CLIENT in its own right, suspension removes AGENT - `PROUVE`

**Cost impact: none (the row: _"Cost: none"_).**

The row: _"CLIENT in its own right first: dev one-off wrote 5 rows, 5/5 agents
now hold CLIENT directly; approval grants it. Then suspension and revocation
remove AGENT, lifting returns it if still certified; commissions read by
ownership. Pending: merge."_

The commit is `657f241 fix(kamnet): suspension removes agent, and client is held
in its own right (i16) (#138)` (15 September).

The wave note, "P11 - the public directory of certified agents", under
"Reported, not fixed", has an item headed _"I16 withdrawn."_ It records that
the two `/kamnet/commissions` routes carry no `@Roles` on purpose: _"suspending
an agent removes `AGENT`, which would have hidden commissions already earned, so
ownership via `findByUserId` is the guard"_.

**Row corrected, 26 September:** it named the merge as the only pending step;
the commit above is on develop. No source quotes a reading on dev, so the state
stays `EN COURS` rather than being moved without a proof.

**Proven on dev, 26 September:** in `kambriq_core`, 5 users hold `AGENT` and **0** of them lack `CLIENT`.

### I18 - one definition of the roles - `PROUVE`

**Cost impact: none (the row: _"Cost: none"_).**

The row: _"the literal ban now scans `apps/web` and the e2e suite; 8 codes in 14
web files moved to `RoleCode`. The layout's own ROOT check is deleted (decided
15 Sept); the proxy is the one gate, proven by mutation. Pending: merge through
the gate."_

Two commits, both 15 September: `a4f403b fix(web): one definition of the roles
(i18) (#134)` and `1145add fix(web): one gate for /admin/kbs, the proxy (i18)
(#140)`.

CLAUDE.md, "A string literal where a constant exists", says
`role-code-literals.spec.ts` now covers `apps/web/src` and the e2e suite. It had
covered only three trees, _"which is how a role that does not exist, `ROOT`,
came to guard a real layout (`I18`)"_. The web imports the enum once, through
`apps/web/src/lib/roles.ts`. The `I43` entry and the `I32` entry both refer back
to I18's shape.

**Row corrected, 26 September:** it named the merge as the only pending step;
the commit above is on develop. No source quotes a reading on dev, so the state
stays `EN COURS` rather than being moved without a proof.

**Proven on dev, 26 September:** with no session, `/fr/admin/payments`, `/en/agent/network` and `/fr/account` each answer **307** to `/<locale>/login?callbackUrl=...`. The literal ban is a test on every PR.

### I19 - no user without a role - `PROUVE`

**Cost impact: none (the row: _"Cost: none"_).**

The row: _"registration refused a missing CLIENT row silently, an existing user
reserved as a client got no CLIENT, the seed wrote 8 role rows of 11. Fixed, red
then green locally. Pending: merge through the gate, then one seed run on dev
showing 11 rows."_

The commit is `32c9dd7 fix(core): no user without a role (i19) (#132)` (15
September). No source quotes the seed run on dev showing 11 rows.

**Row corrected, 26 September:** it said the merge was pending; the commit
above is on develop, so the row now names only the dev-side proof, which no
source quotes yet.

**Read on dev, 26 September - the proof does not hold yet, and why.** `Role` holds **8 rows**: every code but `STAFF_VERIFY`, `STAFF_VALUATION` and `PARTNER_GEO` - exactly the "8 role rows of 11" this chantier fixed in the seed, and the fix only reaches dev through a seed run, which is opt-in and deletes reservations, so it was not run. **2 active users hold no role at all**: both `@maildrop.cc` throwaways created on 4 September at 10:38 and 10:39, eleven days before #132 - the registration defect this fixed, left behind in the data. No new roleless user since. Neither the seed run nor a hand-written role upsert is mine to choose: **pending Visquis**.

**Visquis, 26 September: the three rows, not the seed.** The seed deletes
reservations, and would have destroyed the 200 dev reservations and the payment
history G20 was proven on. **Done on dev the same evening**, through ECS exec, in
one transaction on `kambriq_core` that aborted unless it found what had been
read:

- The three rows inserted with the seed's own ids, codes, names and
  descriptions (`prisma/seed-data/roles.ts`); the transaction refused if any id
  or code already existed.
- The role-less users re-read inside the transaction (not deleted, no role):
  exactly two, both `@maildrop.cc`, both created on 4 September - otherwise
  rollback. Each was given **`CLIENT`**, with `grantedBy` empty as registration
  leaves it. **Why `CLIENT`:** it is what `auth.service.ts` gives every account at
  registration, and what these two would hold had they registered after #132;
  it grants the client portal only, nothing I16 or I18 restrict (no AGENT, no
  admin, no ROOT path). Leaving them role-less was the defect; suspending them
  would have been a decision about test accounts that are not mine to delete or
  retire.

**Read back after commit:** 11 role rows (every `RoleCode`), **0** live users
without a role, the two grants dated 2026-09-26 17:56 UTC. The lands database was
not opened: no reservation or payment touched.

### I20 - training content only to an enrolment that permits it - `PROUVE`

**Cost impact: none (the row: _"Cost: none"_).**

The row: _"any logged-in account read KBS lessons, drafts and outlines through
the API (the web never called those routes). Lesson now needs a verified
candidate record and a published course; lists and outlines are published-only.
Pending: merge, then a no-record call on dev answering 404."_

The commit is `97aefee fix(kbs): serve training content only to an enrolment
that permits it (i20) (#136)` (15 September). No source quotes the no-record call
on dev.

**Row corrected, 26 September:** it said the merge was pending; the commit
above is on develop, so the row now names only the dev-side proof, which no
source quotes yet.

**Proven on dev, 26 September.** `GET /kbs/lesson/0c18de43-…` (a lesson of the published KCA course): as `admin@kambriq.com`, which holds CANDIDATE_KBS through ADMIN_GLOBAL and has no candidate record, **404 "You are not enrolled in KBS"**; as a client throwaway without the role, 403; with no session, 401.

### I21 - an exam is answered only on the questions it served - `PROUVE`

**Cost impact: none (the row: _"Cost: none"_).**

The row: _"60 correct answers on a 20-question exam graded 300%, a fail became a
certificate, then AGENT. Now the served questions are recorded at start and only
those answerable; score capped at 100; late submit refused. Red first on the
exploit. Pending: merge via gate."_

The commit is `70d79e1 fix(kbs): an exam is answered only on the questions it
served (i21) (#143)` (15 September).

CLAUDE.md, "An exam records which questions it served, not how many", gives the
proof: in `exam-integrity.dbspec.ts`, against the real kbs migrations, the
exploit gave `{ refused: 0, score: 300 }` before and `{ refused: 40, score: 100 }`
after. There is one empty `KbsExamAnswer` slot per served question. Past the
deadline plus 30 s the exam is closed on what was saved in time. The wave note,
"Step 1 - I38", under "Changed", cites I21 as the reason display paths allow an
absent settings row.

**Row corrected, 26 September:** it named the merge as the only pending step;
the commit above is on develop. No source quotes a reading on dev, so the state
stays `EN COURS` rather than being moved without a proof.

**Proven on dev, 26 September:** in `kambriq_kbs`, 148 graded exams, **maximum score 100**, and **0** exams with more answer rows than `totalQuestions` - the exploit's two signatures (300 %, answers outside the served set) are absent. The journeys pass an exam on every develop run.

### I31 - exam and quiz thresholds - `PROUVE`

**Cost impact: none, "verified rather than assumed" (the row).**

The row: the exam threshold goes from 75 to 80 and module quizzes stay at 70
(Visquis, 18 September). _"the certification document governs what is promised
to the candidate, the quizzes stay drilling"_. Four tests now pin the two
constants, and `scheduleExam` is pinned to write the exam constant onto the row.

Also from the row: _"`KbsExam.passingScore` is stamped per row at schedule time
and `gradeExam` judges that stored column, so no past verdict moves; dev holds
75 exam rows (74 PASSED, 1 FAILED), 0 SCHEDULED or IN_PROGRESS"_.
`prisma/kbs/schema.prisma` still defaults the column to 75, and this is _"left to
the KBS foundation subject"_. **Pending, per the row: "merge".**

`8f84b4f fix(journeys): wait for the throttle window on a 429, and the exam
passing score is 80 (#150)` is on develop (18 September). It touches
`libs/common/src/constants/kbs/index.ts` and adds
`kbs-passing-scores.spec.ts`. It also carries `A36`.

**Row corrected, 26 September:** it named the merge as the only pending step;
the commit above is on develop. No source quotes a reading on dev, so the state
stays `EN COURS` rather than being moved without a proof.

**Proven on dev, 26 September:** every one of the **73** exams created since the merge (18 September 06:05 UTC) carries `passingScore` 80.

### I7 - ADMIN_GLOBAL inherits STAFF_VERIFY - `PROUVE`

**Cost impact: none (the row: _"Cost: none"_).**

The row: _"VERIFY is operated by STAFF_VERIFY; ADMIN_GLOBAL now inherits it (one
level, listed on ADMIN_GLOBAL itself), pinned before any route uses it. Every
super admin therefore reaches identity documents and titles, and no record says
which one read what (ADR-008). Pending: merge."_

The commit is `d58a79a feat(roles): admin_global inherits staff_verify (i7)
(#137)` (15 September).

The `H1` entry says `STAFF_VERIFY` is _"in the enum, [has] no row in the
database, and [appears] in no decorator"_, and that _"the guard fails the day
one of them does"_.

**Row corrected, 26 September:** it named the merge as the only pending step;
the commit above is on develop. No source quotes a reading on dev, so the state
stays `EN COURS` rather than being moved without a proof.

**Closed, 26 September, on its test.** The merge was the only pending step. No route is gated by `STAFF_VERIFY` yet (`grep` over `apps/api/src`), so dev has nothing to show, and dev's `Role` table has no `STAFF_VERIFY` row at all (I19). The inheritance is pinned in `super-admin.spec.ts`.

### P4 - X-Robots-Tag outside production - `PROUVE`

**Cost impact: None for the second half (register section "P4, second half").
The first half names one: _"prd must set `APP_ENV=production` when it is first
built"_ (register section "P4 - `NODE_ENV` could not have answered this").**

The row: _"X-Robots-Tag noindex outside production, on the existing headers()
block. Reads APP_ENV: NODE_ENV is 'production' on every environment and cannot
tell them apart. Second half (API responses): PROUVE on dev 23/09; P4 stays below
100 % until D13"_.

The first half shipped inside the `P3` entry, sections "P4 - `NODE_ENV` could not
have answered this, and that was the trap" and "Follow-ups". `docker/Dockerfile.web`
sets `NODE_ENV=production` for every environment. `APP_ENV` is introduced, and
absent means noindex. The P3 commit is `6358f71 feat(p3): scope the auth
middleware, serve a real 404, keep dev unindexable`. The P3 "Gate - LOCAL ONLY"
section says _"No CI run has confirmed any of it"_. CLAUDE.md "`NODE_ENV` cannot
tell dev from prd in this repository" records the rule.

The second half is `f0e8819 P4 - the API sends X-Robots-Tag from the same
APP_ENV decision as the web (#165)`. Both the register section "P4, second half"
and the wave note section "P4 - proven on dev" quote dev at `sha-f0e8819`, 23
September 19:38 UTC: `noindex, nofollow` on `/api/v1/health/version` (200),
`/api/v1/kamnet/public/agents` (200), `/api/v1/no-such-route` (404) and
`/api/v1/users/me` (401). The same table has `/` and `/legal/privacy` as
_"(unchanged)"_. **Moved to `PROUVE` on 26 September**, read on dev at `sha-8637543`'s
predecessors (web `sha-e1b965f`): `X-Robots-Tag: noindex, nofollow` on `/`,
`/fr`, `/fr/legal/privacy` and `/api/v1/health`, and `robots.txt` answers
`Disallow: /`. Both halves are now observed on a deployed build; the row had
kept `PROUVE LOCALEMENT` after the second half was proven.

The part still open is D13 (access authentication). Dev _"answers 200 to
anonymous callers"_ (both sections). The ADR-005 follow-up: _"prd must set
`APP_ENV=production` on **both**"_.

### Q1 - the certification follow-up - `A DECIDER`

**Cost impact: not recorded in the sources.**

This is the row `` `Q1` follow-up ``: _"`generateKcaNumber` says \_sequential per
day_ and emits a random suffix; `CANDIDATE_KBS` is granted self-service and
gates nothing"\_. The row does not say what arbitration is missing.

The second half is in the register section "Role-grant inventory - read-only,
folded into V1", under "Three things the sweep turned up anyway", item 2.
_"`POST /kbs/enroll` grants it to the caller with no human in the loop. There is
no `@Roles(RoleCode.CANDIDATE_KBS)` anywhere in the codebase ... Harmless today,
and worth knowing before somebody gates something on it."_ The wave note,
"P11 - the public directory of certified agents", has an item on the number
format: KCA numbers are _"`KCA-YYYYMMDD-XXXX`, a date and four hex characters,
65,536 per issue date"_. No source was found for the "sequential per day" half
beyond the row.

The parent is the delivery-week `Q1` in `## Proven`: _"`CERTIFIED` was set by
grading, on the score alone"_. The fix was `4be405b fix(kbs): passing an exam
earns exam_passed, issuing a certificate confers certified (#54)`, and it was
proven on dev per `5390c8a docs(register): q1 proven on dev ... (#55)`.

### verify-cert - the public verdict page - `EN COURS`

**Cost impact: none (the row: _"Cost: none"_).**

The row: _"`/verify-certificate` said "valide" for any number; the API ignored
`revokedAt` and handed strangers the holder's UUID."_ **Pending, per the row:
"proof on dev: seeded number valid, fake number non reconnu, revoked number
révoqué".**

The commit is `c7b297c fix(kbs): verify-certificate reads the register instead
of a mock (#125)` (15 September). It adds `apps/web/src/lib/certificate-verdict.ts`
and `page-through-the-bff.spec.tsx`. CLAUDE.md, "A public verdict says yes only
on an explicit, complete yes", records the rule. A positive verdict needs an
explicit, complete yes from the source, and _"cannot verify" is its own
answer_. It was proved by mutation at three layers.

Two related facts are recorded elsewhere. The wave note section "The second
addition: the verifier is throttled now" puts `@Throttle({ default: { limit: 30,
ttl: 60_000 } })` on `GET /kbs/public/verify/:kcaNumber`. The `I43 follow-up -
the public certificate verdict reads in the visitor's language` entry
(`PROUVE`) quotes dev at `sha-06cf797` on 26 September: a real number reads
"Valid certificate" and `KCA-00000000-FAKE` reads "Certificate not recognised".
That covers two of the three pending cases. No source quotes a revoked number
read on dev.

**26 September - the revoked-number proof is not taken, and why.** No
certificate on dev has ever been revoked: all 145 read through the admin API
carry `revokedAt: null`. The proof therefore needs a revocation first, on a
delivery-journey throwaway (`j3.kbs.…@maildrop.cc`, never a person). That write
was refused by the session's permission layer as a change to a shared resource,
and was not worked around. **Pending:** Visquis's go-ahead for the revocation of
one throwaway certificate (or his own revocation of one), then
`/en/verify-certificate/<that number>` read on dev.

### naming - which ID series keeps the bare letter - `A DECIDER`

**Cost impact: not recorded in the sources.**

The decision, from the row: _"the brief's `L1`/`L2` collide with this register's
logging `L2`/`L3`. Entries above are `L1-contact`/`L2-contact`; somebody should
decide which series keeps the bare letter"_. The row names nobody. Under the
States table, `A DECIDER` means _"Stop and report. Do not choose."_

The register's `## Proven` section says a wider collision is already live:
_"Eleven ids mean two different things depending on which half of the document
you are reading"_. It chose not to rename, and it states the ambiguity instead.

### register - rows with no entry - `A FAIRE`

**Cost impact: None.**

The row asked for an entry for every open chantier whose detail lived in the
tracker or in a wave note; `register-is-the-record.spec.ts` pins the ones still
missing in `NO_ENTRY_YET`. **On 26 September twenty-one were written**, from
the row, the frozen wave note (`docs/ops/waves/2026-09-20-wave.md`), CLAUDE.md
and the commits on develop - facts with their source named, nothing inferred.

**One remains: `P10`**, whose entry is written in #174, which Visquis holds open
for the LANDS page copy. Writing it here as well would put two `### P10`
headings in the file the day #174 merges. The inventory goes to zero with
#174.

### rename - L1-contact and L2-contact to P1 and P2 - `A DECIDER`

**Cost impact: not recorded in the sources.**

The decision, from the row: _"`L1-contact`/`L2-contact` -> `P1`/`P2` was asked
for in P3's brief; those ids exist only on PR #98's branch, which the same brief
puts out of scope. Not done - see PR"_. The row names nobody.

The `P3` entry, under "Follow-ups", repeats it: the IDs exist only on
`feat/l1-contact-lead-pipeline` (PR #98, 8 occurrences), and the rename is
_"Named rather than resolved; see the PR body for the command"_. The register's
`## Proven` section calls `rename` _"the related open decision"_ to the id
collision. See contradiction 5: those IDs are now on develop.

---

## Proven

**Two id namespaces meet in this file, and they collide.** The table below uses
the delivery-week series - `B1`, `P2`, `P3`, `R1`, `A1`, `A3`, `L1`, `Q1`, `V1`
and the rest - while the entries above use Visquis's tracker series, where `P2`
is the newsletter form, `P3` is the auth middleware, `R1` is a merge that had no
effect and `B1` is the payment-code audit. **Eleven ids mean two different things
depending on which half of the document you are reading**: `A1`, `A2`, `A3`,
`B1`, `B3`, `L1`, `P2`, `P3`, `Q1`, `R1` and `V1`.

Nothing is renamed, because the delivery-week ids are quoted in commit messages,
pull request bodies and `CLAUDE.md`, and rewriting them would break every
citation to buy tidiness. What is fixed is that the ambiguity is now **stated
where it bites** rather than discovered: an id in the table below is a
delivery-week chantier, an id in an entry above is a tracker chantier. The
`rename` row in `## Open` is the related open decision.

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

**Row corrected, 26 September:** the ids `L1-contact` and `L2-contact` reached
develop with PR #98; the row no longer says they exist only on its branch. The
decision itself - whether to rename them - is still Visquis's.

### Wave 7 - CMS - `EN COURS`

**Cost impact: None.** Sanity Free covers this project - 20 seats, 2 datasets,
10k documents, 1m CDN requests against roughly 20 documents. Growth is $15 per
seat per month and buys nothing needed here. Hosted Studio is included.

**Steps 0 to 3 are written and proved locally. Nothing is deployed. Step 4, the
blog, is deferred by decision of 2026-09-27 - the entry is at the end of this
section.**

**What step 0 closes.** `ContactRequest.consentPolicyPath` records what was
consented to as `/legal/privacy`. L1's own migration says, at that column,
_"consent is to a document and documents change; a row that records agreement
without naming what was agreed to says nothing"_ - and then stores a path, which
names the document and not the version. The comment states the requirement
correctly and the value meets half of it.

`PolicySnapshot` in **core** - the API owns Prisma and the web is a BFF with no
client, so there was no other place it could live. Columns
`{documentId, revision, locale, slug, rendered, publishedAt, archivedAt}`,
unique on `(documentId, revision)` because a webhook can be delivered twice,
indexed on `(slug, locale, publishedAt)` because "which version was current
then" is the question consent depends on.

**The bytes are stored, not referenced.** Sanity keeps **3 days** of revision
history on the Free plan - read from its pricing page on 25 September, after a
search summary claimed the plans had changed to 30/90 days and the source said
they had not. A stored `_rev` therefore stops resolving long before anybody asks
what a policy said, and a consent record has to answer in ten years. `rendered`
is HTML from `@portabletext/to-html`, which emits a string with no React
dependency: an archive that must outlive our component tree cannot be rendered
through it.

**Append-only by the database**, `kambriq_append_only()` exactly as G1 wrote it
for the payment ledger; core and lands are separate databases so each carries
its own copy of the function.

**Proved by removal, which is the only proof that counts here.** A scratch
migration dropped the trigger and both refusals were watched failing:

```
● refuses an UPDATE with restrict_violation, and the row is untouched
    Received has value: null
● refuses a DELETE with restrict_violation, and the row is still there
    Received has value: null
```

Two failures, nothing else moved, scratch deleted, `pnpm test:db:reset`: 129
passing across 15 suites.

**`frame-ancestors` is now read from a validated variable.**
`SANITY_STUDIO_ORIGIN` unset gives `'none'`; a literal origin gives exactly that
origin; a wildcard **fails the build**, naming the variable. Proved in all three
states over HTTP and at the build. The reason is in CLAUDE.md.

**Said rather than left to be found: nothing writes to `PolicySnapshot` yet.**
Its writer is step 1's webhook and its reader is the contact form in step 3. By
this repository's own rule a method with no caller is not a feature, so the
table is a guarantee in place before the thing that needs it, and the gap is
here rather than implied.

**Decisions taken during the research, both reversing an earlier recommendation
of mine.** The Studio is **hosted** (`npx sanity deploy`), not embedded: Sanity's
deployment guide presents hosting as the default and warns that embedded studios
_"slow builds, tie every Studio update to an app deploy, and rule out
auto-updates and TypeGen watch mode"_. It also removes three problems - no
`/studio` route outside `[locale]`, nothing to classify in the proxy partition,
and no Studio CSP. Delivery is `defineLive` on **`next-sanity@13.3.4`**: v12 on
Next 16, which is this repository's exact combination, produced _"an average 4x
increase in request load"_ from a prefetch and `revalidateTag` cascade, fixed in
v13.

**Known and not yet needed:** Sanity's Presentation tool frames the site from
the Studio origin, so enabling visual editing later is a `frame-ancestors`
decision rather than a Studio setting. `<SanityLive>` subscribes from the
**browser**, so `connect-src` will need Sanity when step 2 lands, and
`cdn.sanity.io` goes through `image-hosts.ts` rather than into `next.config.ts`.

#### Step 1 - the publish webhook, `POST /cms/webhooks/sanity`

`PolicySnapshot` now has its writer. `@Public()` removes the JWT requirement and
`SanityWebhookGuard` is what authenticates the caller: an HMAC-SHA256 signature
over the raw request body, verified through `@sanity/webhook` 4.0.4. Throttled at
30/minute and listed in `route-guards.spec.ts` with its reason. 1033 API tests,
131 database tests, both typechecks, lint and prettier green.

**Four properties read out of the shipped packages rather than from their docs,
each of which changed a decision.**

- **`sanity-webhook-signature`**, not `X-Sanity-Signature`. A search summary gave
  the second; `SIGNATURE_HEADER_NAME` in the installed package gives the first,
  and only the package runs. The redaction path and the spec both take the
  constant rather than the string.
- **Nothing checks the signature timestamp's age.** `MINIMUM_TIMESTAMP` is a
  floor at 2021-01-01 and there is no freshness window, so a captured delivery
  replays forever. No freshness check was added: the unique index on
  `(documentId, revision)` already makes a replay a no-op, and a clock-skew
  failure mode would buy nothing. Written at the guard so nobody adds one
  thinking it was forgotten.
- **The final comparison is `signature !== encoded`, not constant-time.** Stated
  rather than papered over. Reimplementing the scheme to add `timingSafeEqual`
  would be a second implementation of somebody else's parser, which this
  repository has already paid for once.
- **`assertValidRequest` throws a plain `Error`** - not a signature error - when
  the body is not a string or Buffer, so `isValidRequest` rethrows it and the
  route would answer 500 where it means 401. The guard therefore calls
  `isValidSignature` with the buffer itself and handles the absent-header and
  absent-`rawBody` cases explicitly.

**`rawBody: true` at `NestFactory.create`**, pinned by
`api-captures-raw-body.spec.ts` and watched failing: 1 of 3 assertions, alone.
It installs a `verify` hook that keeps a reference to the buffer body-parser had
already allocated, so it costs no extra memory - checked in
`get-body-parser-options.util.js` rather than assumed. The guard refuses when
`rawBody` is absent rather than falling back to the parsed body, because the hash
is over bytes that `JSON.stringify` does not reproduce.

**The renderer refuses what it cannot reproduce, and that is the substance of the
step.** `@portabletext/to-html` does not fail on an unknown node: an unknown block
type renders as `<div style="display:none">` and an unknown block style flattens
to `<p>`. Both produce HTML that looks complete and is not, which for an archive
of what somebody agreed to is the one outcome that must never happen.
`onMissingComponent` throws instead. The library's default is asserted in the
suite, so the justification is measured rather than claimed:

```
it('would otherwise have hidden the content instead of failing')
  expect(html).toContain('display:none')      <- the library's own behaviour
```

**The duplicate reading was wrong, and the database is what said so.** The
service first read `meta.target` to decide which index refused. Prisma 7 with the
pg adapter **does not set `meta.target` at all**; it reports the columns at
`meta.driverAdapterError.cause.constraint.fields`, as `['"documentId"',
'revision']` - the first quoted. The unit spec, which built the error by hand,
passed throughout. The db-backed test failed with `Received promise rejected
instead of resolved`, which is how the shape was found. The service now confirms
by reading the row back, so nothing is coupled to a driver's error internals, and
a P2002 with no such row is rethrown.

**One defect of my own, in step 0's spec, visible only on a second run.**
`archives one row per revision` used fixed identifiers, so the row from the
previous run was already there and the test's own setup write was the one
refused. It passed on the first run and failed on every later one. Corrected to
mint per-run identifiers; `pnpm test:db` now runs twice consecutively with no
reset, 131 passing both times.

**The signature header is redacted from the request log**, in the same change
that introduced it, and the assertion was watched failing alone. It is not the
secret; it is credential material twice over - an HMAC beside a payload that is
published content is material for an offline attack on the secret, and a
signature that never expires is a replayable credential.

**Two configs carry the ESM transform, and narrowing one is a check that stops
running.** `@portabletext/*` is ESM-only and Jest's CJS runtime does not use
Node's `require(esm)`, so `jest.config.cts` and `jest.database.config.cts` both
need `node_modules/(?!.*@portabletext)`. Both directions proved: without it the
suite reports `Tests: 0 total` beside a red suite, with it 18 passed. The
container runs Node 24.13.1 and `engines` requires >=24, so `require(esm)` is
available where it ships - checked in `docker/Dockerfile.api`, not assumed.

**Pending proof, named:** no delivery from Sanity has ever reached this route.
The project exists now (`pzk85ktc`, sixteen documents, read anonymously on
2026-09-26) and the route does not: `POST /api/v1/cms/webhooks/sanity` answers
**404 on dev**, because `84bcbe5` is not on develop. So the route is still
exercised only by its own tests and by a database. `SANITY_WEBHOOK_SECRET` is in
`.env.example` and in no environment. The proof this step is waiting for is one
signed delivery archiving one row on dev, and it is now waiting on a deploy
rather than on a project.

**Still true, and now one step closer:** `ContactRequest.consentPolicyPath` still
stores a path. The archive can answer "which version was current then" and
nothing asks it yet. That is step 3.

#### Step 2 - the Studio, the contract and the hosts

**Cost impact: None.** Sanity Free covers the project, the hosted Studio is
included, and nothing here adds a resource. It also takes care not to add CI
cost - see the workspace decision below.

**The Studio is a separate project, deliberately.** `studio/` has its own
`package.json` and its own lockfile, is not listed in `pnpm-workspace.yaml`, and
is named in a new `.nxignore`. `sanity` and its dependencies are several hundred
megabytes; a workspace package is installed by every job that installs, which
here is every quality run, both image builds and the journeys. Measured rather
than assumed: with `.nxignore` removed, `nx show projects` answers with a seventh
project, `kambriq-studio`; with it, six. The price is one extra install,
`pnpm install --ignore-workspace`, and it is written at the top of
`studio/README.md`.

**Eight documents, opened by id, with no create button.** `legalPolicy` is four
policies in two languages; the structure lists each by
`legalPolicy.<slug>.<language>` and `newDocumentOptions` removes the type from
the global create menu. A collection would let an editor make a second French
privacy policy, and the archive would then hold two rows claiming to be the
current version with nothing to say which a consent record meant. `slug` and
`language` are read-only and set by the template the structure item carries, so
they cannot disagree with the id.

**The Studio was built, not just written.** `npx sanity build` against a
placeholder project id, and the bundle carries `legalPolicy` and `legal-privacy`.
It also corrected the configuration: `autoUpdates` at the top level of
`sanity.cli.ts` is deprecated in favour of `deployment: {autoUpdates: true}`, and
the CLI says so.

**The contract has one home.** `libs/common/src/cms/legal-policy.ts` holds the
document type, the languages, the slugs, the GROQ filter and the GROQ
projection. `policy-publish.dto.ts` is built from it, and the Studio - which
cannot import it - carries copies that are pinned:

- `policy-projection.spec.ts` evaluates the filter and the projection with
  `groq-js`, the same GROQ implementation the Studio ships, over a document
  shaped as the schema defines one, and hands the result to the DTO. Five of its
  tests are the projection with one field removed, each required to be refused.
  Mutated by dropping the `"locale": language` rename: three tests fail, one
  reading `Expected: "fr", Received: undefined`.
- `studio-schema-matches-the-contract.spec.ts` reads the Studio file as text -
  importing it would pull in `sanity` - and checks it against the contract. It
  takes the field names from the parsed GROQ rather than listing them a third
  time. Mutated twice, each alone: renaming `language` to `locale` fails
  `carries every field the projection reads`; dropping `legal-rgpd` fails
  `offers the same policies as the contract`.

**The webhook is created by a script, not by hand.**
`scripts/sanity/upsert-policy-webhook.ts` reconciles it through Sanity's
Management API from the values above, and `--check` reads back what is
configured. Sanity's dashboard is the other option and it is the shape this
repository already has an entry about: configuration that exists on one project
and nowhere in the repository. The endpoint was confirmed against the live
service rather than from the documentation alone - a run with a fake token
answers
`GET https://<id>.api.sanity.io/v2025-02-19/hooks/projects/<id> answered 401`,
which is the URL, the version and the auth mechanism proved in one line.

**`cdn.sanity.io` is one hostname for every Sanity customer.** It is literal, so
it passes A40's rule by the letter and breaks it in substance: anybody can create
a project on it and choose the bytes our optimizer hands to sharp. The allowlist
entry therefore carries a path, `/images/<projectId>/`, and `image-hosts.ts` now
holds sources rather than bare hostnames so the CSP `img-src` and the optimizer
take the same value. Proved through Next's own matcher: our project's image with
its transform query accepted, another customer's project, the same host outside
`/images/`, and the bare host all refused - and all four refused when the
variable is missing.

**Two build-time variables were wired to nothing, and this is how they surfaced.**
`build-vars-reach-the-image.spec.ts` pins every variable the web build reads
against `docker/Dockerfile.web`, `ci.yml` and `manual-deploy-dev.yml`, in both
directions. Writing it found:

- **`NEXT_PUBLIC_MAPBOX_TOKEN` was declared as an `ARG` and passed by neither
  workflow.** Every deployed image has run the map widget with an empty token.
  The line is now in both workflows; the GitHub variable still has to be set,
  which is an action, not a deploy.
- **`SANITY_STUDIO_ORIGIN` was read by `next.config.ts` with no `ARG` at all** -
  step 0's own gap, one step old. It could never have reached a build.

Both were invisible for the same reason: every one of these variables is designed
to fail closed, so the symptom is a feature quietly off rather than a red build.

**Not in this step, and why.** `next-sanity`, `defineLive` and the pages are step
3, with their first caller: a client nothing calls is the shape this repository
has an entry about. The host guard is the exception and it is the other entry -
a guard is cheapest to write while nothing depends on the hole it closes.
`NEXT_PUBLIC_SANITY_DATASET` is not wired either, for the same reason: nothing
reads it yet.

**Pending proof, named, and it is the same one step 1 is waiting for.** The
project and the documents exist; nothing is deployed, no webhook exists, and no
delivery has ever reached the route. Done on 2026-09-26: steps 1, 2 and the
import. What remains is somebody's action on their own account, in this order:

1. ~~`cd studio && pnpm install --ignore-workspace && npx sanity login`, then
   `npx sanity projects create kambriq`~~ done - `pzk85ktc`. **Not
   `sanity init`**, which scaffolds a second studio into `studio/kambriq/` and
   deploys an empty schema over this one; the README says so and this list said
   otherwise, which is the contradiction a record exists to not have.
2. ~~project id in `studio/.env`~~ done locally. Still to do: the GitHub
   variables `NEXT_PUBLIC_SANITY_PROJECT_ID` and `NEXT_PUBLIC_SANITY_DATASET`,
   which are **build** arguments - `output: 'standalone'` freezes `images` and
   `headers()` at `next build`, so a value only in the task definition changes
   nothing
3. `pnpm run deploy` from `studio/`, then set `SANITY_STUDIO_ORIGIN` only if
   Presentation is wanted
4. put `SANITY_WEBHOOK_SECRET` in SSM and in the API task definition, then run
   the upsert script with `KAMBRIQ_API_URL=https://dev.kambriq.com` - the site's
   own host, since the API is served from it under `/api/v1`
5. publish one policy, and read one row in `PolicySnapshot`

#### Step 3 - delivery, the content migration, and consent bound to a version

**Cost impact: None.** Two packages added to the root install, measured below.
Sanity Free still covers 16 documents and the queries the pages make.

**`next-sanity` was refused on a measurement, reversing step 0's choice.**
`defineLive` on `next-sanity@13.3.4` was decided during step 0's research. It
declares `sanity` as a **non-optional peer**, and pnpm installs peers, so adding
it takes the whole Studio into the root install that every quality job, both
image builds and the journeys pay for. Resolved with `--lockfile-only`, same
three direct dependencies each time:

| install                                    | lockfile entries | `sanity` pulled in                                                           |
| ------------------------------------------ | ---------------- | ---------------------------------------------------------------------------- |
| `next` + `react` + `react-dom`             | 108              | -                                                                            |
| `+ @sanity/client` + `@portabletext/react` | 128              | no                                                                           |
| `+ next-sanity@13.3.4`                     | **1846**         | **yes** - `sanity@6.16.0`, styled-components, vite 8, rolldown, typescript 7 |

`peerDependencyRules.ignoreMissing` and `packageExtensions` both left it at 1846
unchanged. Only `autoInstallPeers: false` in `pnpm-workspace.yaml` removes it
(304), and that changes resolution for every package in the repository. So
delivery is `@sanity/client` directly: **8 packages added**, measured against the
lockfile before and after.

What that costs is `<SanityLive>` and the Presentation tool, neither of which is
in use. **The `connect-src` entry step 2 added is therefore removed**, with the
reason written at the directive: documents are fetched by the Next server, so
nothing in the browser talks to Sanity, and a source listed for a connection
nothing makes is a permission granted for nothing. `sanity-hosts.spec.ts` fails
if a browser subscription returns without it.

**Sixteen documents, converted rather than retyped.** The converter parsed with
`mdast-util-from-markdown` - a hand-written markdown reader would be a second
implementation of somebody else's parser - and mapped mdast to Portable Text. It
**refused** a node it could not map, because a converter that drops one produces
a document that looks complete. `scripts/sanity/content/initial-content.ndjson`
is committed and is loaded once with `sanity dataset import`.

Three transforms are deliberate and each was checked rather than assumed:

- **the `# Title` line became the `title` field**, so the page renders one
  heading rather than printing the body's first line under it;
- **the "Dernière mise à jour" line became `publishedAt`**. The line and the
  field are the same fact, and the migration refuses if they disagree;
- **the three label sections became one `labelDefinitions` block**, and the
  converter refuses unless `KBS_LABEL_DEFINITIONS` reproduces the markdown
  **character for character, in both languages**. That check is what made it safe
  to delete the mdx.

**Proved by reading the bytes back, not by asserting them.** With the markdown
restored from `HEAD` for the check: `--check` reported _the committed import file
matches the sources_, and a sweep of **180 fragments** of the sources against the
converted documents found **0 missing**. The markdown was then deleted again.

**The converter was then deleted with it, and that is the decision rather than
an oversight.** Its only caller was the build script, which reads the mdx paths
from a manifest; with the markdown gone that script refuses by design, so the
converter's only remaining exercise was its own seventeen tests. A method with no
caller is not a feature. Removed: the converter, the build script, the manifest,
the spec, and the two `mdast` devDependencies - no install saving, because
`react-markdown` is a production dependency for KBS lessons and pulls the same
chain. **What it costs, stated rather than assumed:** the ndjson can no longer be
re-derived from the markdown and compared byte for byte, so
`initial-content.spec.ts` is its only remaining guard and the proof above is the
record of the one time the derivation was checked. Neither script was ever
committed, so a later markdown loader - the blog, if step 4 takes drafts as
markdown - starts from `mdast-util-from-markdown` again rather than from them.

**Two defects the converter found in itself.** A GFM pipe table is not seen by
the CommonMark core at all - it returns paragraphs whose text contains pipes - so
that was the one input it would have silently mangled; it is now refused by
shape. And an html table (the VERIFY price list, which no Portable Text node
covers) is transcribed in the manifest and every cell checked against the source
html, so a typo fails the migration instead of rewriting the page.

**The labels stopped being prose, which is what kept their guard.**
`kbs-label-definitions.spec.ts` read `methode/fr.mdx`, and a Sanity document
cannot be read by a test: CI has no token, and giving it one to guard three
sentences is a poor trade. So TFL, VEFL and VEFIL are **fields** in
`libs/common/src/kbs/label-definitions.ts` - four booleans each, plus the
description as runs so the bold on "PAS" and "NOT" survives - the `methode` page
renders them through a block carrying no text of its own, and the question bank
is pinned to the same constants. Mutated with the exact historical regression,
`VEFL.titleExists: false`: **1 failed, 16 passed**.

**The foreign key is proved by removal, which is the only proof that counts for
a database guarantee.** `policy-snapshot.dbspec.ts` gained three tests - an id no
snapshot carries is refused by name, an archived revision is accepted, and `null`
is accepted. With the constraint dropped in a scratch migration:

```
● a consent record cannot point at a version the archive does not hold
  › refuses an id no snapshot carries, by name
    Received has value: null
```

One assertion failing alone, scratch deleted, `pnpm test:db:reset`: **134 passing
across 15 suites** (was 131).

**A consent record now names the version.** `ContactRequest` gains
`consentPolicySnapshotId`, a foreign key to `PolicySnapshot`, resolved
**server-side** at write time from the newest archived revision of
`legal-privacy` in the page's language. Not taken from the request: a version
supplied by a browser is a claim about what somebody was shown. `consentPolicyPath`
stays, because it is what every existing row carries and it is still true.

Null is not a silence. Nothing archived means nobody has published a policy yet;
the request is still stored, because the lead is the success criterion (L1), the
resolver logs at `error`, and **the daily digest carries the count - printed even
when it is zero**, because a row that only appears when something is wrong cannot
be told apart from a row nobody deployed.

**What an editor is offered is narrower than Sanity's defaults, and that is the
guard.** Measured: `@portabletext/react` merges its own components under ours, so
an `h5` resolves to the library's unstyled heading and **never reaches
`onMissingComponent`**. Nothing at render time can refuse it, so the style is not
offered - `studio/schemaTypes/richText.ts` declares the five styles, three marks
and two list kinds the site renders, pinned to the contract in both directions.
No `h1`: the policy title is a field and the editorial heading comes from the
translation files, so an `h1` in a body would be a second top-level heading.

For a block TYPE the renderer does refuse, and the spec measures the alternative:
with the library's own handling the same document renders `Unknown block type`
and no error.

**`NEXT_PUBLIC_SANITY_DATASET` is wired now that something reads it** - `ARG`,
both workflows, `.env.example` and `build-vars-reach-the-image.spec.ts`.

**Its validation was in the wrong place first, and reading the built manifests is
what showed it.** The dataset was read only by `lib/cms/client.ts`, at runtime, so
"a project with no dataset fails the build" - which the Dockerfile comment, the
README and a draft of this entry all claimed - was false: it would have been a
500 on the first page somebody opened. It now lives beside the project id in
`lib/security/sanity-hosts.ts` and `next.config.ts` calls it, so the claim is
true. **The same sentence was in three files before anything checked it.**

Proved in all three states against the built manifests rather than by reading the
config:

- **neither variable**: `img-src` carries no Sanity source, `remotePatterns` is
  `["images.unsplash.com"]`, and `connect-src` names no Sanity host;
- **both**: `img-src ... https://cdn.sanity.io/images/7k3m2q1p/` and
  `remotePatterns` gains `cdn.sanity.io/images/7k3m2q1p/**` -
  **`connect-src` unchanged**, which is the delivery decision visible in the
  output;
- **project, no dataset**: the build exits **1** with
  `NEXT_PUBLIC_SANITY_DATASET is required when NEXT_PUBLIC_SANITY_PROJECT_ID is set`.

**Seven mutations, each watched failing alone, each restored:**

| mutation                                             | result                |
| ---------------------------------------------------- | --------------------- |
| a real `import ... from 'next-sanity'` in the client | `1 failed, 12 passed` |
| `h3` removed from the Studio's offered styles        | `1 failed, 17 passed` |
| a page slug with no document and no page             | `3 failed, 7 passed`  |
| `consentPolicySnapshotId` dropped from the row       | `3 failed, 18 passed` |
| the dataset defaults to `production`                 | `1 failed, 8 passed`  |
| the dataset line removed from `ci.yml`               | `1 failed, 21 passed` |
| `VEFL.titleExists: false`                            | `1 failed, 16 passed` |

The slug mutation was run **twice**: the first stopped the suite compiling, which
is a mutation that has not been run at all, and it was redone with a route so it
built.

**`sanity build` bundles a schema it has not validated.** The Studio's own
acceptance in step 2 was "it was built, not just written", and that standard was
not enough: `divider` was declared with `fields: []`, the build exited 0, the
bundle carried the type - and the first page load showed **Schema errors**,
_Object should have at least one field_. `sanity schema validate` is a separate
command and it named exactly that one error; with the field added it reports 0
errors and 0 warnings, so the gate was watched refusing and accepting in the
same sitting. It is now `pnpm validate` in `studio/package.json` and is named in
the README, because a command nobody runs is not a gate.

**Two things found by running rather than by reading.** `sanity build --y` is not
a valid flag: the Studio build exited 2 and printed usage, and the wrapper's exit
code was 0 because a later command in the pipeline succeeded. Re-run without it,
the bundle carries `contentPage`, `labelDefinitions`, `divider`, `tableRow` and
`legalPolicy`. And `@sanity/client` **strips the leading `v`** from `apiVersion`
and re-adds it when it builds the URL, so `config().apiVersion` reads
`2025-02-19`; the spec pins `cdnUrl` instead, which is what goes on the wire.

**The token sweep caught its own explanation for the fifth time.** The docstring
saying why `next-sanity` is not used was counted as a use of it. Matched by shape
now - an import opens its own line - and the sweep was proved to still fire.

**A dot in a document id makes it private, and that cost a full round trip.**
The id scheme written in step 2 was `legalPolicy.legal-privacy.fr`. On the first
real import it produced a site where **every CMS page answered 404** while
everything upstream looked right: 16 documents imported, the Studio listed them
with their content, `sanity documents query` returned them. In a **public**
dataset Sanity treats any `_id` containing a period as private - the same rule
that hides `drafts.*` - so the only caller without a token, which is the delivery
client, saw an empty dataset.

**Two wrong diagnoses before the right one, both from reading rather than
measuring.** First "the dataset is private" - `dataset visibility get` answers
`public`. Then "the documents are drafts" - `count(*[_id in path("drafts.**")])`
is 0 and 28 non-draft documents exist. The answer came from a **control**: a
dotless document written into the same dataset was readable anonymously in the
same second that a dotted one was not.

```
*[_id=="zzz-anon-probe"]      -> [{"_id":"zzz-anon-probe"}]
*[_id=="contentPage.about.fr"] -> []
```

Ids are now `legalPolicy-<slug>-<language>` and `contentPage-<slug>-<language>`,
in the contract, in both Studio copies and in the import file. Two tests hold it:
the ids the contract builds carry no dot, and no document in the import file
does. Mutated by restoring the dot: **5 failed**, including the dedicated one.

**The documents already imported under the old ids have to be deleted** - they
are unreachable by the structure and by delivery, and nothing about them looks
wrong in the Studio. The commands are in `studio/README.md`.

**Proved 2026-09-26: the pages are served from Sanity.** Taken against a
throwaway project, `pzk85ktc`, created on a developer account - see the decision
below, which supersedes it. **What it proves is the code path, not the content
any environment will hold.** The import ran there under the hyphen ids, and the
documents were read back the way the site reads them - anonymously, which is the only credential the delivery
client has. The query text and the four contract lists were taken out of
`libs/common/src/cms/delivery.ts` and `content-page.ts` rather than retyped, so
this is a check of what ships:

| read                                             | result                                                                                                                |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `DOCUMENT_BY_ID_QUERY` over all 16 ids, no token | 16 documents, 0 refusals, every one satisfying the zod contract in `documents.ts`                                     |
| dotted ids in the dataset                        | 0                                                                                                                     |
| block types in the live bodies                   | `block`, `divider`, `labelDefinitions`, `table` - all four in `CONTENT_BLOCK_TYPES`                                   |
| styles, marks, lists                             | `normal` `h2` `blockquote`; `strong`; `bullet` `number` - all in the contract, and no `h5`/`h6` in any rendered page  |
| 10 routes over HTTP on the dev server            | 10 x 200, each carrying its own first `h2` (`Editeur du site`, `1. Donnees collectees`, `Ce que nous verifions`, ...) |
| `/fr/methode`                                    | the three labels rendered from `label-definitions.ts`, 2 dividers, 1 blockquote, 32 list items, `PAS` in a `<strong>` |
| `/fr/products/verify`                            | the html table reproduced: 1 `thead`, 2 `th` (`Situation`, `Prix`), 4 `td`                                            |
| dev server log across 13 requests                | 0 `[cms]` contract errors, 0 missing-component warnings                                                               |

A count of `<th` came to three on a two-column table, because it also matched
`<thead>`. The renderer was right and the measurement was wrong, which is
[a sweep that counts a token counts it in prose too](../../CLAUDE.md) arriving in
a verification rather than in a guard. Recorded because the first reading looked
like a defect in the table block.

**Decided with the owner, 2026-09-27: the content is written, not imported.**
The project above belongs to a developer account and is abandoned. Visquis
creates the project inside the Kambriq organisation, and the sixteen documents
are written by hand in the Studio rather than loaded from
`initial-content.ndjson`. The file stays in the repository for local development
and `initial-content.spec.ts` keeps guarding it; no environment loads it.

**What that means for the deployed site, said rather than found later.** A new
project's dataset is empty, so the four legal pages and the four editorial pages
**answer 404 until somebody writes them**. That is the fail-closed default
working, not a fault. The cost of the choice is that the legal wording is retyped
rather than carried over from the markdown it was checked against character for
character.

**The archive fills itself, and needs no backfill.** The first time a policy is
published in the Studio, the webhook writes its row. Consent binds to
`legal-privacy` **per language**, so the two rows that matter are the French and
the English privacy policy; until each exists, a consent in that language records
no version, `currentPolicySnapshotId` logs at `error` and the daily digest counts
it. **Check both before the contact form is live in prd.**

**What remains, and who does it:**

1. Visquis: create the project in the Kambriq organisation, dataset `production`,
   **public** - the delivery client sends no token, and a private dataset makes
   every CMS page 404
2. GitHub repository **variables** `NEXT_PUBLIC_SANITY_PROJECT_ID` and
   `NEXT_PUBLIC_SANITY_DATASET`. They are build arguments frozen at `next build`,
   so they are set **before** the deploy or the image is rebuilt after. Setting
   the project without the dataset fails the build on purpose
3. `SANITY_STUDIO_PROJECT_ID` in `studio/.env`, then `pnpm run deploy` from
   `studio/` - `run` is required, `pnpm deploy` is a pnpm builtin
4. `SANITY_WEBHOOK_SECRET` into SSM and the API task definition, then
   `scripts/sanity/upsert-policy-webhook.ts` with a manage token
5. the sixteen documents written in the Studio
6. read one row in `PolicySnapshot`, then submit the contact form and read
   `consentPolicySnapshotId` on the row

**One measurement worth keeping about `_rev`.** All sixteen documents imported
into the throwaway project came back with the same revision: a dataset import is
one transaction and Sanity's `_rev` is the transaction id, not a hash of the
content. The archive keys on `(documentId, revision)`, so it is still one row per
document per revision. But `_rev` is not unique across documents, and anything
that ever treats it as an identifier on its own is wrong.

**Step 4, the blog, is deferred by decision of 2026-09-27.** It is not abandoned
and it is not pending work. The reason for recording it is that the blog is a
different kind of document from everything the Studio holds today, and the
obvious way to start it is wrong.

Every document type in the Studio today is a **singleton**. There is a fixed
number of documents, and the code knows all of them in advance:

- `POLICY_SLUGS` and `CONTENT_PAGE_SLUGS` are closed lists
- each document id is computed from its slug and language
- the create menu is empty, because `newDocumentOptions` removes both types
- delivery is `*[_id == $id][0]`, which fetches one document by id

A blog is a **collection**. An editor creates a post whenever they want, so the
id cannot be computed in advance and delivery has to search by slug instead of
fetching by id. Searching brings back the problem the id avoided: a query that
matches two documents returns the first one and reports nothing wrong. A blog
therefore needs two things the current pages do not: a rule that makes
`(slug, language)` unique, and a delivery path that refuses two matches instead
of picking one.

**So the blog is not a fifth entry in `CONTENT_PAGE_SLUGS`.** That is the first
thing a reader of this section would try, and it would not work.

Waiting costs nothing, because the route already exists and is honest. `/blog` is
in `PUBLIC_PATHS`, `/blog` and `/blog/:path*` are in the proxy matcher, and the
page renders a list of planned articles from the translation files, under a line
saying the articles are not published yet. **Cost impact: None.**

**Also not in this step:** a reconciliation between the Sanity `methode` document
and the label constants. Nothing in CI can read the dataset without a token, so
the labels are guarded in code and the page is not checked against them. Named
here rather than implied.

**Observed on dev, 27 September (twelfth round, not acted on).** Since #252 the
content pages answer 404 on dev - `/fr/about`, `/fr/methode`, `/fr/plan` and every
`/fr/legal/*`, the privacy policy included - as the decision above says they will
until the Studio content exists. The consequence not written above: **develop's
E2E run is red from #252 on** (`locale-routing` and `public-routes` assert those
pages), and the CI Gate, which reads the journeys only, lets merges through. The
owner's actions (project, build variables, Studio, webhook secret) close both.

### develop merged into waves 5-6 - `EN COURS`

**Cost impact: None.**

Nine commits, 74 files, 5508 insertions since the merge base. Eight text
conflicts, all resolved by reading rather than by side: develop's docstrings
were taken back on four files where wave 2's rewrite had removed the reason (see
CLAUDE.md), and our `///` Prisma doc comments were kept while develop's
`publicListingConsentAt` was added to the same schema.

**What git did not flag, and what found it.** Develop added six files at
`app/(app)/agent/profile/` and `app/products/kamnet/annuaire/` - paths wave 5
had emptied. They merged clean, and both route walkers were satisfied because a
page at the old path computes the same URL. `no-unlocalised-navigation.spec.ts`
gained a placement assertion, which then found three more components importing
`next/link` or `next/navigation`, and `lib/actions/kamnet.ts` calling
`revalidatePath` with unprefixed paths - the defect wave 5 closed, arriving
fresh.

**Two findings in the incoming code, reported rather than assumed.**

- `caller-identity.ts` fell back silently when a caller sent a secret that does
  not match. An absent secret warns at startup and is a stated choice; a wrong
  one is a misconfiguration that looks identical to working, and its cost is
  every visitor sharing the web task's bucket - the A2 defect, returning with
  nothing to show for it. `callerSecretMismatch` now reports it once per
  process. Four tests, one mutation watched failing alone.
- `image-hosts.spec.ts` ran **zero of its 25 tests** under jsdom
  (`TextDecoder is not defined` from `@aws-sdk/client-s3`). Red on develop, not
  caused by the merge - proved by reverting the web jest config to develop's own
  and watching the failure stand. `@jest-environment node` is the fix.

**The archive's freeze was falsified by the merge and is corrected in place.**
`WAVE_STATUS.md` was frozen on 24 September on this branch; develop had not seen
that commit and wrote another 550 lines into it. All six of those chantiers have
entries here.

**Second merge, 25 September (A47).** develop moved four commits while the pull
request was open, and A47 lands in exactly the files wave 5 rewrote. Four
conflicts, all folded rather than chosen:

- `auth.service.ts`: wave 1's `type` claim and A47's `jwtid` are different
  defects - one stops a refresh token being presented as an access token, the
  other stops two tokens issued in the same second being byte-identical and
  colliding on the unique index. Both kept.
- `proxy.ts`: takes `authForProxy`, A47's refreshing NextAuth instance. **A47's
  matcher additions are not carried over and do not need to be**:
  `/(fr|en)/:path*` already matches every URL the app links to, so the proxy
  runs on every public page, which is A47's actual requirement. A47 met it by
  listing each public page one at a time; locale routing meets it more
  completely.
- `proxy.spec.ts` and `middleware-matcher.spec.ts`: A47's property is kept -
  every public page runs through the proxy, in both locales, and none of them is
  gated for any kind of session. The assertion that pinned A47's _implementation_
  ("one by one, never a public prefix") is deliberately dropped, with the reason
  at the line: it pinned a list rather than a property, and the property it
  protected is asserted directly by the unknown-URL test and by the positive
  `isProtected()` gate.

**Checked before relying on it, not assumed:** NextAuth's wrapper builds
`new Response(response?.body, response)` and then **appends** the session's
`set-cookie` onto whatever the handler returned (`next-auth/lib/index.js`). So
returning next-intl's response from inside the wrapper keeps the refresh, and
wave 5 and A47 compose.

**Proof.** 1927 tests across the four projects (api 1002, web 573, common 342,
api-e2e 10), both typechecks, lint, prettier, `nx build web` with 0 error
lines. The full run needs `--maxWorkers=2`
on this machine: unbounded, four projects oversubscribe it and the KCA1 loader
and A45 suites time out at 5000 ms. Each passes in isolation, so the failures are
the machine and not the code - stated here because a timeout reads like a defect.

### Audit 2026-09-23, wave 5 - locale-prefixed routing - `EN COURS`

**`chore/audit-remediation`, not merged, not deployed.** Pending proof is the
routing table below, read against dev after the merge.

**Cost impact: None.** No resource, no build step. One extra redirect on a URL
typed without a locale, which is a 307 the app itself never emits: every link it
renders carries the prefix.

`i18n/request.ts` read a `NEXT_LOCALE` cookie, so one URL served two languages.
Googlebot sends no cookie, so **the English site was unreachable to a crawler**
and `hreflang` had no URLs to point at. Every page now lives under `[locale]`
with `localePrefix: 'always'`.

**The decision this turned on.** next-intl documents
`'/((?!api|trpc|_next|_vercel|.*\..*).*)'` for the proxy matcher - the exact
negative pattern `P3` deleted, and the defect it removed. Compiling candidates
through Next's own parser (`next/dist/lib/try-to-parse-path`, which
`getMiddlewareMatchers` calls) showed `/(fr|en)/admin/:path*` compiles and
discriminates - refusing `/de/admin`, `/administration` and `/fr/pricing` - so
the positive list survives the move and was kept.

**What moved with it.** The matcher has to see the public paths now, in order to
redirect an unprefixed URL to a locale. Being matched therefore no longer implies
being protected, so the gate is asked positively: `isProtected(pathname)` against
`PROTECTED_PREFIXES`, never `!isPublic`. Under the wider matcher, negation is
`P3` reintroduced - every typo becomes a members' area.

**Proved by execution, locally, before anything was claimed:**

```
/                        307  /fr
/about                   307  /fr/about
/fr/about                200
/en/about                200
/pricing                 404            <- not a redirect to login
/fr/pricing              404            <- not the home page under HTTP 200
/de/about                404
/fr/mylands              307  /fr/login?callbackUrl=%2Ffr%2Fmylands
/en/mylands              307  /en/login?callbackUrl=%2Fen%2Fmylands
/api/auth/csrf           200
```

`Link: <…/fr/about>; rel="alternate"; hreflang="fr", <…/en/about>; hreflang="en",
<…/about>; hreflang="x-default"`, `<html lang>` agreeing with the URL, and the
two locales serving different bytes at the same route.

**The audit's fifth security finding is closed here.** `app/layout.tsx` passed the
whole `auth()` result into `<Providers>`, which is a Client Component, so the API
bearer token was serialised into the RSC payload of every authenticated page.
`sessionForClient` strips it, `Session.accessToken` is now optional because it is
absent on the client in both directions, and `lib/session.spec.ts` pins the
function, the call site and the prop type. The delivered-HTML check is in the
login journey, which is the only one of the four that reads what a browser got.

**Two things the unit suites could not see, and the browser tests did.**
`/fr/zzz-does-not-exist` answered with Next's **built-in** 404 rather than the
page `P3` built with links back into the site: `not-found.tsx` is a boundary that
something has to trigger, and an unmatched URL under a matched dynamic segment
triggers nothing. `[locale]/[...rest]/page.tsx` calls `notFound()` and closes it.
And the language switcher is mounted per page on 8 of 15 public pages, which is
its own row above.

**The guards, each watched failing.** `no-unlocalised-navigation.spec.ts` bans a
hardcoded locale in an href **before** it bans the imports - the outcome first,
because this repository has an entry about a ban on formatters that stayed green
over a typed currency. `middleware-matcher.spec.ts` now asks Next's own
`unstable_doesMiddlewareMatch` instead of the hand-rolled regex model it carried,
which removes a second implementation of somebody else's parser; note that the
Next 16.3.6 documentation calls it `unstable_doesProxyMatch`, **a name that
appears nowhere in the shipped build**.

### I32 - the network depth is the API's rule, by the caller's tier - `PROUVE`

**Cost impact: None.**

**The finding, I18's shape.** `GET /kamnet/network` served whatever depth was
asked, up to `KAMNET_MAX_SPONSORSHIP_DEPTH`, and never read the caller's tier.
The tier rule (`DEPTH_FOR_TIER`) lived in `/agent/network`'s page. Anybody
calling the API directly got the platform maximum whatever their tier. P9 set
that maximum to 1 and every tier to 1, so the gap stopped being observable: a
narrowed blast radius, not a fix.

**Now:** the table is `KAMNET_NETWORK_DEPTH_BY_TIER` in `libs/common`, and
`getMyNetwork` serves `min(requested, table[tier], maximum)`. A tier the table
does not name reads one level. With no depth asked, the answer is the tier's
allowance; the query DTO no longer defaults the depth to 1 (which would have
hidden the allowance). The page asks without a depth and renders what comes
back; the web action keeps its harmless clamp when a depth is given. The admin
tree is unchanged.

**Proof, red first.** `network-tier.spec.ts` raises the maximum to 3 and gives
the tiers 1, 2 and 3, because with today's values the rule changes no answer.
Against develop, a JUNIOR asking for 3 levels got 3. Seven mutations, each
failing its own test: the tier ignored, an unknown tier widened to the maximum,
the request ignored, an absent depth read as 1, the DTO default of 1 restored,
the page choosing a depth again, and the action defaulting one.

**Not observable on dev**, and said rather than papered over: every tier and
the maximum are 1 there, so each agent's answer is what it was. The proof is
the test, with the maximum raised.

### A54 - the contact digest failed every morning without writing a line - `EN COURS`

**Cost impact: None.** A few log lines, on failure only.

**What failed was the silence, not the design.** Visquis decided on 26
September that the digest stays: no alert. The digest had never left dev,
because `CONTACT_INBOX_EMAIL` was unset, and **fourteen mornings in a row**
(12 to 25 September, 07:00:15 UTC each time, read from
`/health/queues/core/failed`) the job threw "CONTACT_INBOX_EMAIL is not set"
and BullMQ kept it as a failed job. BullMQ logs nothing when a job fails, and
no processor listened, so the dev log held nothing at all.

**A failed job writes an error line (extends A18).** A18 made queue state
readable on request, behind ADMIN_GLOBAL. This makes a failure announce itself.
`LoudWorkerHost` (`libs/common/src/queue/`) is the base class of all five
processors: its `@OnWorkerEvent('failed')` handler writes "Queue job failed" at
`error` with the queue, job name, id, attempt and error message. **The payload
is left out on purpose**: it can carry personal data, which is why A18's
payload route is ADMIN_GLOBAL.

**The API refuses to start without `CONTACT_INBOX_EMAIL`**, instead of failing
once a day at 07:00. It was `z.email().optional()`. An empty value was already
refused; only an absent one passed. `.env.example` now carries a reserved,
undeliverable address (`inbox@example.test`). Dev has had the variable since
infra #66. **prd will need it on its first deploy**, which belongs on ADR-005's
bootstrap list.

**Proof, red first:**

- `failed-jobs-are-logged.spec.ts` (the four API processors) and
  `email-processor-is-loud.spec.ts` (the one in `libs/common`) replay
  `BullExplorer`'s own discovery (`MetadataScanner.scanFromPrototype` and the
  bullmq metadata accessor) over the real processor classes. Against develop,
  none had a "failed" handler. There is no local Redis, so this is how the
  handler's registration is shown rather than asserted: it is the explorer's
  code path, run. A guard reads the source for every `@Processor(` class and
  requires `LoudWorkerHost`, so a sixth processor is covered the day it is
  written;
- `contact-inbox-required.spec.ts`: absent is refused, naming the variable.
  Against develop that test failed, and the empty case already passed (kept as
  a pin);
- mutations, each watched failing on the assertion meant: the handler removed
  (every processor fails), `warn` instead of `error` (the call count), the
  payload added (the exact fields), the message dropped (the fields), a second
  line (the call count), the message text changed (the message), and a
  processor back on `WorkerHost` (its discovery, and the guard). A separate "no
  payload" assertion was removed, because the exact fields and the single call
  already refuse it and it could never fail alone.

**The sixteen dead jobs: read, recorded, then cleared (Visquis, 26
September: clear them all, after reading the two nobody had explained).**
Fourteen are the digest (above). The other two, read in full through
`/health/queues/core/failed` on 26 September before anything was deleted:

| Job                           | Repeat slot (UTC)   | Scheduled at             | Failed at                | Attempts |
| ----------------------------- | ------------------- | ------------------------ | ------------------------ | -------- |
| `core.cleanup-expired-tokens` | 2026-02-26 03:00:00 | 2026-02-25 18:44:37.653Z | 2026-02-26 03:00:15.442Z | 3        |
| `core.purge-deleted-users`    | 2026-02-26 04:00:00 | 2026-02-25 18:44:37.751Z | 2026-02-26 04:00:15.242Z | 3        |

Both failed at the first Prisma call (`refreshToken.deleteMany`,
`user.deleteMany`) with **"User was denied access on the database
`kambriq_core`"** - Prisma's refusal when the connecting role may not use that
database - with empty payloads. The trace shows the purge as a single
`deleteMany`, the code before the S3-aware purge: the original build.

**What they were, as far as the evidence reaches.** The API first started on
25 February at 18:44 and scheduled both crons; at their first slot, that night,
its database role could not use `kambriq_core`; and **neither job has failed
since**: no later failure of either name is in the failed set, which keeps up
to 200. That is a one-night condition on
dev's first night - the register's `B3` places the seed's single run on 26
February, the same day. **What cannot be shown any more, and is not claimed:**
why the role was refused. CloudWatch keeps seven days, and the databases were
dropped and rebuilt for `S2` (`kambriq_core`'s first migration now reads 4
September 2026), so nothing from February remains outside these two Redis
entries. The cause is inferred, not proven: the role or its grants were not in
place yet when the API began scheduling.

**Cleared, 26 September, shortly before 12:29 UTC**, from inside the running API task (ECS
exec, BullMQ `Queue('core').clean(0, 1000, 'failed')`): the failed set held
exactly the sixteen read above (fourteen `core.contact-digest`, one of each
February job); `removed 16`; the failed count then read **0**, confirmed
through `/health/queues` (`core: 0`). A full copy of the sixteen as read was
kept outside the repository before the deletion.

**Not touched:** the one failed job on `kamnet`, `kamnet.definitely-unknown-job`
of 4 September (payload `{probe}`) - a deliberate probe of the kind S9 and A18
used to show an unknown job lands on the failed set. It is not one of the
sixteen, so it stays.

**Proven on dev, 26 September:** the API at `sha-603e6ab` (read from
`/api/v1/health/version`) logged "Nest application successfully started" at
10:36:48 UTC with no configuration error, so the variable now required is
present where it runs.

**Pending:** the first real failed job seen as a line in the dev log. That needs
a failure, and none will be manufactured on dev.

### I43 follow-up - the public certificate verdict reads in the visitor's language - `PROUVE`

**Cost impact: None.**

`/verify-certificate/[n]` is read by strangers: a buyer checking an agent before
ever meeting KAMBRIQ. Every verdict (valid, revoked, expired, not recognised,
cannot verify) was French only, and the page was on I43's hardcoded-copy debt
list. It now reads from `verifyCertificate`, fr and en, with dates in the
reader's locale. The number the visitor asked about is still shown back to
them, set apart in monospace, through a `t.rich` tag. `next-intl-mock` gains
real tag rendering for `t.rich` to test that. **24 debt entries remain.**

**The verdict logic is untouched** (`lib/certificate-verdict.ts`): the
translation changes the words, never which verdict is given. Both existing
specs pass unchanged in French.

**Proof, red first.** `page-in-english.spec.tsx` renders each of the five
verdicts in English and requires no French word in the page; against develop's
page, all five fail. Two more tests require the requested number in its own
element, as pins. Mutations: the number no longer set apart fails both pins;
the home link hardcoded back in French fails all five.

**The English copy is mine, for Visquis:** `verifyCertificate.*`. The French
keeps today's wording.

**Proven on dev, 26 September, in Firefox, against web `sha-06cf797`:**
`/en/verify-certificate/KCA-20260925-1VZK` reads "Valid certificate - This KCA
certificate was issued by KAMBRIQ and is currently valid. KCA number … Issued on
25 Sept 2026 Valid until 25 Sept 2028 Back to home";
`/en/verify-certificate/KCA-00000000-FAKE` reads "Certificate not recognised - No
certificate issued by KAMBRIQ matches the number KCA-00000000-FAKE"; and the
French page for the same real number is unchanged ("Certificat valide … Délivré
le 25 sept. 2026").

### confirmRemainingPayment - the balance on the ledger - `EN COURS`

**Cost impact: None.** Not started; this entry is why.

G1's model is that a total is a sum over ledger rows. Step 4
(`confirmRemainingPayment`) stamps `remainingPaymentConfirmedAt` on the
reservation, with no payment behind it. The shape that closes it is G1's own:
one `Payment` for the balance, its instalments looping through
`PARTIELLEMENT_RECU`, and step 4 refusing unless that payment is `VALIDE`, as
the deposit step already does.

**Stopped before building, for two decisions that are not mine:**

- **the amount.** The balance's `amountDue` is the price minus the deposit, and
  what `Land.price` means is G19, `A DECIDER`: a total to the API, a price per
  m² to the web. Writing `price - deposit` would decide G19 by implementation;
- **telling a deposit from a balance.** `Payment` has no field saying which it
  is. The deposit gate asks for "a payment in `VALIDE`" on the reservation, so a
  validated balance payment would satisfy it. A purpose column is a schema
  change to the ledger G1 designed.

**Historical rows are not the obstacle.** Counted on dev through the admin API,
26 September: 200 reservations (191 `CANCELLED`, 8 `PENDING`, 1 `CONFIRMED`),
**0** with `remainingPaymentConfirmedAt`, 0 with `documentsReceivedAt`. Nothing
recorded outside the ledger would need migrating.

**G20, 26 September - as far as the amount, then stopped as asked.**

**The amount.** `balanceFor(totalPrice)` in `libs/common/src/payments/deposit.ts`,
beside `depositFor`: the total minus the deposit, so the two add up to the total
exactly whatever the deposit's rounding. The diagnosis parcel: 3 400 000 gives
3 230 000. Red first (the function did not exist), and a balance computed with
its own rounding (`Math.floor`) fails the "adds up to the total" test alone.

**The purpose field - the change, written out, not made:**

- **Column:** `enum PaymentPurpose { ACOMPTE SOLDE }` in `prisma/lands`, and
  `Payment.purpose PaymentPurpose NOT NULL`.
- **Migration:** add the column with `DEFAULT 'ACOMPTE'`, which backfills the
  existing rows truthfully - **all 38 payments on dev are deposits**, each with
  `amountDue` equal to its reservation's `downPaymentAmount` (checked through the
  admin API, 26 September) - then `DROP DEFAULT`, so no new payment can be
  created without stating what it pays.
- **Constraint:** a partial unique index, one live payment per reservation and
  purpose (`UNIQUE (reservationId, purpose) WHERE state NOT IN ('ANNULE',
'REJETE', 'EXPIRE')`), so a second deposit or a second balance cannot open
  beside a live one. Whether the data allows it needs checking first:
  cancelled payments share reservations today.
- **The triggers:** **none is touched, and the brief's premise needs a
  correction here.** `Payment` itself carries no trigger - only CHECKs on the
  reference format and the currency. The append-only triggers are on
  `PaymentReceipt`, `PaymentTransition` and `PaymentReminder`. The migration
  writes no receipt, transition or reminder and changes none, so the ledger's
  guarantee is not crossed.
- **Code:** `confirmDownPayment` asks for a `VALIDE` payment **with purpose
  `ACOMPTE`**; `confirmRemainingPayment` asks for a `VALIDE` payment with
  purpose `SOLDE`; `createPayment` takes the purpose, and a `SOLDE` payment's
  `amountDue` is `balanceFor(land.totalPrice)`.
- **A second decision it carries:** whether the balance is the total minus the
  deposit **due** (what `balanceFor` computes) or minus what was actually
  received on the deposit - they differ only if a deposit is validated with a
  different amount, which the ledger allows through a corrective line.

**Both decisions settled by Visquis, 26 September, and built.**

- **The balance is the total minus what was RECEIVED on the deposit**, summed
  over its ledger rows - not minus the deposit due. His reasons: G1 already
  says the total is a sum over the ledger and nothing else;
  `PARTIELLEMENT_RECU` exists because payments arrive short; and the client
  keeps predictability because the page announces what was expected AND shows
  what is still owed. **One refinement of mine, argued before building:**
  received on the DEPOSIT, not on every payment of the reservation - a third
  purpose (a fee) would otherwise count against the land's price.
- **The purpose is an enum**, `PaymentPurpose { ACOMPTE SOLDE }`, required. The
  migration adds it with `DEFAULT 'ACOMPTE'`, which backfills the existing rows
  truthfully (all 38 on dev are deposits), then drops the default. A partial
  unique index, `Payment_one_live_per_purpose`, allows one live payment per
  reservation and purpose; the three exits where money never arrived free the
  slot. Checked first on dev: 9 live payments, never two on one reservation.

**What changed in the code:**

- `createPayment` requires the purpose. The client's request stays one button
  with nothing on the wire: **the server decides which payment is due** - the
  deposit first; the balance once the deposit is `VALIDE` and the documents are
  received (`BadRequest` before that). A live payment of the purpose due is
  returned, never duplicated. **This fixed a defect the new purpose exposed:**
  the request returned any live payment it found, so a client asking for the
  balance would have been handed back the settled deposit.
- The balance's `amountDue` is `totalPrice - receipts on the deposit payment`.
- Step 2 asks the ledger for a `VALIDE` **`ACOMPTE`**, and step 4 for a
  `VALIDE` **`SOLDE`** (it asked nothing before). One helper,
  `assertPaymentIsValidated(reservationId, purpose, refusal)`.
- The client's purchase detail returns `money`, read from the ledger:
  `totalPrice`, `depositDue`, `depositReceived`, `balanceExpected`,
  `balanceOwed`. The journey's balance line shows the expected balance until
  the deposit is confirmed, then what is actually owed. At step 4 a balance
  card offers the reference, and when a short deposit made the owed figure
  differ from the announced one, it shows both.

**Proof, red first:**

- `balance-on-ledger.spec.ts` (6): the deposit created as the deposit; the
  balance created at 3 230 000 on the diagnosis parcel; **160 000 received on a
  170 000 deposit gives a balance of 3 240 000**; receipts read from the
  deposit payment only; nothing before the documents; a live balance returned.
  Mutations: the balance minus the deposit DUE fails the short-deposit test;
  receipts from every payment fails the "deposit only" test;
- `balance-gate.spec.ts` (8): a validated balance does not confirm a deposit;
  step 4 refuses without a validated balance, even beside a validated deposit,
  and refuses `PARTIELLEMENT_RECU`; the page's `money` for a full, a short and
  a part-paid balance. Red: three gate tests failed against the old gates; a
  mutation of `balanceOwed` to use the deposit due fails the short case;
- `payment-purpose.dbspec.ts` (4), against the real migrations: a payment with
  no purpose is refused (`23502`), a second live deposit is refused by
  `Payment_one_live_per_purpose`, a balance beside a live deposit and a fresh
  deposit after an `ANNULE` are accepted. All four fail without the migration;
  keeping the default, dropping the index's `WHERE`, and dropping the index each
  fail their own test;
- `balance-card.spec.tsx` (3): the card's title, and the announced balance
  shown only when it differs; two mutations, each failing alone.

Three older tests encoded the old behaviour and were updated to the decision:
the fixtures now carry a purpose, the convention test reads the shared ledger
helper, and "a settled payment blocks a new one" became "a settled deposit
never opens a second deposit".

**Found, not changed:** the back-office payment screens do not show a payment's
purpose yet; the admin validating a payment reads its reference and amount.

**Pending:** the migration on dev, read back: the 38 payments carry `ACOMPTE`.
No reservation on dev is past step 3, so a real balance cannot be exercised
there until one is.

**Read on dev, 26 September, on `sha-1489db8`:** migration `20260926210000_g20_payment_purpose` finished at 15:28:39 UTC; `Payment.purpose` reads `ACOMPTE` on **all 38** rows; the column has **no default** (dropped, as designed). The Bertoua purchase answers `money` with `balanceExpected` 3 230 000 while its deposit is unconfirmed. **Still pending:** a balance created and settled on dev - no reservation there is past step 3.

### Payment purpose in back office - `PROUVE`

**Cost impact: None.**

G20 gave every payment a purpose, `ACOMPTE` or `SOLDE`, and the balance gate
reads it; but the back office, where a person validates one, showed neither.
A deposit and a balance of one reservation carry the same client, the same
parcel and close amounts - exactly the confusion G20 exists to prevent, moved
to the one place where the decision is taken. Found during the seventh round's
G20 proof, which had to read the column from the database.

- **API:** the four back-office reads return `purpose` - the payment list, the
  payment detail, the request queue and the overdue queue (no screen reads the
  last one yet; it carries it so the first one does not have to come back).
- **Web:** `PaymentPurposeLabel` ("Acompte" / "Solde", the back office's French,
  like the state badge), in its own "Nature" column on the list and the queue,
  and beside the state badge on the detail.

**Proof, red first:** `purpose-in-back-office.spec.ts` (API, three reads) and a
new test in `dunning.spec.ts` (the overdue queue) failed to compile - the field
did not exist on any of the four. `payments-purpose-in-back-office.spec.tsx` (web, beside the `payments-admin` folder: `payment-format.spec.ts` rightly scans every file inside it for a written currency, and a fixture carries one) failed
on all three screens, then passed. A mutation swapping the two labels fails the
list test.

**API proven on dev, 26 September** (signed in as the seeded admin, image
`sha-e77abc4`): the list answers 38 payments, the request queue 6, the overdue
queue 0, and the detail - each row carrying `purpose`, all `ACOMPTE`.

**Pending:** the screens read on dev with a balance beside a deposit. Dev holds
no balance payment yet (none of the 244 reservations has reached one), and
signing in to the back office in a browser on dev is not mine to do; the three
screens are covered by `payments-purpose-in-back-office.spec.tsx`.

**Row restored, 26 September.** #225 reached develop with this entry but
without its row in the table: its rebase over #224 conflicted in the table, and
the register resolver used by the landing script re-added only rows whose id is
written in backticks. The resolver now matches both forms and refuses to finish
if the branch's row is gone. No other row of this round was lost (checked
against each merge).

**Proven in the back office, 27 September (eleventh round),** signed in on dev
as the seeded test administrator under the standing authorization's new
section, through a Playwright session (no credential typed or printed):

- **the payment list:** `KBQ-2609-8ZEEH-Z` **Acompte** · Validé · 445 000 and
  `KBQ-2609-KZBM9-J` **Solde** · Validé · 8 455 000 - reservation
  `474807f6-…`, side by side, in the "Nature" column;
- **the details:** each header carries its badge beside the state, Solde ·
  Validé on the balance, Acompte · Validé on the deposit;
- **the request queue:** the "Nature" column on its six live requests, all
  **Acompte**. It cannot show a Solde today: the only balance on dev is
  validated, and the queue lists requests still waiting.

Two observations from those screens, not acted on: five deposit requests from
4 September still wait in the queue under journey reservations cancelled before
G21 (a cancellation now annuls them; these predate it), and annulled payments
show their whole amount under "Reste", as if still owed.

### Commission integer money - `PROUVE`

**Cost impact: None.**

The last of the three pre-existing monetary `Float` columns. **The quarantine
list in `no-float-money.spec.ts` is now empty**, and pinned at zero in both
directions: a new monetary Float fails, and so does a new entry that is not
argued for.

**Recounted before starting:** **one API service**, `commissions.service.ts`:
`create` writes the amount from an admin DTO that already accepts only a whole
positive number (`z.number().int().positive()`), and `getSummary` sums it in
three aggregates. The seed writes four; the web only displays. The quarantine's
stated reason ("moves with `Land.totalPrice`, which it is derived from") no
longer held once the total was converted, and the amount is not computed from
it in code - it is entered by an administrator.

- **The migration:** `ALTER ... TYPE BIGINT USING ROUND(...)::BIGINT`.
- `pv` and `tpc` stay `Float`: a coefficient and a rate, not money.
- The summary's empty sums are `0n` instead of `0`; the envelope sends both as
  the number 0.

**Proof, red first:** the spec without the line failed naming
`kamnet/schema.prisma:150 amount Float`; after the migration it passes with the
list pinned at zero. API 1 112, common 376, database 130 green.

**Read on dev before the migration, 26 September:** 6 commissions, **0
fractional**, sum 2 270 000, largest 750 000, column `double precision`.

**Proven on dev after `f5ee3b5` deployed** (migration finished 20:07 UTC):
column `bigint`, 6 commissions, sum 2 270 000, largest 750 000 - unchanged.

### Deposit integer money - `PROUVE`

**Cost impact: None.**

`LandReservation.downPaymentAmount` was the second of three pre-existing
monetary `Float` columns quarantined in `no-float-money.spec.ts`.

**Recounted before starting, as asked:** the arithmetic is in **two API
services** - `reservations.service.ts` writes it from `depositFor(totalPrice)`
and reads it into the client's money summary; `payments.service.ts` reads it
into a deposit payment's amount due. The web only displays it (four places,
none computing). No email and no queue job carries it, so no path serialises it
outside the response envelope, which already turns a BigInt into an exact number.

- **G1 is kept, not contradicted.** G1 deprecated the column and deliberately
  did not drop it; the quarantine note said it "must survive this PR unchanged",
  meaning the G1 PR. It is still deprecated and still kept; only its type moves.
- **The migration** is one `ALTER ... TYPE BIGINT USING ROUND(...)::BIGINT` - the
  same rounding the G1 backfill applied when it read the column, so a deposit
  payment backfilled then and one created now still agree.
- **Two `Math.round` calls disappear** from the API: the amount is the column.
  The unit test that fed a fractional deposit (400000.6) now feeds 400 001 as
  stored.

**Proof, red first:** `no-float-money.spec.ts` without the line failed naming
`lands/schema.prisma:216 downPaymentAmount Float`; after the migration it passes
with the list pinned at one. API suite 1 111 green (the one local failure is the
`.env` NODE_ENV test), database suite 130 green against the real migrations.

**Read on dev before the migration, 26 September:** 238 reservations, 238 with a
deposit, **0 fractional**, sum 97 250 000, column `double precision`.

**Proven on dev after `3956c16` deployed** (migration finished 19:07 UTC):
column `bigint`; 244 reservations, 244 with a deposit, 0 fractional, sum
99 920 000. The six rows since the baseline are the journeys' reservations at
445 000 each: 97 250 000 + 6 × 445 000 = 99 920 000, so every earlier deposit
kept its value. Two of the six were written after the migration, by the new
code, into the `bigint` column.

### Signed-in price smoke - `PROUVE`

**Cost impact: None.**

**The gap, named in the seventh round's report:** `Land price integer money` was
proven by a database read and by the journeys passing; "a direct read of a land
from the API was not taken: every lands route needs a session".

**Closed inside the delivery journeys** (`apps/api-e2e`), which already sign in
as the seeded agent and admin on every develop deploy:

- **Journey 6 (new):** the agent lists parcels and opens one. Every listed
  `totalPrice`, and the detail's, must be a whole JSON number in the exact range
  - not a string (what the envelope makes of a BigInt past that range), not a
    fraction (what a Float lets through). And the detail's `pricePerM2` must equal
    `round(totalPrice / sizeM2)`: Postgres generates that column from the stored
    total, so the two agree only if the API sent the stored figure unchanged.
- **Journey 4 (extended):** the new client reads their own purchase: the
  deposit (`downPaymentAmount`, integer since this round) and the money summary
  are exact, the summary's deposit is the column, and deposit plus expected
  balance equals the total.
- **The check itself is tested:** `exactMoney` in `support.ts`, with a unit test
  under `src/unit/` (it runs in `Quality` on every pull request, not only after
  deploy). Red first: the test failed before the helper existed; a mutation
  that checks only `typeof` fails two of its four cases.

**Run against dev on 26 September** (journey 6 alone, read-only): green.

**Proven:** the delivery journeys on `6193d29` (the merge of this change),
under the sha gate, **29 passed of 29** - one more than before, journey 6 - with
journey 4's new money checks inside.

### Land price integer money - `PROUVE`

**Cost impact: None.**

G1's rule is that money is an integer in its indivisible unit, and
`no-float-money.spec.ts` quarantined `Land.price` because converting it meant
"51 call sites" and a response serialiser. **Counted again on 26 September,
after G19: the arithmetic lives in three API services** (price history,
deposit, balance and the client's money summary); the web only displays the
figure.

- **BigInt, not `Int`.** An `integer` would cap a parcel at 2 147 483 647 XAF
  (about 3.3 million euros), a ceiling a real catalogue could meet. `BigInt` is
  G1's type.
- **The migration** drops the generated `pricePerM2` (Postgres will not change
  the type of a column a generated column reads), converts `totalPrice` with
  `ROUND(...)::BIGINT`, and re-creates `pricePerM2` from the integer total with
  the same result. `previousTotalPrice` and `newTotalPrice` move with it.
- **The serialiser is one point:** `TransformResponseInterceptor` walks plain
  objects and arrays and turns a BigInt into a number when it is a safe integer,
  a string otherwise - never rounded, never a `JSON.stringify` crash. The web
  keeps receiving numbers and needed no change.
- **The quarantine drops to two** (`downPaymentAmount`, `KamnetCommission.amount`).

**Proof, red first:** `no-float-money.spec.ts` with the three entries removed
failed naming exactly the three columns, then passed after the migration.
`bigint-response.spec.ts`: a BigInt total serialises as a number, nested ones
too, one past the exact range leaves as a string, dates untouched - three of
four failed before the interceptor changed; a mutation that always converts to
a number fails the "never rounds" test. The API suite (1 103) and the database
suite (130, including G19's generated-column tests against the new column) are
green.

**Proven on dev, 26 September (after `e97fb0d` deployed),** read-only through
ECS exec: migration `20260926230000_total_price_integer_money` finished at
16:47 UTC; `Land.totalPrice`, `LandPriceHistory.previousTotalPrice` and
`newTotalPrice` are `bigint`; `pricePerM2` is still a generated `integer`. The
seeded lands keep their figures: 8 000 000 over 300 m2 gives 26 667, 12 500 000
over 450 m2 gives 27 778, 15 000 000 over 250 m2 gives 60 000. The E2E and
delivery journeys on that deploy passed, and they go through the API routes
that now serialise a BigInt. A direct read of a land from the API was not
taken: every lands route needs a session.

### G19 - a 170 000 deposit beside a 1 631 830 000 balance - `PROUVE`

**Cost impact: None.** Diagnosis only; nothing was changed.

**The answer: the computation, not the seed, and not a factor of a hundred.**
One column carries two units. `Land.price` is read as the parcel's **total** by
the API and the seed, and as a **price per m²** by the web.

Measured on dev, 26 September, on the parcel the gap was seen on
(`Parcelle Bertoua Nkolbikon`, reservation `380d2626-…`):

| Value              | Where it comes from                                                          | Result            |
| ------------------ | ---------------------------------------------------------------------------- | ----------------- |
| `price`            | `prisma/seed.ts`, `price: 3400000`                                           | 3 400 000         |
| `sizeM2`           | `prisma/seed.ts`, `sizeM2: 480`                                              | 480               |
| deposit            | API, `reservations.service.ts:106`, `price × DOWN_PAYMENT_PERCENT / 100` (5) | **170 000**       |
| "total" on the web | `purchase-detail-content.tsx:48`, `price × sizeM2`                           | 1 632 000 000     |
| balance shown      | the web's total minus the deposit                                            | **1 631 830 000** |

The ratio between the two readings is exactly the surface, 480, which is also
why it looked "roughly five hundredfold".

**Who reads which unit:**

- **total** - the Prisma schema ("Selling price in XAF"), the create and update
  DTOs ("In XAF", an integer), the seed (3.4 million for 480 m² in Bertoua is a
  total, about 7 000 per m²), the deposit, and so the payment the ledger is
  asked for (`payments.service.ts:342` takes `downPaymentAmount`);
- **per m²** - five web places: the app land card (`…/m²`), the land info panel
  ("price" `…/m²` and "total price" `price × sizeM2`), the reservation card
  (`F/m²`), the reservation summary (`price × sizeM2`), and the client purchase
  page (`price × sizeM2`). Four translation keys say "Prix / m²";
- **ambiguous** - the back-office form label is just "Prix", so the person
  typing a price is not told which one.

**The Float lead does not hold.** `downPaymentAmount` and `Land.price` are
`Float`, and XAF has no minor unit, but every value in this chain is an integer
and nothing divides or multiplies by 100. The Float quarantine is still a real
debt (`no-float-money.spec.ts` lists it); it is not this gap.

**Money that moved is consistent; what the customer reads is not.** The
payment a client is asked for is the API's 5 % of `price`, and the ledger holds
that. The balance on the purchase page is display only, computed in the
browser, and nothing is charged from it. But the app's land card and info panel
show the total as a price per m², 480 times too high on this parcel, and the
purchase page promises a balance nobody will ever be asked for.

**Why it is not closed by C16, and why it is a decision.** If the real catalogue
is loaded with totals, the web is wrong on every parcel exactly as here. If it
is loaded with prices per m², which is how land is often quoted, the web becomes
right and **the API becomes wrong**: the deposit would be 5 % of a per-m² price,
480 times too small on a parcel like this one, and that is the amount the
ledger would ask a real client to pay. Either way one side is wrong until the
unit is chosen. **The unit is Visquis's call, before C16 loads anything**:
total or per m², then one reading everywhere, the back-office label saying
which, and a test that multiplies nothing the column does not mean.

**Decided by Visquis, 26 September: both figures, each in its own column.**
Applied with **one source of truth and the other derived**, not two stored
columns with a CHECK. The brief offered both; the choice and its reason:

- `Land.totalPrice` (renamed from `price`) is the source of truth. It is the
  contractual amount, what the deposit is computed from, what the ledger asks
  for, and what the price history records (`previousTotalPrice`,
  `newTotalPrice`, renamed with it).
- `Land.pricePerM2` is a Postgres `GENERATED ALWAYS ... STORED` column,
  `ROUND(totalPrice / NULLIF(sizeM2, 0))::integer`: whole francs, never
  written by anyone, recomputed by the database on every change to either
  input. A direct write is refused (`428C9`).
- **Why not both stored with a CHECK:** the surface is fractional (`sizeM2` is
  a Float) and XAF amounts are whole francs, so an integer price per m2 times a
  fractional surface cannot in general equal an integer total. The constraint
  would either refuse honest rows or need a tolerance - and a tolerance is the
  ambiguity this chantier removes.
- **Integer, not Float:** the price per m2 is money, and money is never a
  floating-point type. A `BigInt` would break the JSON serialisation of every
  land response, so it is a Postgres `integer`; a value past 2 147 483 647 per
  m2 would fail loudly on write. `totalPrice` stays in the Float quarantine,
  under its new name: converting it is still its own chantier.

**Nothing multiplies by the surface anymore.** The five web places now read the
field that says what it is. The deposit has one home, `depositFor(totalPrice)`
in `libs/common`, used by the API that charges it and the page that estimates
it. The back-office form and table say "Prix total" / "Total price" (copy for
Visquis).

**Correction to this entry's diagnosis: there were six web places, not five.**
The land detail page estimated the deposit as `price x sizeM2 x 5 %`
(`land-detail-content.tsx:48`), so it showed a deposit 480 times too large on
the same parcel. Four of the six multiplied by the surface; the land card and
the reservation card printed the total as a price per m2 without multiplying.

**Proof, red first:**

- `land-price-units.dbspec.ts`, against the real migrations: 3 400 000 over
  480 m2 reads `pricePerM2` 7 083; changing the total to 4 800 000 reads 10 000;
  changing the surface to 500 reads 6 800; a direct UPDATE of `pricePerM2` is
  refused. Against develop's migrations all four fail (the column does not
  exist). The mutation that matters, the option refused in the brief (a plain
  stored column, nothing enforcing the relation), fails all four;
- `deposit-for.spec.ts`: the diagnosis parcel gives **170 000**, not
  1 631 830 000 and not 480 times less. A divisor of 10 instead of 100 fails
  both tests;
- `no-price-times-surface.spec.ts` reads the web, the API, `libs/common` and
  the seed for a price multiplied by `sizeM2`. Against develop it names the
  four multiplying sites; now it names none.

**Proven on dev, 26 September, on `sha-7507331`** (the migration ran with the
deploy). `GET /lands/client/purchases/380d2626-…` as the G8 throwaway client:
`Parcelle Bertoua Nkolbikon`, `totalPrice` 3 400 000, `pricePerM2` **7 083**
(generated), `sizeM2` 480, `downPaymentAmount` **170 000**, and no `price` field
any more. The purchase page, read in Firefox, says "Amount due: 170 000 XAF",
"Deposit of 170 000" and **"3 230 000 FCFA remaining"**, where it said
1 631 830 000.

### A55 - did a password in a URL reach any log? - `PROUVE`

**Cost impact: None.** Read-only.

**The question.** Before #214, a tap before the page's scripts loaded submitted
six forms as a native GET, so `/fr/login?email=...&password=...` (and the same
on register, reactivate, reset-password and two account forms) could be sent
by a real visitor. Dev is public and the ten KAMNET agents have real accounts on
it. Visquis, 26 September: search the logs now, before retention erases them.

**What was searched, 26 September ~15:10 UTC.** Every place on dev that could
record the URL of a web request:

- the load balancer `kambriq-dev-alb`: `access_logs.s3.enabled = false`,
  `connection_logs.s3.enabled = false`;
- CloudFront, WAF: none exist on the account for this site;
- `/ecs/kambriq-dev-web` (7-day retention, oldest event kept 19 September) and
  `/ecs/kambriq-dev-api` (7 days), Logs Insights over 8 days for
  `[?&](password|newPassword|currentPassword|confirmPassword)=`: **0 matches**
  in 4 829 and 229 074 records.

**The zero is not a clean bill by itself, and the control says why.** My own A33
reproduction sent exactly such requests to dev that afternoon
(`/fr/login?email=nobody@example.com&password=wrong-password-123`, several
between about 13:00 and 14:05 UTC). **None of them is in the web log either.**
The web container logs its start and its errors, never a request line, and the
API never received those GETs. So the answer is structural rather than a
search result: **no server log on dev records the URL of a web request, so none
can hold a password sent that way** - not in the seven days kept, and not
before. Retention was never the limit; the window of the defect (since the
sign-in page existed, 16 April) is not covered by any log because nothing
logged it.

**The other channels, measured:**

- **referer:** the site sends `Referrer-Policy: strict-origin-when-cross-origin`
  (explicit since 19 April, and the browsers' own default before that). The
  sign-in page's only third-party request, `api.fontshare.com`, carries
  `referer: https://dev.kambriq.com/` - the origin, never the path or the query;
- **in transit:** HTTPS encrypts the query string;
- **what remains, and cannot be checked from here:** the visitor's own browser
  history and address-bar suggestions, on their own device. That matters only
  on a shared device.

**The consequence is Visquis's.** No credential appears anywhere a server
wrote. Whether to ask the ten agents to change their passwords anyway - for the
shared-device case - is his decision; nothing was rotated.

**Decision, Visquis, 26 September: rotate nothing.** Nothing was written
server-side, so a rotation would protect against nothing and disturb ten
agents. The control above (test requests with a password in the URL appear
nowhere) is what settled it. Not to be reopened on the same facts. The hole it
revealed, no HTTP access log at all, is its own subject: D28.

### H2 follow-up 2 - the bootstrap step reads its tally, not only its exit code - `PROUVE`

**Cost impact: None.**

**The row:** the bootstrap deploy step checks the task's exit code and never
that its tally line appeared. Same family as A9 (a seed step that seeded
nothing and exited 0) and A54 (failed jobs that logged nothing): **a step that
exits zero has declared success, not achieved it.**

`prisma/bootstrap-admins.ts` prints `Kambriq super-admin bootstrap complete:
<n> created, <n> updated, <n> unchanged` only after its postcondition passed
(read on dev: `0 created, 0 updated, 2 unchanged`, stream `api/api/<task id>` of
`/ecs/kambriq-dev-api`).

**Built:**

- `scripts/ci/await-task-tally.sh <task-def> <container> <task-arn> <line>
[timeout]` - reads the log group and stream prefix **from the task
  definition** (not assumed), builds `<prefix>/<container>/<task id>`, waits a
  bounded while for the line, prints it, and fails saying "the task exited 0 but
  never printed …" when it does not come. A task definition with no awslogs
  configuration is a failure, not a pass.
- `deploy-dev.yml`: the bootstrap step calls it after the exit code, with the
  line above and 90 s; the deploy job checks out `scripts/ci` only (sparse).
- `ci.yml`: the CI Gate job runs `await-task-tally.test.sh` next to the develop
  gate's own test, on every pull request.
- **Infra #67** (applied on dev, 27 September, "0 added, 1 changed"): the
  webapp deploy role `kambriq-dev-github-actions` gains `ReadOneOffTaskLogs` -
  `logs:FilterLogEvents` and `logs:GetLogEvents` on the API service's log group
  only. Before it the simulator answered `implicitDeny`; after, `allowed`. It
  was applied **before** this change landed: the other order fails every deploy.

**Proof, red first:** `await-task-tally.test.sh` against a fake `aws` - the
tally found; the stream built from the task definition's prefix; exit 0 with no
tally refused; no log configuration refused. A mutant that trusts the exit code
(`exit 0`) fails all four.

**Not in this change:** the migration and the (opt-in) seed steps have the same
shape; the seed's own proof stays manual (A9, Visquis 27 September).

**Proven on dev, 27 September:** the deploy of `61388d9` ran
`await-task-tally.sh` after the exit code and printed `Kambriq super-admin
bootstrap complete: 0 created, 0 updated, 2 unchanged`, read from the task's own
log stream; the deploy passed.

### Migration step tally - `PROUVE`

**Cost impact: None.**

Same family as A9, A54 and H2 follow-up 2: the "Run Prisma migrations" deploy
step checked its task's exit code and nothing else, and `run-migrations.js`
printed each `migrate deploy` command but no line saying it had finished - so
there was nothing to read.

**Built:** the script prints `Kambriq migrations complete: 4 schemas (core,
kamnet, kbs, lands)` once, after the last schema, and never when one fails
(`main` only prints what `runMigrations` returned). It runs only when executed
(`require.main === module`) and exports its pieces, so it can be tested. The
deploy step calls `await-task-tally.sh` for that line after the exit code, as
the bootstrap step does.

**Proof, red first:** `apps/api/src/__test__/deploy/migration-tally.spec.ts` -
the four schemas migrated and named; no completion line when a schema fails;
and the step waits for **exactly** the line the script prints, read from both
files, so they cannot drift. Red before: requiring the script ran it and exited.

**Proven on dev (`e540c86`, 27 September):** the step ran `await-task-tally.sh`
after the exit code and printed `Kambriq migrations complete: 4 schemas (core,
kamnet, kbs, lands)`, read from the migration task's own log stream; the deploy
passed.

### H2 follow-up 1 / A9 - the seed step, and where its proof was taken - `EN COURS`

**Cost impact: None.** Read-only.

**The ninth round's premise:** `run-migrations.js` never reads `--seed`, so A9
("the deployment's seed step has never seeded anything") is contradicted by the
code. **Checked: the defect was real and was fixed.** `95b4e69` - _fix(ci): make
the seed step actually seed (a9) (#116)_, 14 September - replaced
`node prisma/run-migrations.js --seed` with
`npx tsx --tsconfig tsconfig.base.json prisma/seed.ts` in `deploy-dev.yml`; the
bootstrap step's comment records the same history. `--seed` appears nowhere in
the repository today. The `H2` follow-up row simply predated the fix.

**Of the two readings asked for, the first is true:** the wiring did not exist
and was not lost - it was built by #116 - and **A9's proof was taken on a manual
run**: its commit message says "proven by running the corrected command as a
one-off task against dev" (exit 0, rows restored, 37 payment-carrying
reservations kept). The deployment step itself has never been exercised with
`run_seed=true`.

**Why the deployment proof is not taken here:** it means a deploy with
`run_seed=true`, and the seed clears the seeded parcels' reservations that carry
no payment. On 26 September Visquis refused a seed run for I19 on exactly that
ground ("we do not break a proof for three rows"). **Pending Visquis:** a go for
one deploy with `run_seed=true` (the journeys' reservations and G8's, which
carries payments, would survive; the payment-less ones on seeded parcels would
not), or a decision that the manual proof stands.

### G4 follow-up - two DTOs named alike, and nothing keeping them apart - `PROUVE`

**Cost impact: None.**

**Tracker correction, 27 September:** the row said `GetUploadUrlDto` is declared
twice and the API warns on every boot. Both were renamed on 14 September by
#119 (A15, `ccafc87`): `GetLandUploadUrlDto` (a media `category`) and
`GetCourseUploadUrlDto` (`moduleId`/`lessonId`) - two contracts, deliberately
not merged. Dev's API log: **0** "Duplicate DTO" lines in 7 days. The proposal
that put this in the ninth round was mine, made from the row without reading
the code.

**What was missing was the guard:** `dto-names-unique.spec.ts` reads every
non-test source file of `apps/api/src` and `libs/common/src` - no module list -
and fails on any DTO class name declared twice. Planting A15's defect back
(`GetCourseUploadUrlDto` renamed to `GetLandUploadUrlDto`) fails it.

### I46 - every human path, walked through the pages on every deploy - `EN COURS`

**Cost impact: about a minute of E2E time per deploy** (the four walks ran in
45 s against dev, the emailed links in 34 s). No infrastructure.

**Decided by Visquis, 27 September:** once A56 lands, walk every human path
continuously, not opt-in - "an optional walk is not proved on the day it would
have mattered".

**Built** (`apps/web-e2e/src/human-paths.spec.ts`, Chromium, every deploy):

1. **Registration and email verification:** `/register` filled and submitted,
   the verification link opened from the delivered email, the success page,
   its link to the login page, a sign-in.
2. **Forgotten password:** `/forgot-password`, the reset link from the email,
   a new password set on `/reset-password`, a sign-in with it.
3. **KBS enrolment:** `/kbs/enroll` - identity file, engagement, submit - by
   the same person, signed in.
4. **The back office taking a deposit from request to validation:** the client
   asks for the deposit on the purchase page; the administrator (the run's one
   session) verifies the identity on `/admin/identities/:id`, then on the
   payment's screen sends instructions (VIR), moves it to announced and to
   verification, records a receipt with its proof uploaded, moves it to partly
   received on that receipt, and validates it: the header reads **Acompte**,
   **Validé**. The reservation is cancelled afterwards (G21 leaves the payment
   validated).

And `emailed-links.spec.ts` runs on every deploy again - it was opt-in for a day
because it overran the login limit; A56 budgets it.

**What stays proved through the API, each with its reason:**

| Path                                                                 | Proved by                            | Why not through the page                                                                                          |
| -------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| A land buyer sending an identity document                            | journeys 4, 7; the walk above        | **no page exists** - I47                                                                                          |
| An agent reserving a parcel for a client                             | journeys 4, 7 and every walk's setup | not walked yet: the agent's reservation screens are the next walk to add                                          |
| A candidate's quizzes, the 20-question exam, the certificate's issue | journey 3                            | not walked yet: forty clicks per run on answers the journey already proves; the exam screen deserves its own walk |
| The client's own balance request and documents upload                | journey 7 (opt-in)                   | the deposit walk covers the same screens; a balance needs documents received first                                |
| A super administrator's activation                                   | journey 5                            | same pages as the forgotten-password walk, which is walked                                                        |
| Reading a parcel's price                                             | journeys 4, 6                        | the catalogue pages render it on every E2E public-route check                                                     |

**Proof so far:** the four walks green against dev (`5 passed`, with the
sessions setup), the emailed links green, the full suite 193 passed with 0 x 429
(A56). **Pending:** the first develop E2E run with all of them, and its API log
read for 429 on the auth routes.

**Held opt-in the same day.** The first develop run with the walks on
(`d73609d`) failed on two sign-ins refused with 429 (A56). Both walk files now run
with `RUN_PAGE_WALKS=1`, which puts the per-deploy suite back at the load that
passed before, and develop back to green. Continuous waits on A56 holding in CI -
Visquis's decision, with the log above.

**Continuous again, 27 September.** Visquis granted it once A56 was fixed: the
walks had been held opt-in because the API's limiter (6.5.0) kept counting a
caller's sign-ins after any other caller's block ended, so the suite's budget was
set against a counter that did not forget. With 6.7.1 in the lockfile (A56) the
`RUN_PAGE_WALKS` switch is removed from `human-paths.spec.ts` and
`emailed-links.spec.ts`, and the README says so. The proof is not a green run: it
is the API's log for that run, read for a 429 on the auth routes.

**First develop run with the walks on, 28 September (`7ad301f`).** All six
Chromium walks pass (registration, forgotten password, KBS enrolment, the back
office deposit, both emailed links); Firefox and WebKit skip by design. The E2E
job is red for one reason only: the CMS pages (`/about`, `/methode`, `/plan`,
`/legal/*`, `/products/verify`) answer 404 until Sanity content exists (#252).
API log for the run: no 429 for the walks' caller (`64.236.135.3`, vouched by
the web); one 429 for the journeys' runner, explained under A56. **The brief's
proof was "no 429 on the auth routes"; read literally it does not hold, read for
the walks it does** - left for Visquis.

**Second run, same shape (`99e73b1`, E2E 05:07-05:16 UTC).** All six walks
pass; nothing fails outside the CMS routes; the API log holds one 429 in the
whole run, `/auth/login` at 05:09:08, again the journeys' runner (`node`, no
vouched visitor). Two runs, one caller refused each time, never the walks.

**#255 landed without the full local gate.** Its register edit was not
prettier-clean; `format:check` stopped the gate before lint, typecheck and
tests, and the landing script read "no failing test" as green. CI's own jobs
were green. #256 formatted the row, and the full gate then ran to its end on
develop plus that fix (four test summaries, the known local `NODE_ENV` case the
only failure). The script now refuses a gate that did not reach its end.

**The journeys sign in less, 28 September.** The one 429 in each of the two
walks-on runs was the delivery journeys' own runner signing in an eleventh time
within sixty seconds. Every spec file signed the same seeded accounts in again
(admin three times, eric three, sylvie two, jean.kbs once). `sessionFor` in
`apps/api-e2e/src/journeys/support.ts` keeps one token per seeded account for the
run, in a directory `global-setup.ts` creates and `global-teardown.ts` removes;
the API reads roles from the database on every request, so a token taken once
stays accurate. Minted accounts and the five sign-ins that test signing in keep
`login`. Unit-tested (`src/unit/session-for.spec.ts`, three mutations each
confirmed applied: never reusing, no expiry check, one token for every account).
Measured against dev, the two kamnet files in band: **4 sign-ins where they made
7**. Run with parallel workers, both files signed in at once and it stayed 7 -
the target is in band, and the docstring says so. Pending: a develop run whose
API log holds no 429 on any auth route, for any caller.

**Proven on dev, 28 September (`952991e`, E2E 08:48-08:56 UTC).** All six
Chromium walks pass; E2E fails only on the CMS routes (Sanity content); the
journeys pass. The API log over the run window holds **no 429 on any route for
any caller** - 279 requests, `/auth/login` answered 200 twenty-three times, 401
three and 400 four (the deliberate refusals). The brief's proof now holds as it
was written.

### I47 - a land buyer has no page to send an identity document - `PROUVE`

**Cost impact: None to decide.**

Found building I46's payment walk. `myPayment.waitingIdentity` tells a client
whose payment waits on identity to "upload your document from your profile".
The profile page offers an avatar and nothing else; the only identity upload on
the site is inside the KBS enrolment form. `sendInstructions` refuses unless the
client's identity is **verified** (v03 4d), so **through the site, the back
office can never answer a land buyer who is not also a KBS candidate** - the
request waits forever with a message pointing at a control that is not there.
The journeys never saw it: they submit the document through the API.

The purchase page's own uploads (`ID_CARD`, `PROOF_OF_ADDRESS`) are reservation
documents, a different record from `UserProfile.idDocumentUrls` that the
identity review reads. Whether the fix is an upload on the profile, on the
payment page, or treating the reservation's `ID_CARD` as the identity document
is a product decision - Visquis's, with Ulrich for the code.

**Decided by Visquis, 27 September: in the payment page**, where the request is
made and at the moment it is made - the buyer sees why the document is asked
for (no verified identity, no payment instructions) instead of being sent to a
screen they do not know.

**Built (twelfth round):**

- **The page:** when a payment waits on identity, `/mylands/payment/:id` shows
  the upload under the explanation; once sent it says the document is being
  checked; a refused document asks for a new one. `identityStatus` already
  travels with the payment, so the state is the API's, not the page's guess.
- **One mechanism:** `getIdUploadUrl` and `submitIdDocuments` moved from
  `lib/actions/kbs.ts` to `lib/actions/identity.ts`; the KBS enrolment form and
  the payment page both use them, and the shared `uploadToS3` helper. The API
  answers a storage key in `fileUrl` and the key is what is submitted and stored
  (A49's rule: a reference, never an address).
- **The copy:** `myPayment.waitingIdentity` no longer sends the buyer to their
  profile; `myPayment.identity.*` is new. Both languages are **proposed copy**,
  for Visquis to approve or rewrite.

**Proof, red first:** `identity-on-payment-page.spec.tsx` - the upload offered
when nothing was sent, the key (not the upload URL) submitted after the PUT, the
"being checked" state, the refused state, and no mention of a profile. Red
before the module existed; a mutation submitting the upload URL instead of the
key fails it. The I46 payment walk now sends the identity document **from the
payment page**, then the back office reviews it, sends instructions and
validates the deposit.

**Pending:** that walk green on dev once deployed - the whole chain, not the
upload alone.

**Proven on dev (`sha-8d7084b`), 27 September - the chain, not the upload
alone.** The I46 payment walk (`RUN_PAGE_WALKS=1`, Chromium): the buyer asks for
the deposit on the purchase page; on the payment page, waiting on identity, the
upload is offered and the document sent; the back office verifies it on
`/admin/identities/:id`, sends the instructions (VIR), records a receipt with its
proof and validates the deposit - **2 passed** (with the sessions setup).

### A56 - the E2E suite's share of the login limit - `PROUVE`

**Cost impact: None.** The API's limits are untouched.

**The defect** (27 September, found making I45's walks continuous): the API
limits each auth route per caller - `login` 10 a minute, set by A41 from
measured per-caller peaks. The E2E suite calls from one runner address, so it
is one caller. Before the walks it sat just inside the limit (two attempts per
browser, three browsers); the two emailed-link walks added seven sign-ins, the
API answered 429 during the run, and the sign-in that came last failed -
Firefox's own login test. A test that breaks its neighbour by consuming a shared
resource accuses the wrong culprit.

**Built (#244), without raising the limit:**

- **Reuse:** a `sessions` setup project, which every browser project depends
  on, signs in **once per role** for the whole run - an API token for the agent
  and administrator fixtures, and the administrator's browser session (storage
  state) for the back-office walks. The accounts are the seed's test fixtures.
- **Budget:** `support/auth-budget.ts` - every auth call a test makes, through
  a page or through the API, first takes a slot from a sliding window per route,
  shared by every worker through a lock directory, at 80% of the API's limit for
  that route. The limits are **read from `auth.controller.ts`** at run time, so
  they cannot drift from the API.
- **Guard, inverted:** `auth-budget.spec.ts` reads every spec and setup file and
  fails on any auth call - an API call to an auth route, a sign-in button, a
  submit button - without a slot taken just before it. Against the old
  `auth.spec.ts` it named its three unslotted calls.

**Proof - the absence of 429, not a green run:** the full suite against dev,
three browsers and two workers as in CI, **with the walks on**
(`RUN_EMAILED_LINKS=1`), from one address, 09:16-09:18 UTC: 193 passed. The API log
for that address over the run: 24 auth responses - 14 sign-ins (10 accepted, 4
wrong-password refusals), 4 verifications, a reset, registrations - and **0
answered 429, on any route**. Mutations: letting one call too many through the
window fails the concurrency test; a spec without its slots fails the guard.

**The proof does not hold in CI (27 September, `d73609d`).** The first develop E2E
run with every walk on failed twice on sign-ins, and the API log shows why: the
E2E runner's address (`172.208.153.227`) was answered **429** on
`/api/v1/auth/login` at 10:23:39, 10:23:48 (twice) and 10:24:29. Its calls in
the sixty seconds before the first refusal were eight (10:22:41, :44, :46, :51,
10:23:21, :23, :26, :35) - the budget held at eight, as designed - and the ninth
was refused, while `auth.controller.ts` declares ten. (Each successful sign-in
logs two lines, the request and an application line; counting lines doubles it.)
The delivery journeys ran at the same time from another address and do not
share the bucket.

So something about the API's count or window differs from what its decorator
says, and the local run's 0 x 429 was true of a lighter, slower suite. **Not
established, and not guessed at:** lowering the budget until the run is green
would be tuning a test to an unexplained limit. Pending Visquis: whether to
investigate the throttler's counting on dev first (A41's limits are measured, so
this matters beyond the tests), or run the walks opt-in until then.

**Answered, 27 September (twelfth round) - what the API's rate limiter counts.**
Visquis framed it as a question about the API, not the tests. The answer, from
the library's source and reproduced against its real storage class:

- **Keyed on:** `sha256(<Controller>-<handler>-<throttler name>-<tracker>)`
  (`ThrottlerGuard.generateKey`), the tracker being the address the web vouches
  for or the last `X-Forwarded-For` hop (A45). **One counter per caller per
  route**: auth routes do not share a counter (hypothesis refuted).
- **Window:** each hit is forgotten `ttl` after it was made - a **sliding**
  window, the same shape as the suite's budget (so that hypothesis explains
  nothing).
- **Storage:** the default in-memory `ThrottlerStorageService`, one per API
  process; dev runs one task.
- **The defect:** in `@nestjs/throttler` **6.5.0** the storage keeps the timers
  that forget hits in `timeoutIds`, **keyed by throttler name, not by key**. When
  a blocked caller's block ends, `resetBlockdRequest` calls
  `clearExpirationTimes(<name>)`, which cancels **every key's** pending timers
  under that name. From then on, every other caller's recorded hits are never
  forgotten: their counts only grow, until each of them is blocked and reset in
  turn - which freezes everyone again. All routes share the name `default`,
  including the global 100-per-6-seconds throttler.

**The CI refusal, explained to the second** (`d73609d`): the journeys' address
was refused on `/auth/login` at 10:22:21.9 (its eleventh sign-in); its block
ended at 10:23:21.9 and its next sign-in at 10:23:23.6 reset it - cancelling the
E2E runner's pending expiries. The runner's seven hits then held, three more
arrived (10:23:23, :26, :35), and the next, at 10:23:39, was its eleventh by the
storage's count and its ninth within sixty seconds by the clock: **429**.

**Reproduction:** `storage-counts-what-it-declares.spec.ts` (#249, draft): a
caller's eight hits, made at 50 s, are still counted at 111 s because another
caller's block ended at 61 s - `Expected: 1, Received: 9`. **The same two tests
pass against 6.7.1's `ThrottlerStorageService`** (read from the published
package), which keeps each key's own list of hit expiry times.

**What A41's limits mean, therefore:** they never let more calls through than
declared - the protection holds - but they **refuse legitimate callers below
the declared rate**, and the effect accumulates for the life of the process:
after any caller anywhere is blocked and resets, an ordinary visitor's calls on
a route are counted forever until they reach the limit. In production, where a
bot being refused is ordinary, real visitors would meet false 429s on login,
registration, contact and the rest, at rates A41 measured as normal. **Finding
for Visquis before 1 October:** upgrade `@nestjs/throttler` to 6.7.1 (#249's
reproduction then goes green and joins the suite) or keep 6.5.0 knowingly. The
suite's budget and I46's continuous walks wait on it: a budget cannot be set
against a counter that does not forget.

**Decided and done, 27 September:** Visquis granted the upgrade in chat. It is a
lockfile move and nothing else: the declared range `^6.5.0` is unchanged,
`pnpm-lock.yaml` resolves `6.7.1` (its peers accept `@nestjs/common` and
`@nestjs/core` 11.2.6 and `reflect-metadata` 0.1.14; its `engines` field asks
for Node 20.19, 22.12 or 24+, and every image and CI job runs Node 24). The API
uses only the public surface - `Throttle`, `ThrottlerModule`, and a
`ThrottlerGuard` subclass overriding the tracker - none of which changed.
`pnpm update` would also have rewritten the range and pulled unrelated rollup
binaries; both were refused and the two lockfile entries moved by hand, then
checked with `pnpm install --frozen-lockfile`. The reproduction is red on 6.5.0
(`Expected: 1, Received: 9`) and green on 6.7.1, with the 35 other throttler
specs. The row stays `EN COURS` until dev shows no 429 on the auth routes with
the walks on (I46).

**Proven on dev, 28 September.** The first develop run with 6.7.1 and the walks
on (`7ad301f`, E2E 04:19-04:27 UTC) logged 36 sign-ins and one 429, at
04:21:13.851, for `20.15.228.213` - the delivery journeys' runner (`node`, no
vouched visitor address). Its sign-ins from 04:20:13.85 on: 04:20:23, 04:20:49,
04:20:50 (401), 04:20:51 (401), 04:21:00, :02, :05, :08, :11, :13.7 - ten, so
the eleventh was refused, exactly as declared (failed sign-ins count too). The
journey client waits on a 429 (A36) and the journeys passed. The run before it
(`95d7718`, walks off) showed the same shape: one 429 at 21:29:55 in a burst of
the journeys' sign-ins. On 6.5.0 the question was a counter that did not
forget; on 6.7.1 it is only whether the journeys should sign in less often.

### A67 - a test an environment variable switches off runs somewhere - `PROUVE`

**Cost impact: None.** One convention spec, no CI minutes of its own.

**Why.** Ulrich's reading of 27 September (under A56 above): `#242` made the
emailed-link walks opt-in because they overran the login limit, `#244` removed
the cause, and `RUN_EMAILED_LINKS` stayed, set by no workflow - so those walks
ran in CI never. `RUN_PAGE_WALKS` repeated it from 27 September until #255. A
remedy landing does not undo the mitigation put in while it was broken, and a
skipped test reads as a deliberate one.

**What holds it.** `apps/api/src/__test__/conventions/env-switched-tests-run-somewhere.spec.ts`
sweeps every `*.spec`, `*.test`, `*.dbspec` and `*.setup` file under `apps/` and
`libs/`, comments stripped, for a variable read inside `.skip(...)` or
`.fixme(...)` or in the condition of a ternary that picks a `.skip`, and fails
unless `.github/workflows` sets it (an `env` key or `NAME=`) or it is declared in
`LEFT_TO_A_PERSON` with its reason. A declaration fails once no test reads the
variable or once a workflow sets it. One is declared: `RUN_BALANCE_JOURNEY`,
because journey 7 consumes a parcel on the environment it runs against.

**Proof, each mutation confirmed applied before it was read:**

- the `RUN_EMAILED_LINKS` switch put back into `emailed-links.spec.ts`: fails,
  naming it;
- the same switch with `RUN_EMAILED_LINKS: '1'` added to a `ci.yml` job env:
  passes;
- `RUN_BALANCE_JOURNEY`'s declaration removed: fails, naming it;
- a declaration for a variable no test reads: fails;
- `RUN_BALANCE_JOURNEY: '1'` added to a workflow: the declaration fails as stale;
- the ternary removed from `balance-journey.spec.ts`: the declaration fails as
  unused.

A first attempt at the two workflow mutations matched nothing and came back
green; it was discarded and redone with an edit that asserts it changed the file.

**Not covered, on purpose:** a skip decided by a value read into a local first
(`const on = process.env.X; test.skip(!on)`), and Playwright project selection in
`playwright.config.ts`. Neither shape exists in the repository today.

### C20 - SES production access - `PROUVE`

**Cost impact: None.** A reading.

`aws sesv2 get-account` on 28 September: `ProductionAccessEnabled: true`,
`SendingEnabled: true`, `EnforcementStatus: HEALTHY`, `ReviewDetails.Status:
GRANTED` (case 176441524300857, mail type `TRANSACTIONAL`, site
`https://kambriq.com`). Quota 50 000 per 24 hours at 14 per second; 636 sent in
the previous 24 hours. Production access is per region, and `envs/prd` (unmerged,
`ops/d2-envs-prd`) is planned in the same account and in `eu-central-1`, so prd
needs no request. The identity is the `kambriq.com` domain, verified.

**What AWS asks about bounces and complaints, and what we have.** The account
suppression list is on for `BOUNCE`, `COMPLAINT` and `OPTIMIZED`, so SES stops
sending to an address that hard-bounced or complained. There is no configuration
set and no event destination (see "Per-address delivery is not a thing
CloudWatch can tell you" in `CLAUDE.md`), so the application never learns that
an address bounced: an invitation to a mistyped address fails silently from the
product's side. That is the gap to close before real clients, not access.

### #48 prd trust - the trust it adds is not the one the prd plan needs - `A DECIDER`

**Cost impact: None.** Nothing merged, nothing applied.

The seventeenth queue asked to merge infra #48 on the grounds that no job can
present `environment:prd` until a GitHub environment named `prd` exists. Measured
on 28 September, both halves of that are different:

- **`prd` exists**, created 24 February, with no protection rules. What keeps
  the trust unusable today is that nothing on develop can select it: the apply
  and smoke-test workflows offer `shared` and `dev` only, on develop and on
  `ops/d2-envs-prd`.
- **#48 targets the apply role, and the prd plan no longer uses it.** Since D16 a
  plan job runs under `<env>-plan` and authenticates as
  `kambriq-infra-github-actions-plan`, whose live trust is `dev-plan` and
  `shared-plan`. #46's Plan (prd) fails at "Credentials could not be loaded"
  because `prd-plan` holds no `AWS_ROLE_ARN` secret; the trust would refuse it
  next. Merging #48 fixes neither, and the trust only changes at a shared apply.

**An environment was created by a push.** `prd-plan` appeared at 21:02:47 UTC on
27 September, the second a rebased #46 was pushed and its Plan (prd) job
referenced it: GitHub creates an environment a job names. It is empty. Removing
it, or giving it the plan role's ARN, is a repository setting and Visquis's.

### C22 - where the Actions minutes go, measured before the private switch - `A DECIDER`

**Cost impact: the subject itself.** Measured, nothing switched off.

**Method.** Every run created in September (to 27 September inclusive) and every
job attempt (`filter=all`) of both repositories, from the REST API: 560 webapp
runs and 6 355 jobs, 122 infra runs and 445 jobs. Minutes counted two ways -
per job rounded up to the minute (how private-repository minutes are billed) and
exact. **The totals do not close against the billing page**: webapp 8 030
rounded / 6 076 exact against the $45.55 bill (~5 694 minutes at $0.008), infra
478 / 182 against $2.77 (~346). The bill is between the two models for both and
matches neither; the page may lag by a day. What follows uses rounded minutes,
because that is what October will be charged on.

**Where it goes (webapp).** Pushes to develop: 207 runs, 5 701 minutes (71 %),
27.5 minutes each. Pull requests: 343 runs, 2 327 minutes, 1.5 runs and 10.5
minutes per PR. **One merge costs ~38 minutes end to end.** By job: deploy to dev
2 047, Quality 1 132 (plus 781 for the old four-job matrix, early September), E2E
825, API image 613, journeys 521, "What changed" 503, web image 458, commitlint
435, database suite 382, CI Gate 331. Infra: the plan on pull requests is 83 %.

**Redundant - minutes that protect nothing:**

- **Sub-minute jobs billed a full minute.** 1 758 jobs ran under 60 seconds -
  "What changed" 503, commitlint 406, CI Gate 331 and others - billed 1 758
  minutes for 666 minutes of work: ~1 090 minutes of rounding. Folding the small
  decision jobs into a job that runs anyway removes it; this is `CLAUDE.md`'s
  "billed per job, rounded up" entry, measured.
- **Superseded runs not cancelled.** 29 runs kept going after a newer run started
  on the same branch; 243 minutes spent after the newer one began, 215 of them on
  develop. Ten runs were cancelled in the month. A `concurrency` group with
  `cancel-in-progress` on pull requests is free; on develop it needs care (A32
  reads the head's run).
- **Re-run attempts**: 676 minutes, most of them re-runs of whole jobs after a
  flake or an A32 refusal (Quality 176, deploy 89).

**Deliberate, and a decision rather than a redundancy - documentation-only
merges run the whole delivery.** 37 of 207 develop pushes changed only `*.md` or
`docs/`, and spent 878 minutes (23.7 each) rebuilding both images, redeploying
and re-running the journeys and E2E on unchanged code. `ci.yml` does this on
purpose: "What changed" reports `code=true` on every develop push so that the sha
dev serves always equals develop's head, which every proof on dev gates on. The
878 minutes buy that invariant. Keeping it for less is possible - for instance by
retagging the previous images with the new sha instead of rebuilding - but it is a
change to what a proof may assume, and not a free cut.

**Expensive and protecting something - not proposed for removal:** the develop
deploy (9.9 minutes, and it is what every proof reads), the delivery journeys
(3.4, what A32's gate reads), E2E (3.9: the walks, I45 and I46), Quality (3.0:
lint, both typechecks, every unit and convention test), the database suite (2.0:
the triggers and constraints), the two image builds (2.4 and 2.3).

**The arithmetic.** September averaged 327 rounded minutes a day across both
repositories; the week of 21-27 September averaged 602. On the free plan's 2 000
private minutes, that is **6.1 days at September's rate - out around 7 October -
and 3.3 days at the last week's pace, around 4 October**, well before the 19
October opening. The "hundred a day" estimate read the included-minutes counter,
which stops at 3 000; consumption ran past it.

**Of that, this repository's own record-keeping is a visible share**: a round's
closing register PR is a documentation-only merge, and this entry arrived in one.

**Corrected on 28 September, and the correction is mine.** The first count read
every job listed under a run, and GitHub lists the jobs a re-run **reused** under
the new attempt with new timestamps although they did not run again. Excluding a
job whose name, start and end repeat an earlier attempt's:

- webapp: **7 522 minutes rounded, 5 738 exact**; the bill implies ~5 694 - 0.8 %
  from the exact figure, so **the bill is exact minutes, not per-job rounding**.
  Infra: 472 rounded, 181 exact, against ~346, which still does not close;
- re-runs: **80 exact minutes, not 676**. 70 of the re-run runs re-ran only the
  CI Gate after an A32 refusal (9 minutes in all) - its designed use. The one
  repeating failure is the delivery journeys failing a first attempt five times
  (14, 15, 18 and twice on 25 September): a flake to find, not minutes to save;
- the 1 591 sub-minute jobs did 609 minutes of work; per-job rounding would bill
  them as 1 591, **only once a repository is private**. The infra brief measured
  in September that public repositories report `billable.UBUNTU.total_ms = 0`;
- superseded runs: PR runs are cancelled since #95 (9 September); the four that
  were not (32 minutes) predate it or were throwaway proofs. Develop is never
  cancelled, on purpose, because its run migrates, deploys and bootstraps.

So the "about 2 000 free minutes" in the eighteenth queue rested on my first
count. What folding the small jobs could recover is part of 609 exact minutes, the
CI Gate cannot be folded without weakening A32 (it must run last, `always()`), and
with the repositories staying public the saving is USD 0. `ci.yml` is unchanged.

### C24 - the application learns that an address bounced - `PROUVE`

**Cost impact: None measurable.** A configuration set, an SNS topic and HTTPS
deliveries at dev volume are within the free tier; one table.

**The gap.** The account suppression list stops SES from sending to an address
that hard-bounced or complained, and nothing told the application: an
invitation, a reset or a payment instruction sent to a dead mailbox was recorded
as sent.

**What was built.**

- Infra (`kambriq-infra`, `envs/dev/c24-ses-events.tf`), in two applies so the
  first event has a listener: the configuration set `kambriq-dev-api` and the
  topic `kambriq-dev-ses-events` (SES may publish only from that set in this
  account), the task role allowed to send through the set - SESv2 authorises a
  send against the set it names, so an API naming a set its role may not use has
  every send refused - and `SES_CONFIGURATION_SET` and `SES_EVENTS_TOPIC_ARN` on
  the task (infra #71). Then the BOUNCE and COMPLAINT event destination and the
  HTTPS subscription, once the endpoint is deployed.
- **HTTPS, not SQS**: neither CI role holds any `sqs:` permission, and granting it
  is an `envs/shared` change. The apply role already manages SES and SNS.
- API: `EmailProcessor` names the set on every send and refuses to start on SES
  without it. `POST /email/ses-events` (`@Public()`, 60 per minute) takes SNS's
  `text/plain` body, rebuilds the string SNS signed, verifies it with the
  certificate from an `https://sns.<region>.amazonaws.com/*.pem` URL only,
  refuses another topic, confirms a subscription by calling SNS only, and stores
  one `EmailDeliveryEvent` per recipient - unique on SES feedback id and address,
  so a redelivery is stored once - linked to the account when the address has
  one. `GET /users/:id` carries `emailDelivery`, the latest.
- **Rendered by nothing yet**: the web has no admin screen for an account. The
  field is on the admin read; a screen is the next step.

**Proof, local, each mutation confirmed applied:** 28 tests on the SNS
verification and the service, 3 on the processor, 2 on the admin read. Always
valid signature: 3 fail; no certificate host check: 4; no topic check: 1;
`skipDuplicates` off: 1; subscription confirmed at any URL: 1; send without the
set: 1; start without the set: 1 (a first version did not compile and ran no
test; redone with a mutation that compiles); admin read dropping the issue: 1.

**Pending: the dev proof** - a send to the SES mailbox simulator's bounce address
from an account on dev, the event arriving through SNS, the row, and the admin
read of that account.

**Proven on dev, 28 September.** Infra #71 applied (4 added, 1 changed, 1
destroyed - Terraform's own task-definition revision, replaced), then webapp #261
deployed (`731d432`), then infra #72 applied (2 added): the subscription holds a
real ARN, so the deployed API verified SNS's real signature against SNS's real
certificate and confirmed it (log: "Confirmed the SES events subscription").
Then `POST /auth` for `bounce+c24-1790583943076@simulator.amazonses.com`: 201;
the API log reads `Email sent to ... messageId=010701a0e71eb83e-...` and
`SES BOUNCE Permanent/General for ... messageId=010701a0e71eb83e-...
account=956bd4fb-...`, the same message id; `GET /users/956bd4fb-...` as the
seeded test administrator returned `emailDelivery: {kind: BOUNCE, type:
Permanent, subType: General}` 3 seconds after registration. The account stays on
dev, at a simulator address. Still rendered by no screen: the operator's payment
screen (`payment-detail-content.tsx`, where instructions are sent) is the place
it matters most.

### C26 - the bounce is seen where instructions are sent - `EN COURS`

**Cost impact: None.** One read of the core database per payment detail.

**The gap.** C24 stored the bounce and `GET /users/:id` carried it, for
`ADMIN_GLOBAL` only, and no screen rendered it. Payment operators are
`ADMIN_LANDS` and could not have read it at all.

**What was built.** `findForBackOffice` returns `clientEmailDelivery`: the latest
`EmailDeliveryEvent` for the reservation's client **at the address the client
uses now** - an event for an address since changed is not a fact about this
client. `SendInstructionsAction` shows it above the send.

**Decided: warn, never block; a permanent bounce or a complaint needs an
explicit acknowledgement.** The data supports the distinction: SES's
`bounceType` Permanent means the address does not exist or refuses mail, and a
complaint means the person marked us as spam - mail will not arrive in either
case. Transient means it was refused this time and may arrive. And the send's
consequence decides the rest: the coordinates are published on the client's
authenticated space and the email only says they are available (v03, G3), so a
dead mailbox does not misdirect money. What it does is leave the client
uninformed while the 30-day period starts. So:

- Permanent or complaint: red, with the date and the SES type, saying the client
  will not be told by email and the period starts anyway; the send stays
  disabled until the operator ticks "J'ai prévenu le client par un autre moyen";
- Transient: amber, the date, no gate;
- nothing reported: nothing shown.

A block would leave no remedy - nothing in the back office can correct an
address - and would stop the portal publication the client can still read.

**Proof, local, each mutation confirmed applied:** 4 screen tests rendering the
real `PaymentDetailContent`, 2 service tests. No acknowledgement gate: 2 fail;
complaint not treated as undeliverable: 1; transient treated as permanent: 1;
the screen not passing the issue: 3; the service ignoring the current address:
1; the service never carrying it: 1.

**Pending, and blocked: the browser proof on dev.** It needs a payment whose
client's address bounces, and no product flow produces one: a payment is
requested by its client, who must sign in; an unverified account cannot sign in
(journey 1 asserts it); the bounced account's verification and reset links go to
the address that bounces; an administrator can change roles only, never an email.
Reading the account's reset token from dev's database through ECS Exec was
refused by the permission classifier. Found on the way: verification and reset
tokens are stored in the clear in `VerificationToken.token` - only refresh tokens
are hashed (`auth.service.ts:635`).

### D28 follow-up, the envelope BigInt, and sort as a column - `PROUVE`

**Cost impact: None.** Three guards and a 400 where there was a 500.

Reported on 27 September while merging develop, then fixed here. Each was found
by reading and closed by running.

**A BigInt inside a class instance was a 500.** `jsonSafe`, which every API
response passes through, walked arrays and plain objects only - the prototype
check `Object.getPrototypeOf(value) === Object.prototype`. A class instance is
neither, so its BigInt reached `JSON.stringify`, which throws on one. Reproduced
before the fix as `Expected: 200, Received: 500`, which is what moved this from
latent to live: nothing returns a class instance today, and the first one to do
it would have taken the route down rather than answered wrongly.

The walk now enters any object that does not define its own `toJSON`. That
exception is the whole care: a `Date` has one, and walking it would have sent
`{}` where every `createdAt` in the API belongs, so the Date case is pinned
beside the money case. Three mutations, each failing one assertion: drop the
`toJSON` guard and the Date test falls; restore the plain-object check and the
instance test falls; round past 2^53 and the string test falls.

**The request log masked everything but the path.** D28 put the URL, the query
and the referer through the allowlist. pino-http's serializer also emits route
`params`, and the spread copied them unmasked. Masked now - and writing the test
showed the masking closes nothing on its own: the secret was still in
`req.url`, because `maskUrl` masks the query and the fragment and **not the
path**. A path cannot be told from a credential by looking at it, and the path is
what an access log is for.

So what closes it is a guard that stops the route existing:
`no-credential-in-a-route-path.spec.ts`. Nothing is refused today - all five
credential-bearing links use `?token=` - and the natural way to add the sixth is
`@Get('reset/:token')`. Proved by declaring exactly that on
`auth.controller.ts` and watching it named. **Its first version was wrong in the
usual direction:** a suffix match on `code` flagged `:roleCode`, which identifies
a role and grants nothing. `code` and `key` now match only on their own.

**A client typo answered as a server fault.** `paginationQuerySchema` declares
`sort` as `z.string()`, and twelve sites across nine services spread it into
`orderBy: { [sort]: order }`. Prisma refuses a column its model has not got, so
`?sort=nope` was a 500. Nothing is injectable - Prisma validates the key against
the model - and the defect is the status and the silence.

`sortField(requested, allowed, fallback)` refuses with a 400 that names the
allowed set. **An allowlist per call site, not one shared list:** `examId` is a
real column on one model and a 500 on the other eight, so a single union would
authorise exactly the requests that still fail. It refuses rather than falling
back, because a list ordered by something other than what was asked for is a
wrong answer the caller cannot detect.

**Safe by measurement, not by assumption:** no caller in the web, the journeys or
the e2e suite passes `sort` at all, so every one of the twelve sites has only ever
received the default. Nothing that works today is refused. A sweep fails if a
thirteenth site is written the old way, and a second assertion counts the nine
files it found so the sweep cannot pass by reading nothing.

**Two of the five reported findings are not fixed here, on purpose.** `L3` is
marked `PROUVE` while naming a pending proof, which is a record correction
somebody else owns. And a partly received payment is annulled with its receipts
intact while nothing records that a refund is owed - the code is probably right
and the comment wrong, but which is a product decision.

### A1, A13 and A56 - three of the ten tracker chantiers were already closed - `PROUVE`

**Cost impact: None.** A reading, no change.

These three live in the Drive tracker (`Suivi`, rows 15, 27 and 69) and not in
this file, which is why nothing here said they were done. Read on 27 September
against the merge of develop, and each had been closed by work already landed.

**A1 - close L2, structured logging.** The row asks for three things: confirm on
deployed dev that a log payload arrives as structured JSON fields, remove `%o`
from about 31 files, and quote a deployed line. The second is no longer the plan:
`L3` keeps `%o` and lifts the payload in one `hooks.logMethod`, because
`logging-metadata.spec.ts` already forces every call site into one shape. The
third landed in `#247`, quoted in the `L2` row:

```
{"context":"CleanupScheduler","pattern":"0 7 * * *","msg":"Contact digest cron scheduled"}
```

**One thing left, and it is L3's row rather than A1's.** `L3` reads `PROUVE`
while naming a pending proof of its own, "a field queried in CloudWatch Insights
on dev". By the States table that is `EN COURS`. Either the query gets run and
the clause comes off, or the row changes state. One of the two is wrong today.

**A13 - the five remaining Float money columns.** All five are integer money:
`Land.totalPrice`, `LandReservation.downPaymentAmount`,
`LandPriceHistory.previousTotalPrice` and `newTotalPrice`, and
`KamnetCommission.amount`, all `BigInt`. `no-float-money.spec.ts` carries an
**empty** quarantine list, pinned at zero in both directions. The Floats that
remain are the ones the row said should remain: `latitude`, `longitude`,
`sizeM2`, `pv`, `tpc`.

**A56 - the suite exhausting its own login budget.** `PROUVE` in this file, and
**a real gap was found and had already closed itself.** Measured at develop
`e540c86`: `#242` made the emailed-link walks opt-in at 10:14 because they
overran the limit; `#244` removed the cause at 11:27 and proved it; the opt-in
was still in place and `RUN_EMAILED_LINKS` was set by no workflow, so those walks
ran in CI never. `#246` removed the opt-in twenty minutes after the reading. The
finding was correct when taken and is closed.

**What that leaves worth keeping.** A remedy landing does not undo the mitigation
somebody put in while it was broken. The two are separate commits and nothing
links them, so the mitigation outlives its reason and looks deliberate. When a
chantier's fix lands, the thing to check is not the fix but what was switched off
waiting for it.

### A4 - the one KAMNET service with no test, and it is the money one - `EN COURS`

**Cost impact: None.** Fifteen unit tests.

**What the row said and what is left of it.** It named five KAMNET business
services with no unit test. Four now have them: agents, applications, leads and
network carry eleven specs between them. `commissions.service.ts` had none, and
a commission is what an agent is paid, so an untested write path there is the
missing-commission defect in this catalogue waiting to happen again.

**Closed here:** `commissions.service.spec.ts`, 15 tests. Five were watched
failing, one mutation at a time, each naming its own assertion:

| Mutation                                     | Result                                                      |
| -------------------------------------------- | ----------------------------------------------------------- |
| `BigInt(dto.amount)` becomes `dto.amount`    | 1 failed - stores the amount as integer money               |
| the caller's `agentId` loses to the filter's | 1 failed - keeps the caller when a status filter is added   |
| `paidAt` stamped on every transition         | 1 failed - stamps paidAt on PAID and on nothing else        |
| `_sum.amount ?? 0n` becomes the raw null     | 1 failed - answers an empty ledger with integer zero        |
| the transition guard disabled                | 3 failed - the three transition tests, which all rest on it |

**Pending, and it is an arbitration rather than a test: nothing computes a
commission.** `tpc` appears in exactly two places outside generated code, the DTO
bounds and the `create` that stores it verbatim. So `amount` is whatever an
administrator keys, `pv` and `tpc` are recorded beside it and read by nothing, and
the two cannot disagree because nothing compares them. The schema says as much:
"managed manually by administrators, with automated calculation planned". The row
named "paliers de commission" as the rule to test and **the rule is not in the
code**, so it is not something a test can be written against without inventing
it. **Question for Visquis: what is the commission formula, and what is the base
it applies to?** Until that is answered the spec pins the two factors as stored
and says in as many words that it does not check them.

### A5 - the four journeys in a browser - `EN COURS`

**Cost impact: None here.** The walks that exist were added by develop.

**The row is out of date and the direction is good.** It was written when
`apps/web-e2e` held four specs and no journey walk at all. It now holds seven
plus a session setup, and `#246` added `human-paths.spec.ts`: registration
through email verification to sign-in, forgotten password through the emailed
reset to sign-in, KBS enrolment with an identity document, and the back office
taking a deposit from request to validation. `emailed-links.spec.ts` walks the
invitation link and the email-change link.

**Two of the row's four are still not walked in a browser:** the candidate's
certification path, exam to certificate, and an agent creating a reservation.
The API journeys cover both, which is why this is `EN COURS` and not urgent -
the row's own argument, that the critical paths are held one layer down, still
holds for exactly these two.

### A21 - the Jest worker that does not exit - `EN COURS`

**Cost impact: None.** Measurement only. No `forceExit` added, no fix fabricated.

**The row says it no longer reproduces. It does.** Measured 27 September on the
merge of develop:

| Run configuration                         | Warnings                        |
| ----------------------------------------- | ------------------------------- |
| full api suite, default workers           | 2 of 4                          |
| 8 resource-holding specs, default workers | 1 of 18                         |
| the same 8, `--maxWorkers=1`              | 0 of 18                         |
| the same 8, `--detectOpenHandles`         | 0 of 3, and **no handle named** |

**A narrowing offered and withdrawn.** On the first hit in the 8-spec subset this
was written up as "the handle is in these eight files, and it needs more than one
worker". Twelve further pairs then gave 0 and 0 in both arms. So the subset rate
is 1 in 18 against 2 in 4 for the full suite, which argues the opposite of the
narrowing: whatever this is, those eight specs are probably **not** where it
lives, or it depends on total load rather than on any one file. The serial arm
proves nothing either at that sample size.

**What is actually established, and all of it.** The warning is real and current,
roughly half of full-suite runs. `--detectOpenHandles` reports **no open handle**
at all - and that flag implies `--runInBand`, so it removes the parallelism the
warning appears under. The one instrument that would name a handle cannot observe
the condition. That is why this has been parked twice.

**What not to do, because both are tempting.** Do not add `forceExit`: it hides
the warning and proves nothing. Do not name a cause from one hit, which is what
the withdrawn narrowing above did.

**The pending proof is a cause.** The next measurement belongs on the full suite
across worker counts, with enough runs for a rate rather than an observation - at
this frequency, six runs of anything can show zero by chance.

### A34 - every pull request conflicts on CLAUDE.md - `ARRETE`

**Cost impact: None.**

**Still true, and worse than the row records.** The row cites 2 003 lines. This
branch merged develop on 27 September with CLAUDE.md at 3 097 lines on one side
and 2 698 on the other, both having added a new catalogue section in the same
place. It conflicted, as every pair of parallel pull requests does, for the
reason the row gives: the file's own rule says to update it in every pull
request, so every pull request appends to one file.

**Stopped rather than open**, because it closes with `A39` and `A39` is blocked
by a decision that is not ours. See that entry.

### A35 - a green pull request never proves the image builds - `A DECIDER`

**Cost impact: the whole argument.** Stated below, unresolved.

**Read on the merged tree, not taken on report.** `.github/workflows/ci.yml`:
`gate` needs `[changes, commitlint, quality, test-db]`. `build-api` and
`build-web` both carry `if: github.event_name == 'push' && github.ref ==
'refs/heads/develop'`. So a pull request is still never built into an image, and
a change that breaks an image build is discoverable only after the merge. That is
the row unchanged since 17 September.

**The arbitration the row asks for is still open**, and this entry does not
choose it. Two shapes:

1. build both images on every pull request;
2. build them only where an image can break - a change under `docker/`,
   `prisma/`, `libs/common/`, or a lockfile or workspace change.

**What is worth adding, because it makes the second cheap.** The `changes` job
already computes a perimeter exactly this way: it has a `db` output that turns
`test:db` on only for a change under `prisma/` or the database test directory.
An `image` output beside it is the same five lines. So the second option is not
new machinery, it is one more filter in a job that exists.

**The cost note in the row needs re-reading before deciding.** It says GitHub
Actions is unbilled because both repositories are public. `A39` then records, on
22 September, a plan in "Downgrade pending" with the Actions quota exhausted.
Whoever answers this should check which is true now, because the whole argument
in the row rests on it.

### A39 - open the repository to parallel work - `ARRETE`

**Cost impact: None until it resumes.**

**Blocked by Visquis, 22 September, and the block is not technical.** The package
is built and delivered. What stopped it is that its premise - a private
repository - is false while both repositories stay public to the end of the
month. Nothing strategic enters the repository until then. Reminder set for
1 October.

**Recorded here because `A34` waits on it**, and because this file is the one a
session loads. Until it resumes, a subject is taken by a draft pull request whose
title starts with the identifier, and the owner is noted in the tracker.

### A42 - Next 16.3 and sharp 0.35 - `A DECIDER`

**Cost impact: None.**

**The upgrade is done and was not done by this chantier.** `next` 16.3.6 and
`sharp` 0.35.4 are in the lockfile; the versions landed on 23 September in `#176`
and Claude Code refused to file a duplicate, which was right.

**One question, and only one.** The row's proof asked for a page-by-page
comparison before and after the upgrade. It cannot be taken: the earlier build no
longer exists. So either today's pages become the reference, or the row closes
without that proof and says so. **Visquis's call.** It is not a code question and
nothing in the repository can answer it.

### I45 - the front door: two emailed links led nowhere - `PROUVE`

**Cost impact: None.**

**The defect** (found by D28's control, 26-27 September): `users.service.ts`
emailed `${FRONTEND_URL}/auth/set-password?token=` - the invitation every
client an agent reserves for receives, and every invited account - and
`${FRONTEND_URL}/auth/confirm-email-change?token=`. Neither page existed; both
answered **404** on dev. A new client clicked, and landed on an error.

**Why nobody saw it** (Visquis, 27 September): the journeys take the token out
of the mailbox and call the API, which was always fine. The exact path a person
takes is the one path the proofs did not touch - by construction.

**The fix:**

- **Invitation:** links to `/reset-password?token=`, the page that already
  consumes a `PASSWORD_RESET` token (the invitation's type) and posts it to
  `POST /auth/reset-password`, which also marks the address verified (R2).
- **Email change:** a new page, `/account/confirm-email-change`, behind the
  `/account` prefix because the API binds the token to the account that asked.
  It posts the token through the existing `confirmEmailChange` action (written,
  never called by any page), and on success - the API has revoked every
  session - its button signs out and goes to the login page, for the new
  address. Its words are `auth.verifyEmail`'s: no new copy.
- **The login detour keeps the query.** The proxy put only the pathname in
  `callbackUrl`, so a signed-out person clicking the confirmation came back
  without its token. It now passes `pathname + search` through the same
  `safeCallbackUrl`; D28's allowlist writes `callbackUrl=[redacted]`.
- **The journeys** found the invitation by `set-password?token=`; now both the
  invitation and the reset email link to `/reset-password`, so
  `findTokenInMailbox` takes an optional subject, and journey 5 still proves the
  forgot-password email and not the invitation.

**The guard, inverted:** `emailed-urls-resolve.spec.ts` finds every URL built on
`FRONTEND_URL` in the API and `libs/common` by reading the source (7 today:
`verify-email` twice, `reset-password` twice, `mylands/payment/:id` twice, and
the confirmation), and checks each against the web's `page.tsx` tree - route
groups dropped, `[id]` as one segment. No list of URLs; an `EXEMPT` map with a
reason per entry, empty, and itself checked for stale entries.

**Proof, red first:**

- the guard failed naming exactly `/auth/set-password` and
  `/auth/confirm-email-change`;
- `proxy.spec.ts` "keeps the query in the callbackUrl" failed without the proxy
  change;
- the page's spec (token posted, success, refusal, no token);
- **in a browser, against dev before the fix** (`apps/web-e2e/src/emailed-links.spec.ts`,
  Chromium): the invitation's link, read out of the delivered email, answered
  **404**; the confirmation's link stayed on `/auth/confirm-email-change`
  instead of reaching the login page.

**First deploy (`33dfe11`), 27 September - the invitation proven, the email
change not, and develop's E2E red.** In the E2E run after the deploy, **the
invitation walk passed in Chromium and Firefox**: the link from the delivered
email, a password set on `/reset-password`, a sign-in. The email-change walk
failed in every browser, and it found the next defect: after the login detour
the browser landed on `/en/mylands`, not back on the confirmation. **The login
never read `callbackUrl`** - `logInAction` signed in with `redirectTo: '/'`, a
literal, as P3 had written down ("nothing reads it today"); the proxy's
`callbackUrl`, with or without its query, went nowhere. Every protected link a
signed-out person follows loses its destination, not only this one. WebKit's
failures were the rate limit: each walk signs in several times, three browsers
from one runner address exhausted it, and WebKit's own login test failed with
them.

**Second change (#240):** the login page passes the URL's `callbackUrl` to
`logInAction`, which signs in with `redirectTo: safeCallbackUrl(callbackUrl, '/')`

- P3's guard, so only an internal path; `login-callback.spec.ts` (red first:
  the person was not sent back; four external shapes go home). The emailed-link
  walks run in Chromium only - one browser proves a link.

**Third change (#241), and proven.** After #240 the email-change walk reached
the confirmation and failed on the test's own locator (two buttons on the page -
the app shell has its own) and then on the old address's refusal, which the API
answers **400** "Email ou mot de passe invalide", not 401. Both corrected in the
test. **Proven on dev (`sha-61388d9`), 27 September, Chromium, from the
delivered emails: 2 of 2** - the invitation's link, a password set on
`/reset-password`, a sign-in; the confirmation's link opened signed out, the
login page, back to `/account/confirm-email-change?token=…`, confirmed, the
button signing out, the new address signing in, the old one refused. WebKit's
own login test is green again (187 passed on `1f09ed7`, the one failure being
this walk's locator).

**Made opt-in the same day (#242).** On the deploy of `e4fdfd4` the E2E run
failed again, on sign-ins this time: the API log shows `/auth/login` answering
**429** during the run (5 between 08:05 and 08:10 UTC). The login is limited to 10
a minute per visitor, the whole suite signs in from one runner address, and the
two walks add seven sign-ins - the last sign-in to come failed, Firefox's own
login test among them. The walks now run with `RUN_EMAILED_LINKS=1`, like
journey 7; they were proven 2/2 on dev, and `emailed-urls-resolve.spec.ts`
checks every emailed URL on every pull request. A continuous browser walk costs
sign-ins the rate limit counts - part of the "Journeys bypass the page"
decision.

### Journeys bypass the page - `A DECIDER`

**Cost impact: None.** A finding, asked for by the tenth round.

Visquis asked whether any other journey proves something by calling the API on
a path a person reaches through a page. **Several:**

| What the journey proves                                      | How it proves it                                                 | The page a person uses                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------- |
| email verification (journeys 1, 2, 3; web `auth.spec` login) | token from the mailbox, `POST /auth/verify-email`                | `/verify-email`                                       |
| forgot-password (journey 5)                                  | token from the mailbox, `POST /auth/reset-password`              | `/forgot-password`, `/reset-password`                 |
| the invitation (journeys 4, 7)                               | same                                                             | `/reset-password` - **walked in a browser since I45** |
| KBS identity document and enrolment (journey 3)              | presigned PUT, `PATCH /users/me/id-document`, `POST /kbs/enroll` | the candidate pages                                   |
| every back-office payment step (journey 7)                   | `POST /lands/admin/payments/:id/...`                             | the payment screens                                   |

Each API path is proven; none of those pages is. I45 was the case where the
difference was a 404. Which of the others deserve a browser walk - and at what
cost in run time and dev data - is a decision, not a fix squeezed into I45.

### C17 - a WAF before production opens - `DECIDE, A FAIRE`

**Cost impact: about USD 5 a month for the web ACL plus USD 0.60 per million
requests and the log ingestion - production's volume, not measured yet.**

Decided by Visquis on 27 September as the production half of D28: a WAF on the
production load balancer, logging with the **query string redacted by AWS at
write time** (`RedactedFields`), retention **30 days**, stated in the privacy
policy. A must-do before opening. Production is his; nothing here is to be
applied from this register. The dev half - application logging with an
allowlist - is D28.

### D28 - no HTTP access log answers who, what, when, from where - `PROUVE`

**Cost impact: none today; the options below cost from USD 0.2 to about 6 a
month on dev.** Nothing was switched on.

**The brief, eighth round:** no access logs on the load balancer, no
CloudFront, no WAF, and the containers do not log requests; on the day of an
incident, who called what, when, from where and how many times cannot be
answered. Two reservations: every sensitive parameter masked **at write time**,
with the control taken afterwards; and the retention decided **before** anything
is switched on.

**The premise is half right, read on dev on 26 September.**

- **The API already has a request log**, and has had one since before this
  round: `pinoHttp` with `autoLogging: true` writes one line per request into
  `/ecs/kambriq-dev-api` (7-day retention): method, path, query, route params,
  status, response time, correlation id, headers with `authorization`, `cookie`
  and the caller secret redacted (A46). A55's row said "the containers log no
  request URL"; that is true of the web container only, and the row is corrected.
- **Its seven days hold nothing sensitive in a URL.** Logs Insights over
  232 115 lines: the query strings are `limit`, `page` and `depth` and nothing
  else; the only URL matching `passw|token=|secret|code=` are the paths
  `/api/v1/auth/reset-password` and `/api/v1/auth/forgot-password`, with no
  query string. A55's conclusion stands.
- **But it cannot say who, or from where.** `remoteAddress` is the load
  balancer's private address and `x-forwarded-for` is the **web task's** public
  address, because every call reaches the API from the web server, not from the
  visitor. No user id is written.
- **The web and the load balancer log nothing** - the web log group holds
  263 KB, all application lines.
- **Five email links carry a credential in a web URL:** `verify-email?token=`
  (twice), `reset-password?token=`, `auth/set-password?token=` and
  `auth/confirm-email-change?token=`. Any web access log that writes the raw
  URL writes them - a reset link is an account, for as long as it is valid.

**Volume:** the dev load balancer served **175 625 requests** in the seven days
to 26 September (about 760 000 a month); the API log group stores 51.5 MB.

**The options, against the two reservations.**

| Option                                                                   | Masked at write time?                                                                                                         | Who / from where                                                                          | Dev cost a month                                                   |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| ALB access logs to S3                                                    | **No** - the load balancer writes the raw URL, tokens included; masking would be a later pass, which the reservation excludes | client IP, status, bytes                                                                  | cents                                                              |
| WAF on the ALB, count only, logging with `RedactedFields` = query string | Yes, by AWS, at write time                                                                                                    | client IP, country, method, path, headers (no status)                                     | about USD 5.5 (web ACL 5, 0.60 per million requests) + 0.6 of logs |
| **In the application (proposed)**                                        | Yes - the line is built by our code with an allowlist of query keys                                                           | visitor IP (A45 already vouches for it), account id, method, path, status on the API side | about USD 0.2 of log ingestion                                     |

**Proposed plan (application side, no new AWS resource):**

1. **API:** the request line gains the visitor's address (the one A45 already
   vouches for with `WEB_CALLER_SECRET`) and the account id once authenticated,
   and its `query` and `url` are rewritten by a serializer that keeps an
   allowlist of keys (`page`, `limit`, `depth`, `sort`, `order`, `q`...) and
   writes every other value as `[redacted]`. The existing log gets safer on the
   way.
2. **Web:** one line per page request from the proxy: time, method, path, the
   same masked query, visitor address (first `x-forwarded-for` hop, set by the
   ALB), user agent, correlation id - the id the API line carries, so the two
   join. The five token links are then written `token=[redacted]`.
3. **The control, as A55's:** request each of the five links and a
   `?password=` URL on dev, then search both log groups for the raw values and
   show they are absent - and show the masked line present.
4. **Red first:** a spec per side feeding a URL with a token and a password and
   asserting the written line holds neither; a mutation that drops the
   allowlist fails it.

**Retention proposed (for decision before anything is switched on):**

- **Dev: 7 days**, what both log groups already have - no change, no new store.
- **Production: 30 days.** Long enough for an incident noticed at the end of a
  month (and for a bill question), short enough to limit a store of IP
  addresses, which are personal data. It is also a line the privacy policy
  should state - copy, Visquis's.
- Not proposed: the load balancer's own logs, until the five token links stop
  carrying their token in the query (a change to the auth flows, Ulrich's).

**Why stopped at the plan:** the brief's premise ("the containers do not log
requests") is false for the API, which changes what the subject is - from
switching logs on to widening and masking one that exists, plus a web line.
The standing authorization says to stop on a false premise, and the retention
is to be decided before the switch, not by the one who switches. **Pending
Visquis:** the option (application side proposed), and the retention.

**Decided, 27 September (Visquis).** D28 splits in two. **Dev:** application
logging with an **allowlist** of query keys applied before anything is written -
never a denylist. **Production:** a WAF, recorded as `C17`, a must-do before
opening. **Retention:** 7 days on dev, 30 days in production, and the 30 days go
into the privacy policy - an obligation, not an option.

**Built on dev (27 September):**

- **One allowlist, one module:** `libs/common/src/logging/url-allowlist.ts`,
  no dependency, imported by the API and by the web proxy. `page`, `limit`,
  `depth`, `sort`, `order`, `status` keep their value; every other value is
  written `[redacted]`, and so is any fragment. `q` is not in it: a search box
  receives whatever a person types, an address included.
- **API:** `core/logging/access-log.ts` - a pino-http `req` serializer masks the
  URL, the parsed query and the `referer` (a browser-side call would send the
  page's full URL, token included; none does today - 0 referers in 230 032
  lines), and `customProps` adds `visitorIp` (the address the web vouches for
  under A45, else the load balancer's hop) and `userId`.
- **Web:** the proxy writes one JSON line per page request - `kind: "access"`,
  time, method, masked URL, `visitorIp` (last `x-forwarded-for` hop), `userId`,
  user agent - before any branch, so redirects are recorded too. No status: the
  proxy runs before the page. Assets are not logged: the proxy's matcher sees
  only the URLs the site serves.
- **Retention:** 7 days, what both log groups already have. No infra change.

**Proof, red first:** `url-allowlist.spec.ts` (10), `access-log.spec.ts` (5,
through the real pino-http over a real socket: the five credentials absent from
the whole line, the vouched visitor named, the account named, the wiring in
`app.module.ts`) and `proxy-access-log.spec.ts` (7, the proxy run with the five
links and a password) all failed before the modules existed. A mutation turning
the allowlist into a denylist (`token`, `password`) fails two - the login
`email`, and the key nobody has thought of yet.

**Proven on dev, 27 September (image `sha-7197137`, API and web).** The
control, A55's method, with unique markers (`D28M-n-1790485495`):

- web: the five links (`verify-email`, `reset-password`, `auth/set-password`,
  `auth/confirm-email-change`, each `?token=<marker>`), `/fr/login?email=…&password=<marker>`
  and `/fr/lands?page=2&zzz=<marker>`;
- API: `/api/v1/lands?limit=5&token=<marker>`, and a call whose `Referer` was
  `/fr/reset-password?token=<marker>`.

**Markers found afterwards: 0 in `/ecs/kambriq-dev-web`, 0 in
`/ecs/kambriq-dev-api`** (`filter-log-events`, pattern `"D28M"`). And every one
of those requests **is** in the logs, masked: `/fr/verify-email?token=[redacted]`,
`/fr/login?email=[redacted]&password=[redacted]`, `/fr/lands?page=2&zzz=[redacted]`,
`/api/v1/lands?limit=5&token=[redacted]`, referer
`https://dev.kambriq.com/fr/reset-password?token=[redacted]` - each with the
caller's address in `visitorIp`. A signed-in API line reads, for instance,
`PATCH /api/v1/users/me/id-document userId=da29c88a-… visitorIp=4.154.40.4
status=200 196 ms`: who, what, when, from where, and how it ended. Insights
lagged ingestion by several minutes and first showed 0 records scanned on the
web group; the search that counts was made directly on the log events.

**Found by the control:** `/fr/auth/set-password` and
`/fr/auth/confirm-email-change` answered **404** - see "Invitation link 404".

### J12 - the sign-in forms refuse in the reader's language - `PROUVE`

**Cost impact: None.**

Found by A33: the French sign-in page answered an empty submission with "Please
enter a valid email address" and "Password is required". The five forms under
`(auth)` - login, register, forgot-password, reset-password, reactivate - took
their refusals from `validations/schema/auth.ts`, written in English.

**Now the schemas carry keys, never sentences** - the pattern the contact form
(L1) already used - and the eleven keys live in both catalogues under
`auth.validation`. Each form renders a refusal through `t('validation.<key>')`.
The register form's phone refusal, which came from `phone.ts`'s English
default, is keyed too. **The French copy is mine, for Visquis.**

**Proof, red first:** `auth-messages.spec.ts` drives every refusal the five
schemas can produce and requires each to be a key in both catalogues - against
develop it failed in both languages. `refusals-in-reader-language.spec.tsx`
submits the sign-in page empty: "Saisissez une adresse email valide." in French,
"Please enter a valid email address." in English; with develop's page and
schema put back, both fail; with the translation wrapper removed on sign-in,
both fail.

**Not in this subject:** `phone.ts`'s English default still serves the
signed-in account and prospect forms, and the rest of I43's hardcoded-copy
debt stays on its list.

**Proven on dev, 26 September, web `sha-a19d680`** (four `/health` samples of four), in Firefox: submitting `/fr/login` empty shows "Saisissez une adresse email valide." and "Le mot de passe est requis."; `/en/login` shows "Please enter a valid email address." and "Password is required.".

### A33 - Safari is tested again, with its cause - `PROUVE`

**Cost impact: small.** WebKit adds one browser to the E2E job on develop runs.

**The cause, named before anything changed.** WebKit's sign-in test failed on 4
of 8 develop runs, the click sending no request, while 20 local runs passed. The
old traces had expired, so it was reproduced instead, the way A51 named
Firefox's: hold the page's scripts, type, release them. In **both WebKit and
Chromium**, against dev on 26 September, the two fields went from filled to
empty when the page hydrated; the click then showed "Password is required" and
sent nothing. The fields were controlled inputs (`Controller`, defaults `''`),
and hydration writes the state over the DOM. WebKit on the CI runner was simply
the engine slow enough to hydrate after Playwright had typed; locally everything
hydrated first. **Not a WebKit defect, and not the test's: a product defect**,
and a real one - somebody on a slow iPhone who types before the page is ready
loses what they typed and the button appears to do nothing.

**And a worse one beside it.** A tap on the button before hydration is a native
submission, and the form had no `method`: WebKit sent
`GET /fr/login?email=...&password=...`. The password in the address bar, the
history and every access log. Six forms holding a password had no `method`.

**The fix, not a re-run:**

- the sign-in email and password are uncontrolled (`register`), with no default
  for either - a default is written into the field when it registers, which
  would erase the typed text again;
- every form that holds a password declares `method="post"` (six); a hydrated
  page is unchanged, its handler preventing the native submission, and a tap
  before hydration is now a POST to the page, with nothing in the URL;
- `password-forms-post.spec.ts` fails on a password form without it (red: it
  named the six);
- two e2e tests hold the scripts: what is typed before hydration survives it,
  and a tap before hydration never puts the password in a URL. **Against dev's
  old form both fail in all three engines; against a local production build of
  this branch all six pass;**
- WebKit is back in the CI matrix, with the cause written at the line.

**Found, not changed:** the validation messages on the French sign-in page are
English ("Please enter a valid email address", "Password is required").

**Proven, 26 September:** develop's own run on `8637543` (#214), run
`36246336133`, E2E job: 62 WebKit tests ran, including both ordering tests and
the sign-in that failed on 4 of 8 runs in September; 186 passed, none flaky, no
retry. **One run is not a flake rate**: the deterministic ordering tests are the
proof of the cause, and the next develop runs will show whether anything else
remains.

### Locale switcher coverage - `PROUVE`

**Cost impact: None.** A component already in the tree, mounted in one more
place.

`QuickActions` carries the only language control on the public site and is
imported **by each page that wants it**: `/`, `/plan`, `/methode`, `/blog` and
the four `/products/*`. `/contact`, `/about`, `/faq` and the four `/legal/*`
pages have none.

It predates wave 5 and that wave is what makes it matter. A cookie carried the
choice from page to page, so a visitor who switched once stayed switched; a URL
does not. An English visitor who arrives on `/fr/contact` from a search result -
which is now a real URL a crawler can hold - has no way out of French.

**Not repaired inside wave 5 on purpose.** Moving a floating control into shared
chrome changes the public site's layout on fifteen pages, which is a design
decision rather than a routing fix, and making it silently while renaming every
route would have buried it.

**J4 / P16, 26 September - repaired without the design decision.** The
component is mounted where it was missing, exactly as the other pages mount it:
beside the footer on `/contact`, `/about`, `/faq` and the certificate verdict,
and once in `legal/layout.tsx` for the four legal pages. The floating control
is not moved into shared chrome, which is the layout decision this entry set
aside. `language-switcher-coverage.spec.ts` walks every page under
`app/[locale]` outside `(app)` and `(auth)`, and requires `QuickActions` in the
page or a layout above it, unless the page is declared exempt with its reason
(the catch-all 404; `/kamnet/apply`, behind the login wall). **Watched red on
develop:** it named exactly the eight pages. Removing the legal layout's mount
fails it on the four legal pages.

**J4's other half, as first left (superseded below): emails.** Emails follow the account's
`preferredLanguage`, which the account preferences card already sets
(`account-preferences-card.tsx`). The floating switch only changes the page's
language. Making it also rewrite the account's stored preference would change a
setting the person did not touch where it lives, and it would mean nothing for
the anonymous visitor this repair is for. So the two stay separate: a person who
wants English mail sets it on their account. If Visquis wants the page switch to
carry to email, it is a product decision about a stored preference.

**J4's second half - Visquis, 26 September: the switch carries to the
account.** His reasoning: someone who switches does not tell the page from their
account. They switched to English; they expect English, and that includes the
mail. So the paragraph above is overruled, and it stays as the reasoning he
decided against.

- `followLanguage` (`lib/actions/account.ts`) reads the session first. No
  session, or one that can no longer be refreshed, is a visitor: nothing is read
  or written, and a language switch never becomes a sign-in redirect. A
  signed-in person whose account already has the language is not written
  either.
- `useSwitchLanguage` (`hooks/use-switch-language.ts`) is the only switch on the
  public site and on the sign-in screens. It asks the account to follow, then
  navigates. **A write to a stored preference caused by a click read as
  temporary is made visible**: on the page the switch lands on, in its
  language, a toast says the account and its emails are now in that language,
  with a "My profile" action to the preferences card where it is undone. A
  failed write is said as well, never passed over: the page changes, the
  account does not, and the person is told which.
- The notice crosses the navigation in `sessionStorage`, keyed to the locale
  switched to. Keying it is not tidiness: without it the effect re-ran on the
  old page and showed the notice in the old language. The spec caught exactly
  that when the effect gained its full dependencies.
- `quick-actions.spec.tsx` also fails when any source file other than the hook
  and the profile card switches the locale, so a new switcher cannot change the
  page and silently not the emails.

Tests: `follow-language.spec.ts` (5) and `quick-actions.spec.tsx` (7). **Fourteen mutations, each watched failing:** no session check, a stale
session trusted, always writing, "saved" without writing, a failure reported as
saved, the page not following, the wrong language sent, a visitor announced, an
unchanged account announced, a save not announced, a failure silent, the
profile link wrong, a switcher bypassing the hook, and the notice read without
its locale.

**Cost impact: None.**

**Proven on dev, 26 September, in Firefox, against web `sha-65521db`** (read
from the web's own `/health`, six samples out of six):

- **a visitor**, on `/fr/contact` and `/fr/legal/privacy`: the switch lands on
  `/en/contact` and `/en/legal/privacy`, `<html lang="en">`, and no notice;
- **signed in** as the throwaway `e2e-login.1790405064949.4715@maildrop.cc`,
  whose stored language read `fr` through `GET /users/me` before: on
  `/fr/contact` the switch lands on `/en/contact`, the notice reads "Your
  account is now in English - Our emails to you will be in English too. You can
  change this in your profile. - My profile", and the stored language reads
  `en`. On `/fr/legal/privacy` the switch lands in English with **no** notice,
  because the account already had it - stored still `en`;
- **the way back**: `/en/account`, "French" on the preferences card, and the
  stored language reads `fr` again. The throwaway is left as it was found.

The coverage half alone was also used on dev as a visitor on `sha-2fbfc5b`,
before #201, with the same landings.

### Built-in 404 above the locale - `PROUVE`

**Cost impact: None.**

An unmatched path **under a valid locale** renders the app's own 404 page:
`[locale]/[...rest]/page.tsx` calls `notFound()` and the boundary is
`[locale]/not-found.tsx`. An unconfigured **first** segment - `/pricing`,
`/de/about` - does not. The root layout refuses it with `notFound()`, and a
`notFound()` thrown from a root layout has no boundary above it to render, so
Next serves its built-in "404: This page could not be found".

**Both answer HTTP 404**, which is the part `P3` and `P4` care about and the part
`not-found-and-robots.spec.ts` asserts. What differs is the page: the branded one
carries links back into the site, and a dead end with no exit is the other half
of the defect `P3` fixed.

Closing it needs `experimental.globalNotFound`, which is `false` by default in
Next 16.3.6 - read from `server/config-shared.d.ts`, not assumed. An experimental
flag that changes 404 handling is not worth a prettier page while the status code
is already right. `locale-routing.spec.ts` pins the difference in both
directions, so it is a known bound rather than something somebody rediscovers.

**Measured on 26 September, and the flag does not close it.** A production
build with `experimental.globalNotFound: true` and an `app/global-not-found.tsx`,
served by the standalone server with its static files, read in Firefox (the
404 page is rendered by the browser from the React payload, so `curl` sees
neither page): `/pricing` and `/de/about` in French and English still showed the
built-in "404", and `/fr/zzz-does-not-exist` the branded page, exactly as dev
does. Adding `dynamicParams = false` on `[locale]` changed nothing either. The
built `_not-found` route does load the global page; **`/pricing` never reaches
it, because every single-segment URL matches `[locale]`** and is answered
through that segment. The branch was discarded; nothing shipped.

**What would close it, and why each is a decision:**

- a route group under `[locale]` whose layout refuses an unknown locale, so the
  branded `not-found.tsx` above it catches the refusal - which means moving every
  page (about 70) into the group, the kind of move the catalogue warns about;
- a redirect of `/pricing` to `/fr/pricing` in the proxy - which P3's positive
  matcher never sees without widening it, and which turns a direct 404 into a
  307 then a 404.

Until one is chosen the status is right and the page is plain.

**P31 - Visquis chose the route group, 26 September.** His reason, recorded: a
real 404 stays a real 404, which matters to search engines and to the site's
honesty, and the proxy keeps the short explicit path list A47 gave it.

**Done in one PR.** All 101 files under `app/[locale]` except the root layout
and `not-found.tsx` moved into `app/[locale]/(site)/` with `git mv` (73 pages;
a route group changes no URL). `(site)/layout.tsx` calls `notFound()` for an
unknown locale: it sits below `[locale]/not-found.tsx`, so the throw is caught
and the branded page renders, with HTTP 404. The root layout no longer refuses:
it renders any segment, in the visitor's language - `localeForSegment` in
`lib/locale.ts`: a known segment, else the locale cookie (their last explicit
choice), else `Accept-Language`, else French. `i18n/request.ts` uses the same
function, and reads the headers only on that branch.

**Proof, red first.** On dev before the change (26 September, Firefox):
`/pricing` and `/de/about` showed the built-in "404". On a local production
build of this branch, served standalone and read in Firefox:

| Visitor | `/pricing`                                   | `/de/about`            | `/fr/zzz-does-not-exist`          |
| ------- | -------------------------------------------- | ---------------------- | --------------------------------- |
| `fr-FR` | 404, `lang="fr"`, "Cette page n'existe pas"  | 404, `lang="fr"`, same | 404, French                       |
| `en-GB` | 404, `lang="en"`, "This page does not exist" | 404, `lang="en"`, same | 404, French (the URL says French) |

with links back into the site in the page's language. **The pages that moved
still work:** all seventeen public pages under `/fr` answered 200 with their
heading and the language switch present; the switch took `/fr/contact`,
`/fr/legal/privacy` and `/fr/products/lands` to their `/en` counterparts with
`lang="en"`; `/fr/login` and `/en/register` answered 200, and `/fr/account`,
`/fr/admin/payments` and `/fr/agent/network` still redirect to the login.

`every-page-refuses-an-unknown-locale.spec.ts` fails on a page placed beside
the group (moved out: fails), on the group layout losing its refusal (fails),
and on the root layout refusing again (develop's layout put back: fails). The
e2e spec that pinned the built-in page is inverted, and asks for the English
404 at `/pricing` with an English `Accept-Language`. Five unit specs that named
page paths follow the move.

**Proven on dev, 26 September, web `sha-e1b965f`** (four samples of `/health`
out of four), in Firefox: `/pricing` and `/de/about` answer 404 with "Cette page
n'existe pas" for `fr-FR` and "This page does not exist" with `lang="en"` for
`en-GB`, links back into the site in that language; `/fr/zzz-does-not-exist` is
the French 404. All seventeen public pages under `/fr` answer 200 with their
heading and the language switch, and the switch takes `/fr/contact`,
`/fr/legal/privacy` and `/fr/products/lands` to `/en`. The inverted e2e spec and its
English case passed in Chromium and Firefox in develop's E2E job after the
merge (run `36244235400`, 120 passed).

### Audit 2026-09-23, wave 6 - SEO - `EN COURS`

**`chore/audit-remediation`, not merged, not deployed.** Pending proof is
`/robots.txt` and `/sitemap.xml` read on dev, and the baseline re-measured there.

**Cost impact: None.** Two generated routes, no resource, no third party.

Measured before anything was written: **no `app/sitemap.ts`, no `app/robots.ts`,
zero JSON-LD anywhere, metadata on 38 of 70 pages.** `lib/seo/robots.ts` emitted
an `X-Robots-Tag` header and there was no `robots.txt` route at all.

Both new routes read `isIndexableEnvironment`, which reads **`APP_ENV`**.
`NODE_ENV` cannot make this decision: `docker/Dockerfile.web` sets
`NODE_ENV=production` on every environment, so dev.kambriq.com reports itself as
production. Absent means noindex, because the two failures are not symmetrical.

Proved by execution against a running app, both branches:

```
APP_ENV unset       robots.txt -> "User-Agent: *\nDisallow: /"
                    sitemap.xml -> an empty urlset
APP_ENV=production  robots.txt -> Allow: /, then every protected prefix
                                  disallowed unprefixed and in both locales
                    sitemap.xml -> 30 <url> entries, each carrying
                                  hreflang fr, en and x-default
```

Canonical and alternates now render on all 15 public pages. The four legal pages
gained metadata; the six auth pages gained `robots: noindex` through a server
layout, because a Client Component cannot export metadata and all six were as
indexable as the home page. The structured data is read from
`config/site.config.ts` and **carries no RCCM number and no share capital**: the
public mentions légales still serves `XXX XXX XAF`, and a placeholder published
as structured data is a false statement about a legal entity that a search engine
will repeat.

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

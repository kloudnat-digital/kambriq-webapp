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

| When                                    | What                                                                                                                                                                                                                                                                                                                                                                                                                                | How                                                                                                                                                                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tuesday 8 September 2026**            | Deactivate `AKIAQYAF4F4JH34UGKU5` (`kambriq-app-dev`). It is the only key left Active besides `vmiaff`'s, and unlike the three deactivated on 4 September it **has** been used — `s3`, 2026-08-27, before `S1` moved storage onto the task role                                                                                                                                                                                     | **Check first, then act.** `aws iam get-access-key-last-used --access-key-id AKIAQYAF4F4JH34UGKU5`. Still 2026-08-27 or older → `update-access-key --status Inactive`. **Anything more recent → stop** and find out what used it before touching anything |
| **When prd exists**                     | RDS `BackupRetentionPeriod` is **0 on dev, deliberately** — what a backup protects is reproducible from `migrate deploy` ×4 plus a restorative seed. **Every word of that argument dies with the first real user account.** Belongs on the `ADR-005` bootstrap checklist as an explicit decision, not a default carried over                                                                                                        | Set a retention period before prd takes traffic                                                                                                                                                                                                           |
| **Next time the RDS module is touched** | `/aws/rds/instance/kambriq-postgres-dev/postgresql` is capped at 7 days, set **outside Terraform** because RDS creates that group itself. It is undeclared state — nothing drifts today, and the next person reading the Terraform will believe every log group is described there                                                                                                                                                  | Move it into `modules/rds-postgres`                                                                                                                                                                                                                       |
| **Before an agent is paid anything**    | `C15` - the council's opinion on **when a commission is acquired**. Reserved to Visquis, in the "avant ouverture" set beside the legal items. Recorded here on 24 September from the 2026-09-21 entry of `ops_kambriq_base-comprehension_v01.md`, because nothing in this repository carried it                                                                                                                                     | Visquis asks the council. `C14` cannot be settled first, because the answer **is** the calculation base                                                                                                                                                   |
| **After `C15`**                         | `C14` - the **commission grid, which does not exist**. The parcel spreadsheet computes on TPC = 6 %, the UX specification announced 3 % on the sale and 1 % on the reservation, and the platform has no rate at all: 5 % lives in three seed literals and a comment. Visquis decided on 19 September that the grid is **never on the public site** and is visible only inside an agent's own space, which is what `P21` implemented | Settle the grid, then implement it once in code rather than in literals. Until then **no surface may state a rate** - that is what `P21` enforces                                                                                                         |
| **Not scheduled**                       | `X2` — the NAT gateway, roughly **$39/month**, the largest line in the bill. Option 2 was decided and deliberately **not applied** before delivery: a shared-state network change days before a delivery trades $35/month against a broken dev                                                                                                                                                                                      | Apply after delivery, with a plan reviewed first                                                                                                                                                                                                          |

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

| Entry                         | State               | What it needs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| `L2`                          | `EN COURS`          | one deployed log line carrying its interpolated metadata, quoted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `L3`                          | `DECIDE, A FAIRE`   | migrate logging to `PinoLogger` structured fields — deliberately **not** shipped before delivery                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `F1`                          | `A DECIDER`         | coverage ratchet: a floor, and what happens when a PR drops below it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `P1`                          | `A DECIDER`         | SES contact list, one per account per region — the prd constraint                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `X2`                          | `DECIDE, A FAIRE`   | NAT option 2, decided, deliberately unapplied before delivery                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `M1`                          | `DECIDE, A FAIRE`   | mutualisation of dev and future prd, with per-resource saving and blast radius                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `Q1` follow-up                | `A DECIDER`         | `generateKcaNumber` says _sequential per day_ and emits a random suffix; `CANDIDATE_KBS` is granted self-service and gates nothing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `D3`                          | `EN COURS`          | the four Prisma baselines, deleted by `d099cd1` and restored here - pending proof is one deploy from this branch whose migration task exits 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `H1`                          | `PROUVE`            | `ADMIN_GLOBAL` is the super admin; no second role created. ADR-008 + `super-admin.spec.ts`, five mutations quoted below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `H2`                          | `PROUVE`            | proven on dev on `f91289f`: `2 created, 0 updated, 0 unchanged`, exit 0, tally read from the task's own log stream                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `H3`                          | `EN COURS`          | journey 5 green on dev under the sha gate; **pending proof is the two real holders activating their own accounts**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `H4`                          | `PROUVE`            | the last active super admin cannot be removed through any of four doors - live 409 on each, four mutations quoted below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `A7`                          | `PROUVE`            | inventory swept 2026-09-06, output in `docs/ops/a7-standards-inventory.md`: 6 findings (2 closed on sight), 7 classes clean, 2 defects in the sweep                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `H2` follow-up 1              | `A DECIDER`         | `deploy-dev.yml` passes `--seed` to `run-migrations.js`, which never reads `process.argv`: the seed step has never seeded anything                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `H2` follow-up 2              | `A DECIDER`         | the bootstrap deploy step checks the exit code and never that the tally line appeared - the same gap the seed step has                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `H5`                          | `PROUVE`            | journey 5's address guard was a detector, not a barrier: it reported and let the run continue into a real inbox. Moved to `beforeAll`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `H6`                          | `PROUVE`            | the same run's `afterAll` revoked a real administrator's role. Every write audited, role restored 16:05:26, guard made structural                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `H7`                          | `PROUVE`            | nothing tested the bootstrap's role assignment - journey 5 granted it to itself. Decision extracted and covered, 11 tests, 3 mutations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `H8`                          | `EN COURS`          | the bootstrap sent no email; a stray test made it look as though it had. Fixed and proven locally; pending the re-send to `contact@` on dev                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `H8` follow-up                | `A DECIDER`         | per-address SES delivery is not observable: no configuration set, no event destination. Needed to answer "did THIS address receive it"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `H9`                          | `PROUVE`            | the bootstrap's provenance check failed a whole deploy and skipped every later step. Postcondition scoped; step moved after the web deploy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `B1`                          | `PROUVE`            | payment code audited against the design: 0 payments ever processed, no payment table, G3/G4 partly built, six of eight not started                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `A10`                         | `PROUVE`            | the identity-review queue did not exist - the route and the role did. Queue route + `idSubmittedAt`; the back-office screen stays open                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `A11`                         | `PROUVE`            | 13 sites, 15 messages, 12 transactional. `sendUpdate` returns an outcome and throws on a transactional template                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `A12`                         | `PROUVE`            | the WhatsApp preference removed from the API and the web, the column kept. A test fails if it returns, or if a sender appears                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `R1`                          | `EN COURS`          | **a merge can succeed and have no effect.** `#89` merged into a branch consumed 89 s earlier; `#88` was squash-merged, so nothing showed. Pending proof is the three commands in `R1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `G8`                          | `ARRETE`            | **G11-G14 is not on develop and not deployed**: #89 merged into the G9 branch 89s after that branch merged to develop. 51 files stranded at `230b827`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `G8` blocker                  | `A FAIRE`           | re-land `230b827` on develop (**not** conflict-free - see `R1`), deploy, then re-run G8. Until then dev emails every channel's coordinates to whoever clicks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `G10`                         | `PROUVE`            | applied and observed: 16 SecureString parameters none empty, task definition 143 with the three variables and no channel value, 0 AccessDenied                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `G9`                          | `PROUVE LOCALEMENT` | the client creates the payment, from their own purchase page. Creation writes its audit row; sending the instructions is a second act                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `G9` follow-up                | `A DECIDER`         | `PAYMENT_VALIDITY_DAYS` is 30 because a month is the shape of a diaspora transfer. The design gives no number - this one needs deciding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `G10` (webapp)                | `PROUVE`            | an absent channel prefix now fails the boot exactly as an empty parameter does; disabling is `PAYMENT_CHANNELS_TRANSPORT=disabled`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `G10` (infra)                 | `PLAN PRET`         | twelve parameters + the prefix into terraform. Plan run and shown, **nothing applied**. Correction-without-deploy proved on a running process                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |     |
| `G4`                          | `PROUVE`            | the back office and its screen. Five defects only a real request could see; `db:seed` unbroken; deployed-dev pass deferred to `G8`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `G4` follow-up                | `A DECIDER`         | `GetUploadUrlDto` is declared twice with different schemas (lands + kbs); the API logs `Duplicate DTO detected` on every boot                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `V1` follow-up                | `PROUVE`            | the commission lookup throws now but has never run: 0 sales completed, all 5 commissions seeded. Closed by inspection only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `B2`                          | `PROUVE`            | V1 inventory finished: WhatsApp preference reads nothing, `sendUpdate` skips indistinguishably and defaults off, `RedisService` unused                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `B3`                          | `PROUVE`            | 56 dev parameters against 0 on prd; only 7 injected as secrets, so 49 need an apply to take effect. One confirmed unread, the rest candidates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `B4`                          | `PROUVE`            | 4 journeys: VERIFY does not exist; reactivation and block/unblock never run; 57 identity documents queued for a review that has never run                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `G1`                          | `EN COURS`          | payment model in `lands`: BigInt money, 9-state machine, append-only ledger and audit. Pending proof is G8, one payment end to end on dev                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `G2`                          | `PROUVE`            | the reference generator: 29-char derived alphabet, mod-29 check character, sequence-backed so collision-free by construction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `G3`                          | `PROUVE`            | the instruction and reminder messages, channel details from SSM at runtime, send-before-transition. Real email read out of a mailbox                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `G10b` (infra)                | `PLAN PRET`         | sixteen channel parameters; the twelve existing ones imported so `ignore_changes` bites on the first apply. **Apply before merging #88**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `G10b` follow-up              | `EN COURS`          | D9: `MOBILE_MONEY_OPERATOR/NUMBER/NAME` dropped from `FIELDS`, proved locally (boot on the nine, mutation names the MISSING one). Pending: deploy, API task steady and `/health` answering without them; then infra #51 (step 4, three destroys) with validation. Cost: none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `G11-G14`                     | `PROUVE LOCALEMENT` | six channels, the identification gate, A14's review screen, coordinates in the platform. Email carries none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `G11` follow-up               | `A DECIDER`         | infra owes `ORANGE_MONEY_*` and `MTN_MONEY_*`: v03 splits mobile money in two but keeps twelve parameters with one number                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `G11` follow-up 2             | `A DECIDER`         | v03 section 5's example uses a hyphen between reference and channel, which section 4b forbids. 4b implemented                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `A18`                         | `PROUVE LOCALEMENT` | queue counts and failed payloads on `/health/queues`, ADMIN_GLOBAL. `failed` 0->1 observed through the endpoint against a real Redis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `L1-contact`                  | `PROUVE LOCALEMENT` | the public contact form sent nothing behind a success toast. Now persisted, announced, acknowledged in the page's locale; consent stored with its timestamp                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `L2-contact`                  | `PROUVE LOCALEMENT` | a daily digest on the existing core queue, sent even at zero, so its absence is the alarm. Exercised once end to end with a forced zero count                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `L1-contact` f-up             | `A DECIDER`         | infra owes `/kambriq/{env}/api/CONTACT_INBOX_EMAIL`. Until it exists dev stores every request and announces none, loudly                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| naming                        | `A DECIDER`         | the brief's `L1`/`L2` collide with this register's logging `L2`/`L3`. Entries above are `L1-contact`/`L2-contact`; somebody should decide which series keeps the bare letter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `A31`                         | `EN COURS`          | develop red on journeys 4 and 5 from 08:22 UTC on 14 Sept: the seed kept payment-carrying reservations, reset their parcels to AVAILABLE anyway (8 on dev), and the first available parcel answered 409. Fixed in the seed and proved locally. Pending: merge, one seed run on dev, a green journeys run on develop. Cost: none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `verify-cert`                 | `EN COURS`          | `/verify-certificate` said "valide" for any number; the API ignored `revokedAt` and handed strangers the holder's UUID. Pending proof on dev: seeded number valid, fake number non reconnu, revoked number révoqué. Cost: none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `A33`                         | `EN COURS`          | **Safari is not tested.** WebKit removed from the E2E matrix: its login test failed on 4 of 8 develop runs with E2E since A28 (a fifth passed only on retry), the click sending no request; 20 local WebKit runs passed and the cause was not established in the bounded hour. Owed: the cause, then WebKit back. Cost: none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `A32`                         | `EN COURS`          | Gate reads develop's HEAD sha, then its run (`scripts/ci/develop-gate.sh`): green passes; red, never started or not yet verified refuses; label `merge-on-red-develop` plus re-run releases. v1 read a list and passed #134 on a stale run; 12 stub cases run in every CI Gate. Cost: each develop push blocks merges ~20 min                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `A36`                         | `EN COURS`          | develop red on `70a5e07`: both journey suites run in one `runInBand` process from one runner address and `getTracker` keys on the last X-Forwarded-For entry, so they legitimately share one bucket of 100 requests per 60000 ms - the gap between them decides it (9.33 s PASSED on `1cbde1a`; 0.36 s and 0.35 s FAILED on `70a5e07`). `call()` now waits one full window and retries, bounded at 3 attempts, one log line per wait, still throwing today's sentence after them. The comment claiming CI "never sees it" is replaced by the measurements. `getTracker` had no test and now has 11, watched failing on `parts[0]`. The spec runs in `Quality` via a new `test` target, because `api-e2e` had none and the file would otherwise execute only in the job it repairs. Pending: a green `Delivery journeys (dev)` on develop. Cost: up to 120 s added to a journeys job that is actually throttled, none otherwise |
| `I19`                         | `EN COURS`          | no user without a role: registration refused a missing CLIENT row silently, an existing user reserved as a client got no CLIENT, the seed wrote 8 role rows of 11. Fixed, red then green locally. Pending: merge through the gate, then one seed run on dev showing 11 rows. Cost: none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `I15`                         | `EN COURS`          | the certificate is the truth: CERTIFIED only by issuance, `isUserCertified` reads revocation and decides at KAMNET submit and approval, KCA_CERTIFIED not settable by hand, a daily sweep withdraws it on expiry. Dev: 60 holders, 0 without certificate, 0 expired. Pending: merge, first sweep on dev. Cost: none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `I18`                         | `EN COURS`          | one definition of the roles: the literal ban now scans `apps/web` and the e2e suite; 8 codes in 14 web files moved to `RoleCode`. The layout's own ROOT check is deleted (decided 15 Sept); the proxy is the one gate, proven by mutation. Pending: merge through the gate. Cost: none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `I20`                         | `EN COURS`          | any logged-in account read KBS lessons, drafts and outlines through the API (the web never called those routes). Lesson now needs a verified candidate record and a published course; lists and outlines are published-only. Pending: merge, then a no-record call on dev answering 404. Cost: none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `I7`                          | `EN COURS`          | VERIFY is operated by STAFF_VERIFY; ADMIN_GLOBAL now inherits it (one level, listed on ADMIN_GLOBAL itself), pinned before any route uses it. Every super admin therefore reaches identity documents and titles, and no record says which one read what (ADR-008). Pending: merge. Cost: none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `I16`                         | `EN COURS`          | CLIENT in its own right first: dev one-off wrote 5 rows, 5/5 agents now hold CLIENT directly; approval grants it. Then suspension and revocation remove AGENT, lifting returns it if still certified; commissions read by ownership. Pending: merge. Cost: none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `I15` renewal                 | `EN COURS`          | a renewal issues a new certificate (candidateId no longer unique, migration drops one index); the old one stays verifiable. Proven locally through the real API and page: old numbers still Expiré / Révoqué, new ones Valide. Pending: merge, migration on dev. Cost: none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `I21`                         | `EN COURS`          | an exam accepted answers on any pool question: 60 correct answers on a 20-question exam graded 300%, a fail became a certificate, then AGENT. Now the served questions are recorded at start and only those answerable; score capped at 100; late submit refused. Red first on the exploit. Pending: merge via gate. Cost: none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `I31` seuils                  | `EN COURS`          | exam threshold 75 -> 80, module quizzes stay 70 (Visquis, 18 Sept): the certification document governs what is promised to the candidate, the quizzes stay drilling. Neither constant had a single test before - 4 now pin them, and `scheduleExam` is pinned to write the exam constant onto the row, watched failing. Cost: none, verified rather than assumed - `KbsExam.passingScore` is stamped per row at schedule time and `gradeExam` judges that stored column, so no past verdict moves; dev holds 75 exam rows (74 PASSED, 1 FAILED), 0 SCHEDULED or IN_PROGRESS, and 20 certificates each with an exam row behind it. The note saying `KbsExam` was empty and that five certificates had no exam behind them is false on both halves. `prisma/kbs/schema.prisma` still defaults the column to 75, unreachable while `scheduleExam` always writes the constant; left to the KBS foundation subject. Pending: merge  |
| `G6`                          | `PROUVE LOCALEMENT` | the dunning queue, reminders at J-7 and J-1, EXPIRE at the term. Found and fixed a processor collision that silently ate a reminder email                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `R4`                          | `EN COURS`          | back to hosted runners under a spending cap. Baseline measured: 27 billed minutes, of which the quality matrix billed 5 to do 102s of checking                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `R3`                          | `EN COURS`          | CI moved to the self-hosted `kambriq-ci` runner. No `services:` anywhere, so macOS is viable. Exposed three image builds pinning no platform - amd64 held by accident of `ubuntu-latest`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `A17`                         | `PROUVE LOCALEMENT` | a database-backed suite, `pnpm test:db`: 51 tests against a real Postgres; both append-only triggers and all five CHECKs proved sharp by removal and restoration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `G7`                          | `PROUVE LOCALEMENT` | `evidenceReceiptId` filled end to end; NULL deliberate and documented for the other states; the single write path to `Payment.state` pinned, mutation red                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `G5`                          | `PROUVE LOCALEMENT` | a correction entered from the back-office screen: three movements, total 500 000 over four lines, original line unchanged. Correction carries its own reason and author                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `G11` follow-up 3             | `PROUVE`            | the controller never forwarded `paidBy`: a DEPO keyed on the screen was refused by the service. Fixed and pinned here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `P3`                          | `PROUVE LOCALEMENT` | the auth middleware was a global net: every unknown URL redirected to /login and nothing could 404. Positive matcher, real 404 page, route table proved unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `P4`                          | `PROUVE LOCALEMENT` | X-Robots-Tag noindex outside production, on the existing headers() block. Reads APP_ENV: NODE_ENV is 'production' on every environment and cannot tell them apart. Second half (API responses): PROUVE on dev 23/09; P4 stays below 100 % until D13                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `P5`                          | `A FAIRE`           | public product pages link at /kamnet/apply and /kbs/enroll, both behind the login wall. Kept protected by P3 deliberately: widening is a product change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| rename                        | `A DECIDER`         | `L1-contact`/`L2-contact` -> `P1`/`P2` was asked for in P3's brief; those ids exist only on PR #98's branch, which the same brief puts out of scope. Not done - see PR                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `A19`                         | `PROUVE`            | develop linted 1 project of 6 for seven months: the workflow promised "the full set", `pnpm run lint` was `nx lint api`. Widened to `nx run-many -t lint --all`; manifest corrected; proved in both directions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `I32`                         | `A FAIRE`           | `getMyNetwork` never reads the caller's tier; the rule lives in the page. `P9` clamped everyone to N1, so the gap is no longer observable from outside - a narrowed blast radius, not a fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `P10`                         | `A FAIRE`           | `whyKbs.network.description` and `whyAgent.exclusiveAccess.description` still promise an exclusive catalogue reserved to agents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `P21` follow-up               | `A FAIRE`           | the remuneration ban covers a hand-written list of message namespaces and `landTypes` is not in it, so the public LANDS page still carries "Avantages Agent KAMNET / Commission rapide". Derive the list from what the public pages render                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `A41`                         | `PROUVE`            | a rate limit each, chosen from 7 days of measured traffic; `auth-anonymous-routes-throttled.spec.ts` reads the @Throttle metadata, red first on five undefined routes, eight mutations each watched failing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `P22`                         | `PROUVE`            | the public directory reads every certificate in one query, not one per agent, and is bounded by `KAMNET_MAX_PUBLIC_DIRECTORY_ENTRIES` with a warning at the cap; proven on dev at `sha-caf8f98`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Audit 2026-09-23, wave 1      | `EN COURS`          | four security fixes on `chore/audit-remediation`, unmerged. The fifth finding, the API bearer token in the RSC payload, is **closed by wave 5** - `sessionForClient` strips it and `lib/session.spec.ts` plus the login journey pin it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Audit 2026-09-23, wave 2      | `EN COURS`          | `GET /kbs/me` scoped to the active course, `no-console`, `strict` on the API, two seed preconditions. Unmerged; pending proof is `GET /kbs/me` read on dev                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Audit 2026-09-23, wave 3      | `PROUVE`            | the wave of #155 to #162 folded in, the Open table de-duplicated, the states declared, `register-is-the-record.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Audit 2026-09-23, wave 4      | `EN COURS`          | the acompte step reads the payment ledger instead of answering for it. Unmerged; pending proof is one acompte carried end to end on dev                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `confirmRemainingPayment`     | `A FAIRE`           | step 4 records the balance on the reservation alone: nothing creates a payment for it, so it cannot be gated the way the acompte now is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `A48`                         | `EN COURS`          | every API behaviour decision reads `APP_ENV` through `libs/common/src/config/app-env.ts`; SQL is logged only where `APP_ENV=local`; a guard refuses a new `NODE_ENV` read. Pending: dev logs read after deploy - no `prisma:query` line                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `P27`                         | `PROUVE`            | KAMBRIQ LANDS™, KAMBRIQ VERIFY™ and KAMNET™ carry the mark everywhere on the website, KBS does not; a guard watches every namespace and every MDX file; proven on dev at `sha-e059503`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `A44`                         | `PROUVE`            | an avatar is a key in the caller's own storage folder, refused otherwise on both write paths; `connect-src` names the bucket so the browser may upload; proven on dev at `sha-689bd2e`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `A43`                         | `PROUVE`            | Swagger is served only where `APP_ENV=local` is declared, never from `NODE_ENV`; the local start scripts declare it; proven on dev at `sha-7ec907b`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `P24`                         | `PROUVE`            | the land title number is shaped `TF <number>/<department>` and validated by shape in the web form and the API; invented formats replaced; proven on dev at `sha-85c8966`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `P25`                         | `PROUVE`            | the verify price table was the only MDX element outside the component map; two consent sentences were split into columns by a flex label; proven on dev at `sha-828c509`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `I43`                         | `PROUVE`            | ten signed-in screens promised 38 unbuilt features in hardcoded French; the promise is removed and a guard reads every `.tsx`; proven on dev at `sha-383828e`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Audit 2026-09-23, wave 5      | `EN COURS`          | locale-prefixed routing: every page under `[locale]`, `localePrefix: 'always'`, the proxy gate asked positively, the RSC token leak closed, 48 `next/link` and 35 `next/navigation` imports moved to `@/i18n/navigation`, `revalidatePath` given its prefix. Proved locally over HTTP (`/` -> 307 `/fr`, `/pricing` -> 404 not a login redirect, `/de/about` -> 404, `/fr/mylands` -> `/fr/login`) and by 55 browser tests. Unmerged; pending proof is the same table read on dev                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Audit 2026-09-23, wave 6      | `EN COURS`          | SEO: `app/sitemap.ts` (30 URLs, hreflang + x-default), `app/robots.ts`, canonical and alternates on all 15 public pages, JSON-LD where there was none, metadata on the four legal pages and `robots: noindex` on the six auth pages. Both files read `APP_ENV`, never `NODE_ENV`. Unmerged; pending proof is `/robots.txt` and `/sitemap.xml` read on dev                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Locale switcher coverage      | `A FAIRE`           | `QuickActions` carries the only language control and is mounted **per page**, on 8 of the 15 public pages. `/contact`, `/about`, `/faq` and the four legal pages have none. It predates wave 5 and matters more under it: a cookie carried the choice between pages and a URL does not, so a visitor who lands on `/fr/contact` from a search result cannot switch. Moving it into shared chrome is a design decision, so it was not made silently                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Built-in 404 above the locale | `A FAIRE`           | a `notFound()` thrown from the root layout has no boundary above it, so an unconfigured FIRST segment (`/pricing`, `/de/about`) is served Next's built-in 404 rather than the branded one. The status is 404 in both cases. Closing it needs `experimental.globalNotFound`, off by default in Next 16.3.6; pinned as a difference in `locale-routing.spec.ts` rather than left to be discovered                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| develop merged into waves 5-6 | `EN COURS`          | develop's 9 commits merged 25 September: 8 text conflicts, six new page files relocated under `[locale]`, three components moved off `next/link`/`next/navigation`, `revalidatePath` calls given their prefix, `image-hosts.spec.ts` unblocked (25 assertions that ran none), `A41` reconciled. Unmerged to develop; pending proof is the routing table and the sitemap read on dev                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Audit 2026-09-23, unwaved     | `A FAIRE`           | `/admin/verify` and `/kamnet/apply` are mocks behind real roles that toast success and write nothing; the Mapbox build `ARG` reaches no workflow, so the land-search map is dark in every image; `legal/mentions/{fr,en}.mdx` publishes `Capital social : XXX XXX XAF` and `N° RCCM : XX / XXX / XX` on a public page                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| register                      | `A FAIRE`           | twenty-eight rows above have no `###` entry in this file - their detail lives in the tracker or in a wave note. The list is pinned in `register-is-the-record.spec.ts`; writing an entry means removing its line there                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

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
- identity-document addresses are stored as full `https://` URLs (seen in the
  admin user list), whereas the upload route issues keys. That is not A44's
  field.

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

### A48 - no behaviour in the API is decided on `NODE_ENV` - `EN COURS`

**Cost impact: a saving.** Half of the dev API's log volume goes away (below),
and CloudWatch ingestion is billed per GB.

**Pending:** the dev API's log stream read after the deploy: no `prisma:query`
line, and JSON lines at `info`.

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

### Locale switcher coverage - `A FAIRE`

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

### Built-in 404 above the locale - `A FAIRE`

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

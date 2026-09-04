# kambriq-webapp — Agent guide

This file is deliberately narrow. It holds the chantier register and the two
rules that keep it honest. It is not a full architecture guide; do not infer
conventions from its silence.

---

## Chantiers en cours

**The rule: the PR that closes a chantier updates this register in the same
commit.** Not a follow-up commit, not a later tidy-up. A chantier that is closed
in the code and open in the register is worse than one that was never listed,
because the register is then something people learn to distrust.

**The FinOps rule: every chantier states its cost impact, and every added
resource carries its own.** "No cost impact" is an acceptable answer and must be
written down rather than assumed. A resource with no stated cost is not
finished.

**The order rule: work the register in order.** B1, B2, B3, then G1 and G2, then
G3 and G4, then V1 and V2. Do not reorder for convenience.

### States

| State             | Meaning                                                                       |
| ----------------- | ----------------------------------------------------------------------------- |
| `A DECIDER`       | Arbitration missing. **Stop and report.** Do not choose.                      |
| `DECIDE, A FAIRE` | The arbitration is written in the entry. **Execute it without asking again.** |
| `EN COURS`        | Started, not yet proven                                                       |
| `PROUVE`          | Closed, with the proof quoted in the entry                                    |

The master register lives in the KAMBRIQ project. This file is the copy read at
the start of every session; when the two disagree, the master wins.

Identifiers `B*`, `G*` and `V*` come from Visquis. Entries carrying other
prefixes were proposed locally and must be renumbered against the master.

### Open

| ID  | Chantier                                                                                                                                                                                                            | Cost impact                                                         | Notes                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | `storage.service.ts` gates S3 on static credentials that are never set. All uploads and downloads are dead on dev.                                                                                                  | None — the task role already holds the S3 grant from `iam-media.tf` | Blocked on a decision: the three `isConfigured` branches return success-shaped responses, so the fix is a behaviour change, not three lines |
| B3  | Dev test data: the seed ran once on 2026-02-26 and has gaps. `KbsQuestion` and `KbsExam` are empty, so quizzes and exams cannot be exercised. `LandMedia` and `LandDocument` are empty, and S1 blocks creating them | None                                                                | A tester can log in and browse; they cannot complete a KBS module or see a land photo                                                       |
| V1  | Silent degradation beyond AWS: `kamnet.processor.ts:44` skips commission creation when the user is missing and returns null, so the BullMQ job completes; both processors return null on an unknown job name        | None                                                                | Same shape as the SES bug: caller cannot tell                                                                                               |
| T1  | `lands` and `kamnet` have zero unit tests: 18 files, 1 026 uncovered lines                                                                                                                                          | None                                                                | Items 3 and 4 of the test plan                                                                                                              |
| W1  | `/reactivate` is whitelisted in `PUBLIC_PATHS` and has no page. `lib/actions/auth.ts:30` redirects there on `REACTIVATION_REQUIRED`, so a user in the soft-delete grace period hits a 404                           | None                                                                | App work                                                                                                                                    |
| F1  | Coverage ratchet: a threshold was deliberately deferred until the number was real. It is now real (api 29.8%, common 51.1%, web 0.9%)                                                                               | None                                                                | Add once the number is rising                                                                                                               |
| P1  | SES allows one contact list per account per region. If prd shares this account and region, dev test subscriptions mix with real subscribers                                                                         | Depends on the option chosen; a separate prd account is the largest | Recorded in `kambriq-infra` ADR-005 §1.1                                                                                                    |

### Closed

| ID  | Chantier                                                                                                                                                                      | Closed by                       | Cost impact                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------- |
| E1  | SES: the API had never sent an email. Static-credential gate plus no `ses:` grant on the task role                                                                            | infra #16, #17, #18; webapp #39 | SES contact list: free. Two IAM policies: free. One SSM parameter removed |
| D1  | Prisma baseline: all four dev databases under Prisma Migrate, `db push --accept-data-loss` no longer reachable                                                                | webapp #34, #35, #36            | None                                                                      |
| C1  | Coverage was measured only over files a test already imported; `apps/web` never ran in CI                                                                                     | webapp #37                      | None                                                                      |
| C2  | Middleware decision untested. A redirect loop shipped in May 2026 and was fixed by accident in August, unnoticed                                                              | webapp #38                      | None                                                                      |
| A1  | e2e uploaded an empty report on every run while reporting green                                                                                                               | webapp #32                      | None                                                                      |
| A2  | `scripts/smoke-test.sh` died on its first passing check under `set -e`                                                                                                        | infra #15                       | None                                                                      |
| L1  | `EmailProcessor` logged the SES `MessageId` in a metadata object, which `nestjs-pino` drops because `Logger.log`'s second argument is the _context_. No send was attributable | webapp #41                      | None                                                                      |

---

## Two habits this register exists to enforce

**Prove it, do not infer it.** A green deploy concealed the SES failure from
February to September. Where a change claims an external effect, verify it
against the external system: the SES `Send` metric, the live IAM policy, the
running task definition — not the CI result.

**A failure must be loud.** Every chantier above began as something that
returned success while doing nothing. When adding a degraded path, make it an
explicit setting (`EMAIL_TRANSPORT=console`), never an inference from absent
configuration.

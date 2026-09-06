# A7 - the gap between the codebase and the standards

**Read-only. This is a list, not a set of fixes.** Nothing in it was changed by
the pass that produced it, and nothing in it should be changed without its own
chantier. The point is that the debt is visible and finite rather than discovered
one incident at a time.

**Swept on 2026-09-06**, across `kambriq-webapp` (`apps/api/src`,
`libs/common/src`, `prisma/`, `apps/api-e2e/src`, `.github/workflows/`) and
`kambriq-infra` (all `.tf`). Generated Prisma client code, `node_modules` and
`.terraform` are excluded throughout: they are not ours and they are rewritten.

**Cost impact: None.** Read-only.

---

## What this pass can and cannot say

It covers the classes that can be detected by reading the tree. It is **not** a
line-by-line read of all 283 test blocks and every service method, and it must
not be quoted as though it were.

| Class                                                            | Detectable this way?                                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| async call in a `map` without `await`                            | yes                                                                                               |
| swallowed errors, silent skips                                   | yes, by inspecting every `catch` and `.catch()`                                                   |
| role codes as bare strings                                       | yes - already guarded                                                                             |
| env vars read but undeclared                                     | yes - already guarded                                                                             |
| flags a script never reads                                       | yes                                                                                               |
| doc cross-references that do not resolve                         | yes                                                                                               |
| Terraform variables without descriptions, resources without tags | yes                                                                                               |
| **assertions with more tails than mutations**                    | **only as a candidate list.** Whether a mutation was ever run for a given tail is not in the tree |
| **tests that pin a defect rather than a requirement**            | **no.** `grading-processor.spec.ts` was found by reading the requirement, not by any pattern      |

The last two are the expensive ones and they are the ones a sweep cannot close.

---

## Findings

### W1 - a notification that silently does not send

`apps/api/src/lands/reservations/reservations.service.ts:893` -
`notifyAgentDocumentUploaded`.

```ts
const [agent, land] = await Promise.all([
  this.usersService.findById(reservation.agentUserId).catch(() => null),
  this.prisma.land.findUnique({ where: { id: reservation.landId } }),
]);
if (!agent || !land) return;
```

The whole body is inside a `try` whose `catch` logs a warning and returns. So a
client uploads a document, the agent is never told, and the request succeeds.
**Exactly the shape of the commission defect** - a lookup fails, the work is
skipped, and the only symptom is a human noticing they were not told something.

Lower stakes than the commission: this is a notification, not money, and the
document is still recorded. **Listed, not fixed.** The decision it needs is
whether an unsendable agent notification is worth failing the upload for - it
probably is not, and then the answer is a counter rather than a throw, so that
"how often does this happen" is answerable at all.

### W2 - two lookups whose failure is indistinguishable from a default

`reservations.service.ts:926` and `:934` - `resolveClientLang` and
`resolveClientPrefs`, both `.catch(() => null)` then falling back to `'fr'` and
`null`.

A client whose lookup **failed** and a client with **no stated preference** come
out the same. Low severity and defensible for a language default; recorded
because it is the same mechanism as W1 and one of them will matter eventually.

### W3 - `--seed` is passed to a script that does not read arguments

`.github/workflows/deploy-dev.yml:201` runs
`node prisma/run-migrations.js --seed`. `prisma/run-migrations.js` contains no
`process.argv` and not the string `seed`: verified, both counts are zero. It runs
the migrations, exits 0, and seeds nothing, under a step named
**"Run database seed"**.

Already open in the register as the `H2` follow-up, `A DECIDER`. Repeated here
because it is the archetype: **the mechanism that reports success by saying
nothing does not have to be in the application.**

### W4 - two ADR-005s, and one reference that does not say which

`docs/ops/registre-chantiers.md:852` cites `docs/adr/ADR-005` unqualified, meaning
the **infra** ADR-005, _Production automation prerequisites_. In this repository
`docs/adr/ADR-005` is _E2E Testing with Playwright_. The reader who follows it
lands on the wrong document and nothing tells them so.

Two other references on lines 786 and 808 do qualify it (`infra ADR-005`,
`` `kambriq-infra` ADR-005 ``), which is what the fix looks like.

### W5 - `scripts/smoke-test.sh` is cited from the wrong repository

`docs/ops/registre-chantiers.md:975`, the `A2` row. `scripts/smoke-test.sh` does
not exist in this repository; it is `kambriq-infra/scripts/smoke-test.sh`. The
webapp has `scripts/deploy-dev.sh` and nothing else.

W4 and W5 are the **stale cross-reference** defect inside the register, which is
the document whose credibility the rule about cross-references exists to protect.
Both are one word each.

### W6 - eight assertions with six or more tails

Candidates only. Six or more `expect(` in one block means the block can fail for
more reasons than any single mutation demonstrates - it does **not** mean the
mutations were not run.

| expects | Where                                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------- |
| 10      | `journeys.spec.ts` :: creates a client who holds CLIENT and can open the portal                             |
| 9       | `users.service.spec.ts` :: returns users, not promises                                                      |
| 9       | `journeys.spec.ts` :: reaches a 200 login carrying ADMIN_GLOBAL, and an admin-only route answers            |
| 8       | `journeys.spec.ts` :: becomes eligible, sits a twenty-question exam, and passes                             |
| 8       | `journeys.spec.ts` :: is EXAM_PASSED and holds no certificate until an admin issues one                     |
| 7       | `journeys.spec.ts` :: serves exactly ten quiz questions per module and scores them out of ten               |
| 6       | `auth.service.spec.ts` :: Creates a user, assigns CLIENT role, sends verification email, and returns tokens |
| 6       | `exam.services.spec.ts` :: sets the exam PASSED and the candidate EXAM_PASSED, certifying nothing           |

Five of the eight are journeys, where a block is a sequence of real requests and
splitting it would mean re-running the sequence. The three unit blocks are where
the question actually bites.

283 blocks scanned in total.

---

## Checked and clean

Stated because a class nobody checked and a class with nothing in it look
identical in a report that only lists findings.

| Class                                       | Result                                                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| async call in a `map` without `await`       | **0.** All 11 async `.map()` sites are inside `Promise.all`, each verified individually rather than by pattern |
| role codes as bare strings                  | **0**, and guarded by `role-code-literals.spec.ts`                                                             |
| env vars read but undeclared                | **0**, and guarded by `env-vars-declared.spec.ts`                                                              |
| empty or error-swallowing `catch` blocks    | **0.** Every `catch` in the API either rethrows, throws a typed exception, or is W1/W2 above                   |
| Terraform variables without a `description` | **0 of 250**                                                                                                   |
| Terraform taggable resources without `tags` | **0 of 40**                                                                                                    |
| paths cited in `README.md` / `CLAUDE.md`    | all resolve                                                                                                    |

---

## Two defects this pass found in itself

Kept, because a sweep that does not report its own misfires is asking to be
trusted more than it has earned.

**The assertion counter first reported 16 tails on a block that has four.** Its
regex ran from an `it(` to the next `\n  })`, which in a nested `describe` is the
end of the _enclosing_ block - so a block inherited every assertion under it, and
the worst offender it named was a test written that morning. Rewritten to split
on `it(`/`test(` boundaries, the real maximum is 10 and the count is 8 rather
than 19. **A number produced by a broken measurement is not a smaller version of
the right number.**

**The Terraform tag sweep first reported four untagged resources.** All four were
`aws_route_table_association`, `aws_iam_user_policy_attachment` and
`aws_ecr_lifecycle_policy` - AWS types that take no tags, missing from the
exclusion list. Four findings, four false positives, and a reader who spot-checked
one would have concluded the other three were real.

Both are the same entry from the catalogue: **defects in the measurement, not the
thing measured.**

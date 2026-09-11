# G5 and G7 — what the design requires, and what is already delivered

**Read-only assessment. Nothing was built for this document.**

> **Superseded on 2026-09-09.** The gaps below were closed by `A17`, `G7` and
> `G5` in the register, in that order. In particular the closing sentence of
> this document - no test opens a database - is no longer true: `pnpm test:db`
> exercises every trigger and CHECK named here, and each was proved sharp by
> removal. Two claims here were also found stale by then: G9 had closed the
> creation row, and G11 had re-created the evidence CHECK against `HIST`.

Source of the clauses: `ops_kambriq_paiement-hybride_v01.md` (09_OPERATIONS,
Drive id `1-6aB1XmVWlFuD2MWD9Qq8RBVGHn4xmqZ`, 5 488 bytes, created
2026-09-06 11:54). Clauses are quoted from it verbatim, accents as written.

Assessed against `develop` at `281166b` — G1 through G4 merged.

---

## Why this document exists

`G5` (_journal des mouvements_) and `G7` (_piste d'audit immuable_) were written
into the roadmap **before** `G1` and `G4` existed. Both now sit on top of tables
and code those chantiers delivered. The question is not _"can we build them"_ but
_"what is actually left"_.

Two errors cost the same days, and this document is written to avoid both:
counting shared infrastructure as progress, and rebuilding something already
delivered.

### The distinction that decides everything below

For every clause marked satisfied, this document says which of two things is
true:

- **HELD** — a test fails if the property stops being true.
- **TRUE TODAY** — the property holds by inspection, and nothing in CI would go
  red if it were removed.

**A property that is true because nothing has broken it yet is not delivered.**
Where a clause is TRUE TODAY, the remaining work is a test, not a feature — and
that work is real work, not bookkeeping.

---

# G5 — Journal des mouvements

## What the design requires

From **§ L'argent n'est jamais un champ modifiable**, in full:

> Le total recu est une **somme calculee sur un journal de mouvements**, jamais un
> nombre qu'on edite.
>
> Meme raisonnement que le denominateur de couverture : un chiffre qu'on peut
> corriger a la main est un chiffre qui ment un jour, et le jour ou il ment, rien
> ne le signale. **Une correction s'ajoute au journal, elle ne remplace pas une
> ligne.**

Three clauses, and the third is two claims in one sentence.

The line **content** is specified in § Les preuves, which the roadmap assigns to
`G4` rather than `G5`. It is assessed here anyway, because a journal whose lines
are wrong is not a journal — but it is marked as `G4`'s so the credit is not
counted twice.

## Clause by clause

### G5.1 — "Le total recu est une somme calculee sur un journal de mouvements"

**Satisfied.**

`sumReceipts` — `libs/common/src/payments/payment-state.ts:180`. Exported once
and used by every read path, so there is one summation rather than several that
agree until they do not:

| Read path                                            | File                                                  |
| ---------------------------------------------------- | ----------------------------------------------------- |
| `listForBackOffice`                                  | `apps/api/src/lands/payments/payments.service.ts:373` |
| `findForBackOffice`                                  | `:409`                                                |
| `validate` (outstanding at the moment of commitment) | `:531`                                                |
| `totalReceived`                                      | `:577`                                                |

The screen never sums anything: `payment-detail-content.tsx` renders
`amountReceived` and `outstanding` as the API computed them, and says so in its
doc comment.

**HELD.** `payments.service.spec.ts` → _records three partial encaissements and
computes the total_, and _a correction appends a negative line and never edits
one_ (which asserts the total after the correction). `payment-back-office.spec.ts`
→ _the back-office read computes it and never selects it_, _the detail read
computes it from the ledger it returns_.

### G5.2 — "jamais un nombre qu'on edite"

**Satisfied.**

There is no column to edit. `model Payment` in `prisma/lands/schema.prisma` has
`amountDue` and no total of any kind.

**HELD.** `payments.service.spec.ts` → _writing the total directly is impossible
by construction_, which reads the schema (not the generated client, which would
be reading the same claim twice) and asserts the absence of `totalReceived`,
`totalPaid`, `amountReceived` and `balance`, plus the absence of a setter on the
service. Extended to `G4`'s surface by _the controller exposes no route that
writes a total_.

### G5.3a — "Une correction s'ajoute au journal"

**Satisfied in the API. Not reachable from the back office.**

`PaymentReceipt.correctsId` exists, `amount` is deliberately not constrained to
be positive, and `recordReceiptSchema` accepts `correctsId`.

**HELD at the service layer** — `payments.service.spec.ts` → _a correction appends
a negative line and never edits one_ asserts a negative amount and a `correctsId`
on the created row, and that the computed total accounts for it.

**But `record-receipt-form.tsx` has no `correctsId` input.** The form collects
amount, channel, real receipt date, proof and note. A back-office operator who
keys 3 000 000 twice cannot correct it through the screen; the correction exists
only for a caller holding a token and writing JSON by hand.

This is the `A10` shape again — an API the product cannot reach — and it is the
one piece of `G5` that is genuinely missing rather than merely unproven.

### G5.3b — "elle ne remplace pas une ligne"

**Enforced by the database. Proven by nothing.**

`PaymentReceipt_append_only`, a `BEFORE UPDATE OR DELETE` trigger calling
`kambriq_append_only()`, which raises `restrict_violation`
(`prisma/lands/migrations/20260906190000_g1_payment_model/migration.sql:107`).
The migration states the reasoning plainly:

> `-- "Rien n'est reecrivable apres coup" is a property of these tables, not a`
> `-- promise made by the service layer. A service can be bypassed by a script, a`
> `-- console, or the next developer in a hurry; a trigger cannot.`

That reasoning is right, and it is exactly why the gap matters.

**TRUE TODAY.** Verified by hand on the local database — `information_schema.triggers`
lists `PaymentReceipt_append_only` for both `UPDATE` and `DELETE` — and observed
in effect when `prisma/seed.ts` could not delete a reservation carrying receipts.

**No test asserts it at any level.** Not the trigger firing (no test in the suite
opens a real database — every payment spec uses a mocked Prisma client), and not
even the SQL text being present in the migration. A migration that dropped both
triggers tomorrow would pass CI: 445 API tests and 277 common tests, all green.

The service-layer test proves the service appends. It cannot prove that an
`UPDATE` is refused, because the mock has no triggers.

### G5.4 — the line content (§ Les preuves — `G4`'s clauses, listed for completeness)

| Clause                                                        | Where                                                    | Status                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| un montant, en unite indivisible, avec sa devise explicite    | `amount BigInt` + `currency String`                      | **HELD** — `no-float-money.spec.ts`: _every monetary field G1 owns is BigInt_, _every amount has a currency beside it_                                                                                                                                                                    |
| une date de reception reelle, qui n'est pas la date de saisie | `receivedAt` + `recordedAt`                              | **HELD, partially** — `payment-back-office.spec.ts` → _records a receipt that has its proof_ asserts `receivedAt` is the value passed and not the server clock. Nothing forbids an operator entering today's date, or a future one; that is a data-quality rule the design does not state |
| un canal                                                      | `channel PaymentChannel`, `RECORDABLE_CHANNELS`          | **HELD** — _refuses the backfill channel as an input_, and the screen's select is built from `RECORDABLE_CHANNELS` so `INCONNU_HISTORIQUE` cannot be picked                                                                                                                               |
| un justificatif televerse                                     | `evidenceUrl` + `PaymentReceipt_evidence_required` CHECK | **HELD at the service and DTO layers**; the CHECK itself is asserted as _text in the migration file_ (_the database CHECK is the backstop, and still confines the exception_) — the same class of gap as G5.3b, one level weaker                                                          |
| l'identite de la personne qui l'a saisi                       | `recordedBy`                                             | **HELD** — _records a receipt that has its proof_ asserts it                                                                                                                                                                                                                              |

## G5 — verdict

**A formality, with one real gap and one real test debt.**

The journal exists, the total is computed from it everywhere, and no editable
total exists to contradict it. What remains:

1. **A correction cannot be made through the back office.** One field on
   `record-receipt-form.tsx` and a way to pick the line being corrected. Small,
   and genuinely missing.
2. **The append-only trigger is unproven.** Needs a test that opens a real
   database, inserts a receipt, and asserts the `UPDATE` and the `DELETE` are
   both refused. The suite has no such harness today, which is why this is the
   larger of the two.

Neither is the chantier the roadmap described — that chantier was delivered by
`G1` and `G4`.

---

# G7 — Piste d'audit immuable

## What the design requires

From **§ Piste d'audit**, in full:

> Chaque transition enregistre **qui, quand, pourquoi, et sur quelle preuve**.
> **Rien n'est reecrivable apres coup.**
>
> **Option a trancher plus tard, pas maintenant** : au-dela d'un seuil de
> montant, exiger que le validateur soit une personne differente de celle qui a
> saisi l'encaissement. Deux super admins existent, donc c'est realisable sans
> cout - mais c'est une contrainte d'exploitation, et elle se decide quand on
> sait qui fait quoi au quotidien.

Two required clauses. The four-eyes rule is **explicitly deferred by the design
itself** and is therefore not a `G7` requirement — see the note at the end.

## Clause by clause

### G7.1a — "Chaque transition enregistre qui"

**Satisfied.** `PaymentTransition.actorUserId`, non-nullable.

**HELD.** `payments.service.spec.ts` → _moves the payment and writes the audit row
in one transaction_ asserts the actor on the created row;
_refuses a committing transition made on behalf of a system actor_ proves a
system marker cannot be the actor for a state that commits money.

### G7.1b — "quand"

**Satisfied.** `PaymentTransition.occurredAt`, `@default(now())`, indexed.

**TRUE TODAY.** No test asserts it is written or that it is the server's clock
rather than a caller's. This is the weakest of the four in consequence — a
default on a non-null column is hard to get wrong — and it is still not held.

### G7.1c — "pourquoi"

**Satisfied for the transitions that matter. Weaker elsewhere.**

`reason` is non-nullable in the schema. Both DTOs require `min(1)`
(`validatePaymentSchema`, `transitionPaymentSchema`). The domain guard
`assertTransitionIsDeliberate` refuses an empty reason — **but only for states in
`COMMITTING_STATES`**.

So for a non-committing step (`ANNONCE_CLIENT`, `EN_VERIFICATION`) an empty
reason is refused by the HTTP boundary and accepted by the service. There is no
database `CHECK (reason <> '')`.

**HELD for committing states** — _refuses a committing transition with no reason_,
and `payment-back-office.spec.ts` → _refuses to validate without a reason,
through G1 guard_. **TRUE TODAY (via the DTO only) for the rest.**

### G7.1d — "et sur quelle preuve"

**NOT SATISFIED.** This is the clause `G7` is actually for.

The column exists — `PaymentTransition.evidenceReceiptId`, documented in the
schema as _"The receipt this decision rests on, where there is one"_ — and
`transition()` writes it when given
(`payments.service.ts:650`). Everything above that is missing:

| Layer                                                      | State                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `transitionAsAdmin` (four of the five steps in a real run) | **does not accept it at all**                                       |
| `validatePaymentSchema` / the validate route               | accepts `evidenceReceiptId?`, optional                              |
| `validate-payment-action.tsx`                              | **never sends it** — calls `validatePayment({ paymentId, reason })` |
| `payment-detail-content.tsx` audit trail                   | **never renders it**                                                |

Measured rather than reasoned, in two databases:

- the `G4` end-to-end run (`KBQ-2609-FZKX3-Z`, five transitions including
  `PARTIELLEMENT_RECU` and `VALIDE`) — **`evidenceReceiptId` is NULL on all five
  rows**;
- dev, on `281166b`, reading the one payment that carries a ledger line through
  `GET /lands/admin/payments/{id}` — its single transition,
  `NULL -> PARTIELLEMENT_RECU`, also has `evidenceReceiptId: null`, and it is the
  row the `G1` migration wrote.

Every `PaymentTransition` that exists, on any environment, has this column NULL.

A validation that does not say which receipt it rests on is the half of the audit
trail that answers _"on what basis"_, and it is the half a dispute turns on.

### G7.1e — "Chaque transition" — is every state change recorded?

**Satisfied, and by construction.**

`prisma.payment.update({ ... data: { state } })` appears **exactly once** in the
API (`payments.service.ts:642`), inside `transition()`, in the same
`$transaction` as the `paymentTransition.create`. There is no second write path.

**HELD for the pair; TRUE TODAY for the uniqueness.** _moves the payment and
writes the audit row in one transaction_ proves the two happen together. Nothing
proves there is only one such call site — a second `payment.update` added
tomorrow would change state with no audit row and no test would go red.
`no-payment-without-reference.spec.ts` already does exactly this shape of sweep
for `payment.create` (_payment.create appears in exactly one place in the API_),
so the pattern to copy exists.

**One gap of a different kind: creation is not recorded.** `createPayment` writes
no `PaymentTransition`, so a payment's arrival at `INITIE` is not in its own
trail. The schema anticipates the row — `fromState` is documented as _"NULL only
for the row that records the payment coming into existence"_ — and the only rows
with `fromState IS NULL` in any database are the ones the `G1` **migration
backfill** wrote. The code path that would write them does not exist.

### G7.2 — "Rien n'est reecrivable apres coup"

**Enforced by the database. Proven by nothing.**

`PaymentTransition_append_only`, the same `BEFORE UPDATE OR DELETE` trigger as
G5.3b (`migration.sql:111`).

**TRUE TODAY**, with the same evidence and the same gap: verified by hand in
`information_schema.triggers`, asserted by no test at any level, and removable by
a future migration with a fully green suite.

This is `G7`'s title clause. **The chantier named "piste d'audit immuable" rests
entirely on an immutability guarantee that CI does not check.**

### G7.3 — the four-eyes rule

**Not a `G7` requirement.** The design defers it explicitly — _"Option a trancher
plus tard, pas maintenant"_ — and gives the reason: it is an operational
constraint that needs to be decided when it is known who does what daily.

The seam is built and empty: `assertFourEyesIfRequired(paymentId, actorUserId,
amountDue)` in `payments.service.ts`, called by `validate` before the transition.
Held by `payment-back-office.spec.ts` → _exists on the validate path, where the
money is committed_.

Recording it here so it is not rediscovered later as a missing `G7` clause. It is
a decision, not a build.

## G7 — verdict

**A chantier, not a formality — but a small one, and not the one the roadmap
described.**

The table, the transaction pairing and the trigger were delivered by `G1`; the
on-screen trail by `G4`. What remains is specific:

1. **"sur quelle preuve" is unreached.** The column is there and nothing fills
   it. Needs `transitionAsAdmin` to accept a receipt id, the validate control to
   let the operator pick the receipt the decision rests on, and the trail to show
   it. This is the only clause of the design that is outright unsatisfied.
2. **The append-only trigger is unproven** — the same test debt as G5.3b, and
   here it is the chantier's title clause.
3. **Creation writes no audit row**, so a trail never starts at `INITIE`.
4. **Nothing pins the single write path to `Payment.state`**; the sweep pattern
   already exists for `payment.create`.

---

# Summary

|        | Verdict              | What remains                                                                                                          |
| ------ | -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **G5** | **Formality**        | corrections unreachable from the screen; the append-only trigger unproven                                             |
| **G7** | **Chantier** (small) | `evidenceReceiptId` unreached end to end; the trigger unproven; no creation row; the single state-write path unpinned |

## The one thing both share

Every database-level guarantee in the payment model — the two append-only
triggers, the evidence CHECK, the reference-format CHECK, the currency CHECK — is
either asserted as **text in a migration file** or not asserted at all. **No test
in this repository opens a database** — checked by sweeping the whole suite for
`new PrismaClient`, `$connect` and `new Pool`: the only match is `$connect: fn()`
in `apps/api/src/__test__/utils/mocks.ts`, a jest mock. Each of those constraints
is real, is doing work today, and would survive its own deletion without a single
test going red.

That is one gap, not five, and it is worth naming as one: the suite has no
integration harness. Whether that harness is `G5`'s, `G7`'s, or its own entry is
a scoping decision for whoever schedules the next chantier — but the four
constraints should not be counted as delivered until something exercises them.

---

**Method.** Clauses quoted from the design document on Drive. Every "satisfied"
claim names the file and, where useful, the line. Every "HELD" names the test by
its own title. Every "TRUE TODAY" was checked by searching the whole suite for
any assertion of that property, not by assuming its absence. The `NULL`
`evidenceReceiptId` finding and the trigger listing were read from a database,
not inferred.

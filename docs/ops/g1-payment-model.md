# G1 - the payment data model and state machine

Written for somebody who has not read the brief that produced it.

**Specification:** `ops_kambriq_paiement-hybride_v01.md` (09_OPERATIONS). That
document is the design; this one says what was built and what is still missing.

**Cost impact: None.** Three tables in an existing database, no new resource.

---

## The idea in one paragraph

**The platform does not collect money. It orchestrates and it attests.** Land is
sold in Cameroon, largely to a diaspora, and a large share of payments happen in
front of a notary on paper. Money moves through real channels - bank transfer,
mobile money, cash - and the platform's job is to issue the reference, record
what was received and on what evidence, and let a named person decide that a
payment is settled. A card gateway would be one more channel, not the channel.

## Which schema owns payments, and why

**`lands`.** Payments attach to `LandReservation`, and the reservation is the
only payable subject that exists.

The alternative was `core`, on the argument that a payment reference is
platform-wide and will one day cover a KBS certification fee. It was rejected
for a concrete reason: **there are no cross-database foreign keys in this
codebase** - ids between the four databases are carried by convention, and this
project already has a defect from exactly that (a commission never created
because an agent lookup across databases returned nothing, with no symptom until
an agent noticed they had not been paid). Putting the money in a different
database from the thing it pays for makes referential integrity a convention at
the one place where it must not be.

In `lands`, `Payment.reservationId` is a real foreign key, the backfill is one
SQL statement in the same migration, and `reference` is unique across every
payment that exists.

**When to revisit:** the day a second module needs to be paid for. At that point
the reference generator (G2) has to become a platform-level allocator anyway,
because uniqueness cannot be enforced across four databases, and that is the
moment to move the tables - not before.

## The tables

| Table               | What it is                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| `Payment`           | one payment against one reservation. Holds the amount **due**, the currency, the state, and the reference |
| `PaymentReceipt`    | **the movement ledger.** One row per encaissement. Append-only                                            |
| `PaymentTransition` | **the audit trail.** One row per state change: who, when, why, on what evidence. Append-only              |

### Money

`amountDue` and `amount` are **`BigInt`**, in the indivisible unit of the
currency stored beside them. **XAF has no minor unit** - one unit is one franc,
not a centime. This trips people who assume cents.

No monetary value is a `Float`, and `no-float-money.spec.ts` fails if one
appears. Five pre-existing monetary `Float` columns are quarantined in that
test with the reason each was not converted; see "What is still missing".

### There is no total column

`Payment` has no `totalReceived`. The total is `sumReceipts()` over the ledger
and there is no other way to obtain it. A correction **appends a signed line**
pointing at the line it corrects - `amount` is deliberately not constrained to be
positive - and never edits one.

This is the coverage-denominator reasoning applied to money: a figure you can
edit by hand is a figure that lies one day, and the day it lies, nothing signals
it.

### Append-only is a property of the database

`PaymentReceipt` and `PaymentTransition` carry a `BEFORE UPDATE OR DELETE`
trigger that raises. Not a service convention - a service can be bypassed by a
script, a console, or the next person in a hurry.

```
=# update "PaymentReceipt" set "amount" = 1;
ERROR:  append-only table PaymentReceipt: UPDATE is refused.
        A correction is a new row, never an edit.
```

## The state machine

```
INITIE
  -> INSTRUCTIONS_ENVOYEES
       -> ANNONCE_CLIENT          (the client declares they have paid)
            -> EN_VERIFICATION
                 -> PARTIELLEMENT_RECU   (loops on itself)
                      -> VALIDE
exits, from every non-terminal state: REJETE, EXPIRE, ANNULE
```

The table lives in `libs/common/src/payments/payment-state.ts`, not in Prisma,
which has no way to express it.

| From                                | Legal                                                 |
| ----------------------------------- | ----------------------------------------------------- |
| `INITIE`                            | `INSTRUCTIONS_ENVOYEES`, `REJETE`, `EXPIRE`, `ANNULE` |
| `INSTRUCTIONS_ENVOYEES`             | `ANNONCE_CLIENT`, + exits                             |
| `ANNONCE_CLIENT`                    | `EN_VERIFICATION`, + exits                            |
| `EN_VERIFICATION`                   | `PARTIELLEMENT_RECU`, + exits                         |
| `PARTIELLEMENT_RECU`                | **`PARTIELLEMENT_RECU`**, `VALIDE`, + exits           |
| `VALIDE` `REJETE` `EXPIRE` `ANNULE` | nothing - terminal                                    |

`PARTIELLEMENT_RECU` loops because land is paid in instalments. A model that
knows only paid-or-unpaid gets worked around from the first sale, and the
instalments end up in a notebook outside the platform.

`VALIDE` is terminal: a payment wrongly validated is corrected by appending to
the ledger, not by moving the state backwards.

### No transition that commits money is automatic

`assertTransitionIsDeliberate` **throws** when a transition to
`PARTIELLEMENT_RECU`, `VALIDE`, `REJETE` or `ANNULE` is attempted with no named
actor, with a system actor (`system`, `job`, `cron`, `worker`, …) or with a blank
reason.

It is a barrier in the service path, not an assertion in a test. **An assertion
in a test is a report about a run that already happened; it cannot refuse a
write.** This is the `KCA_CERTIFIED` lesson - a business event crossed a
committing boundary alone and made somebody an agent with no certificate. Here
the boundary commits money.

**One deliberate exception:** `EXPIRE` is _not_ in `COMMITTING_STATES`, because
the design asks for exactly one automatic transition - _"passe en EXPIRE au
terme, avec sa raison"_. The dunning job may make that one and nothing else. If
you tighten this later, know the omission was a decision.

### Recording and validating are two calls

```ts
await payments.recordReceipt(id, { amount, currency, channel, receivedAt, evidenceUrl }, userId);
await payments.transition(id, PaymentState.PARTIELLEMENT_RECU, {
  actorUserId,
  reason,
  evidenceReceiptId,
});
```

`recordReceipt` appends to the ledger and **changes no state**. `transition`
changes state and **moves no money**. The pre-G1 `confirmDownPayment` wrote the
money flag and the reservation status in a single `update`, which is how a
payment becomes settled because somebody typed an amount.

## The reference

`KBQ-YYMM-XXXXX-C` - year and month, five characters, a check digit. Reserved
here as a nullable unique column with a `CHECK` constraint on the format.

The alphabet excludes `O/0`, `I/1/L` and `S/5`: characters that are confused when
a reference is dictated on the telephone, copied onto a transfer slip, or read by
a notary. **The check digit is what separates a reference from a source of
dispute** - without it, a mis-copied reference lands on somebody else's payment
and nobody notices until reconciliation.

**The generator is G2, and it now exists.**
Postgres treats NULLs as distinct in a unique index so they do not collide.

## The old columns

`LandReservation.downPaymentAmount`, `.downPaymentConfirmed`, `.confirmedBy` and
`.confirmedAt` are **deprecated, not dropped.** They are marked in the schema
and backfilled into `Payment`. Removal is a later PR, once the new path has been
exercised - a drop is irreversible.

## What is still missing

| Chantier      | What it adds                                                                                                                                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~**G2**~~    | **Done.** The generator, its check character and its validator are in `libs/common/src/payments/payment-reference.ts`; `PaymentsService.createPayment` assigns one at creation and there is no path that does not                              |
| **G3**        | the instructions email and the reminder. `Payment.expiresAt` exists and nothing reads it                                                                                                                                                       |
| **G4**        | the back-office screens for recording an encaissement and its justificatif. The service methods exist; **there are no routes**                                                                                                                 |
| **G6**        | the dunning queue: the query for stalled payments, the reminder, and the job that moves them to `EXPIRE`                                                                                                                                       |
| **G8**        | one payment carried end to end on dev                                                                                                                                                                                                          |
| later         | converting `Land.price`, `LandPriceHistory.previousPrice`/`newPrice` and `KamnetCommission.amount` off `Float`. 51 call sites, and `BigInt` does not survive `JSON.stringify`, so the response serialiser and the web types move with them     |
| **undecided** | the design leaves open whether, above a threshold, the validator must be a different person from the recorder. Two super admins exist so it is feasible; it is an operational constraint and it waits until somebody knows who does what daily |

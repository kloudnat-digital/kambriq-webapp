# Block B - the read-only audit

**Read-only. Four inventories, no fixes.** Nothing here was changed by the pass that
produced it. Where a finding needs a change, it says so and stops.

**Swept on 2026-09-06.** Live checks ran against **dev**, deployed image tag
`sha-1709ec6`, `gitSha 1709ec6ac633`, `env: development`, read from
`GET /api/v1/health/version`. Static checks ran against `develop` at the same
commit. Any number below that came from a running system says which.

**Cost impact: None.** Read-only.

---

## How to read this

Three habits, taken from `A7` and from what the H block cost:

- **classes checked and found clean are listed too.** A class nobody checked and
  a class with nothing in it look identical in a report that lists only findings;
- **what was inferred is marked, and only what was inferred.** Overstating
  uncertainty misled this project once already - two correct values were made to
  look doubtful and the one real invention was buried among them;
- **every "nothing found" says what was searched**, so the reader can judge the
  sweep rather than trust it.

The audit's own limits are at the end, not implied by silence.

---

# B1 - the state of the existing payment code

Against `ops_kambriq_paiement-hybride_v01.md` (09_OPERATIONS, 5 488 bytes,
mtime 2026-09-06 13:54), which is the design.

## The finding that settles the rest

**No payment has ever been processed, anywhere.**

On dev, `GET /lands/admin/reservations` returns **33 rows**: 27 `CANCELLED`,
5 `PENDING`, 1 `CONFIRMED`.

| Field                             | Rows  |
| --------------------------------- | ----- |
| `downPaymentConfirmed = true`     | **1** |
| `remainingPaymentConfirmedAt` set | **0** |
| `documentsReceivedAt` set         | **0** |
| `dossierStartedAt` set            | **0** |
| `completedAt` set                 | **0** |

**And the single confirmed down payment is a seed fixture, not a run.** Id
`00000000-0000-4000-8000-e00000000031`, written by `prisma/seed.ts:1376`, with
`confirmedAt: 2025-02-01T00:00:00.000Z` - a hardcoded date predating the
environment. Nothing has moved past step 2 of the reservation flow on dev, ever.

**There is no payment table.** The four Prisma schemas contain no model whose name
matches `payment|paiement|invoice|transaction|encaiss|escrow|ledger`. Payment
state is four nullable columns on `LandReservation`.

## Category 1 - exists and is reachable

| Thing                                                  | Where                            | Note                                                  |
| ------------------------------------------------------ | -------------------------------- | ----------------------------------------------------- |
| `LandReservation.downPaymentAmount`                    | `prisma/lands/schema.prisma:203` | **`Float`**, and a directly editable column           |
| `.downPaymentConfirmed`                                | `:204`                           | boolean - paid or not paid                            |
| `.confirmedBy` / `.confirmedAt`                        | `:205-206`                       | who and when                                          |
| `.remainingPaymentConfirmedAt/By`                      | `:213-214`                       | second and final money milestone                      |
| `POST /lands/admin/reservations/:id/confirm`           | `lands-admin.controller.ts:278`  | `confirmDownPayment`                                  |
| `POST /lands/admin/reservations/:id/payment-confirmed` | `:301`                           | `confirmRemainingPayment`                             |
| `POST /lands/admin/reservations/:id/complete`          | `:325`                           | closes the sale                                       |
| `DOWN_PAYMENT_PERCENT`                                 | `reservations.service.ts:18,105` | 5%, `Math.round((land.price * PCT) / 100)`            |
| `paymentConfirmed` email template                      | `reservations.service.ts:309`    | via `sendUpdate` - see B2                             |
| `LandReservationStatus`                                | `prisma/lands/schema.prisma`     | **4** states: `PENDING CONFIRMED COMPLETED CANCELLED` |

All guarded by `@Roles(RoleCode.ADMIN_LANDS, RoleCode.ADMIN_GLOBAL)` at class
level, pinned by `route-guards.spec.ts`.

## Category 2 - exists and is unreachable

| Thing                                                                 | Evidence                                               | Why unreachable                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `LAND_JOBS.NOTIFY_CLIENT_PORTAL`, `LAND_JOBS.SYNC_RESERVATION_STATUS` | `libs/common/src/constants/queue/index.ts:31-34`       | Declared, and **the file says so**: `// TODO: No LandsProcessor exists yet.` A grep for both job names across `apps/` and `libs/` returns only the declaration. No queue named `lands` is registered; `QUEUES` has `kbs core kamnet notifications`. Nothing enqueues them, nothing consumes them |
| `PAYPAL_ENVIRONMENT`                                                  | see below                                              | provisioned, injected nowhere, read by nothing                                                                                                                                                                                                                                                   |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID`                                        | `kambriq-infra modules/ssm-app-parameters/main.tf:775` | same: not in the web task definition, no match in `apps/web/src`                                                                                                                                                                                                                                 |

### `PAYPAL_ENVIRONMENT`, in full, because it was asked for

- **provisioned** by `kambriq-infra modules/ssm-app-parameters/main.tf:670`;
- **exists on dev**: `/kambriq/dev/api/PAYPAL_ENVIRONMENT`, type `String`, value
  `sandbox`, **version 1**, last modified `2026-02-24T13:09:45+01:00` - created
  once and never touched since;
- **read by nothing.** `grep -rn PAYPAL` over `apps/ libs/ prisma/ .github/
docker/` returns no match in any `.ts`, `.tsx`, `.js`, `.yml` or `.json`;
- **not declared** in `envSchema` - so `env-vars-declared.spec.ts` does not cover
  it, correctly, because nothing reads it;
- **not injected** into either task definition - absent from both `environment`
  and `secrets` on `kambriq-dev-api` and `kambriq-dev-web`.

**What happens when it is unset: nothing.** There is no reader, no default, no
branch. Unsetting it, deleting it, or setting it to `production` would change no
observable behaviour of the running system. It is a parameter waiting for code
that the design puts explicitly **out of scope for v1** - _"Hors perimetre de la
v1, explicitement: Carte bancaire. PayPal."_

## Category 3 - does not exist

Everything the design specifies as the mechanism. Searched: all four Prisma
schemas, every `*.controller.ts`, every `*.service.ts`, every `*.processor.ts`,
`libs/common/src/constants/`, and the queue job constants.

| Design element                                                                                                                                                          | Section                                   | Found                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| A `Payment` entity of any kind                                                                                                                                          | La machine a etats                        | **no**                                                                                                                    |
| The 9-state machine (`INITIE` -> `INSTRUCTIONS_ENVOYEES` -> `ANNONCE_CLIENT` -> `EN_VERIFICATION` -> `PARTIELLEMENT_RECU` -> `VALIDE`, plus `REJETE` `EXPIRE` `ANNULE`) | La machine a etats                        | **no** - the only status enum has 4 values and none of these names                                                        |
| `PARTIELLEMENT_RECU`, partial receipts                                                                                                                                  | La machine a etats                        | **no** - the model is boolean `downPaymentConfirmed`                                                                      |
| Payment reference `KBQ-2609-7F3K2-B`                                                                                                                                    | La reference de paiement                  | **no** - no field, no generator, no alphabet constant. Searched for `KBQ-`, `reference`, `checksum`, `checkDigit`, `luhn` |
| Check-digit validation                                                                                                                                                  | La reference de paiement                  | **no**                                                                                                                    |
| Proof entity (montant, date de reception, canal, justificatif, saisi par)                                                                                               | Les preuves                               | **no**. `LandClientDocument` exists and holds client identity documents, not receipts                                     |
| Movement journal, total as a computed sum                                                                                                                               | L'argent n'est jamais un champ modifiable | **no** - and the opposite exists: see below                                                                               |
| Dunning queue for `INSTRUCTIONS_ENVOYEES` overdue                                                                                                                       | Rien ne peut dormir en silence            | **no** - no scheduled job, no query, no back-office list                                                                  |
| Automatic reminder                                                                                                                                                      | Rien ne peut dormir en silence            | **no**                                                                                                                    |
| `EXPIRE` transition at term                                                                                                                                             | Rien ne peut dormir en silence            | **no**                                                                                                                    |
| Immutable audit trail per transition (qui, quand, pourquoi, sur quelle preuve)                                                                                          | Piste d'audit                             | **no** - `confirmedBy`/`confirmedAt` are overwritable columns, not an append-only log                                     |
| Instructions email                                                                                                                                                      | Le principe                               | **no** template named for it. The existing `paymentConfirmed` fires _after_ the fact                                      |

### Two places where what exists contradicts the design rather than merely lagging it

**1. Money is a `Float`, and a directly editable column.**
`downPaymentAmount Float?`. The design says _"un montant, en unite indivisible,
avec sa devise explicite"_ and _"Le total recu est une somme calculee sur un
journal de mouvements, jamais un nombre qu'on edite."_ The current column is a
binary floating-point number, has no currency beside it (XAF is a comment), and
is written directly by `update`. **This is not an absence to be filled in; it is a
shape that has to be replaced.**

**2. A business event does cross the money boundary, in one direction.**
`confirmDownPayment` sets `status: CONFIRMED` in the same `update` that sets
`downPaymentConfirmed: true`. It is admin-triggered, so it does not violate
_"Aucune transition n'est automatique sur un evenement metier"_ - **but** the
state and the money are one write with no separate validation step, which is the
structure `EN_VERIFICATION -> VALIDE` exists to prevent. Recorded as a shape to
watch, not as a defect today.

## Mapping onto G1 to G8

Labels read from `ops_kambriq_suivi-production_v01.xlsx`, `sharedStrings`
entries 125-146.

| #      | Chantier                                      | State                                 | What exists today                                                                                                                                                                                                              |
| ------ | --------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **G1** | Modele de donnees et machine a etats          | **not started**                       | 4 columns on `LandReservation` and a 4-value status enum. Neither is a subset of the target: the columns are the wrong shape (`Float`, editable) and the enum shares no state names                                            |
| **G2** | Generateur de references avec cle de controle | **not started**                       | nothing. No reference field anywhere                                                                                                                                                                                           |
| **G3** | Emails d'instructions et de relance           | **partly built - the transport only** | the queue, `EmailService`, the processor, the template registry and SES are proven and in daily use. **No instructions template, no reminder, no scheduler.** The _pipe_ is built; nothing that belongs to G3 flows through it |
| **G4** | Back-office - encaissements et preuves        | **partly built - the upload only**    | S3 presigned upload/download is proven (journey 2) and `LandClientDocument` shows the pattern for an attached, admin-reviewed document. **No encaissement entity, no proof entity, no back-office screen for either**          |
| **G5** | Journal des mouvements                        | **not started, and contradicted**     | the editable `Float` is the thing this chantier exists to remove                                                                                                                                                               |
| **G6** | File des paiements en souffrance              | **not started**                       | no scheduled job for lands at all. `LAND_JOBS` is two names with no processor                                                                                                                                                  |
| **G7** | Piste d'audit immuable                        | **not started**                       | `confirmedBy`/`confirmedAt`/`completedBy` are overwritable columns. `UserRole.grantedBy` is the nearest existing pattern and is also overwritable                                                                              |
| **G8** | Preuve de bout en bout sur dev                | **not started, and cannot start**     | 0 payments processed. G8 also requires the mutation proof - _"supprimer la garde qui interdit une transition automatique doit faire tomber la suite"_ - and there is no such guard yet to remove                               |

**Three of eight are partly built (G3, G4), and only in the sense that their
infrastructure exists and is proven.** No payment-specific line of code exists in
any of the eight. **G1 has no head start**: the existing columns are not a
foundation to extend, they are a shape to replace, and counting them as progress
is how an opening date becomes a guess.

---

# B2 - finishing the V1 inventory

The pattern: _if configured, otherwise silently disabled_. Closed three times on
AWS clients (SES, S3, storage) and twice on jobs. Three questions each, and the
third is the one that decides whether it is acceptable.

## Found: WhatsApp notifications are a preference that nothing reads

|                                 |                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What the closed branch does** | there is no branch. There is **no WhatsApp sender anywhere in the API.** `grep -rni whatsapp` over `apps/api/src` and `libs/common/src` returns only `UserProfile.whatsappNotifications` - the column, the DTO field, and the response mapper. Every other hit is `apps/web` rendering `wa.me` links |
| **What the caller receives**    | `PATCH /users/me {"whatsappNotifications": true}` -> **200**, and `GET /users/me` returns `whatsappNotifications: true`                                                                                                                                                                              |
| **Can the caller tell?**        | **No.** The response is truthful about the preference being stored and says nothing about a capability that does not exist. A user who enables it will never receive a WhatsApp message and has been given no way to find that out                                                                   |

`prisma/core/schema.prisma:78`, `users.dto.ts:29`, `users.service.ts:77-78`,
`users.service.ts:845`.

**Verdict: a degraded mode indistinguishable from success**, in the precise sense
of the rule. The setting is not degraded - it is decorative.

## Found: update emails are off by default, and the caller cannot tell

`EmailService.sendUpdate(payload, prefs)`:

```ts
if (prefs && !prefs.emailNotifications) {
  this.logger.debug('Update email skipped by user preference %o', {...});
  return;
}
```

|                                 |                                                     |
| ------------------------------- | --------------------------------------------------- |
| **What the closed branch does** | logs at **debug** and returns `void`                |
| **What the caller receives**    | `Promise<void>` - identical to a successful enqueue |
| **Can the caller tell?**        | **No.** Same return, same type, no result object    |

And the branch is not an edge case: **`UserProfile.emailNotifications` defaults to
`false`** (`prisma/core/schema.prisma:77`). So for every user whose profile exists
with defaults, **the skip is the normal path**, not the exception.

10 call sites go through `sendUpdate`: 6 in `reservations.service.ts` - including
`paymentConfirmed`, which is G3's ancestor - 1 in `certificates.service.ts`, 3 in
`applications.service.ts`.

**Verdict: a real degraded mode, correctly chosen** (a user preference must be
honoured) **and indistinguishable at the call site.** The design intent is right
and the signature is wrong: `sendUpdate` should say whether it sent. Not fixed
here.

## Found: `RedisService` is injected once and never called

|                                 |                                                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What the closed branch does** | `onModuleInit` builds an `ioredis` client with `lazyConnect: true` and attaches `.on('error', ...)` which logs at **error**. A Redis that is down does **not** fail startup |
| **What the caller receives**    | for `get`/`set`, the ioredis promise rejects - a caller would see a real failure, not a silent null                                                                         |
| **Can the caller tell?**        | **Yes, if there were a caller**                                                                                                                                             |

`RedisService` is imported and constructor-injected in exactly one place -
`apps/api/src/kamnet/agents/agents.service.ts:15,33` - and **no method on it is
called anywhere in that file or any other.** So the service connects lazily,
never connects, and logs nothing because nothing triggers a connection.

**Verdict: not a degraded-mode defect. An unused dependency**, and category 2 of
B1's taxonomy applied outside payments. BullMQ's own Redis connection is separate
and is proven working - the queue delivered mail today.

## Checked and clean

| Class                                            | Result                                                                                                                                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| i18n missing key / missing language              | **clean.** `I18nModule.forRoot({ fallbackLanguage: DEFAULT_LANGUAGE })`, and `UserLanguageResolver` returns `undefined` to mean "fall back", which nestjs-i18n handles. A missing key returns the key itself - visible in output, not silent |
| `EMAIL_TRANSPORT`                                | **clean and already closed.** `z.enum(['ses','console'])`, no default-to-console-on-missing-credentials. This is the fix that started the pattern                                                                                            |
| `STORAGE_TRANSPORT`                              | **clean**, same shape                                                                                                                                                                                                                        |
| `EmailService.send` validations                  | **clean.** Throws on `[object ` and on UUID-shaped `…Name` args - loud, not silent                                                                                                                                                           |
| Queue processors returning `null` on unknown job | **clean** - closed in V1, and `grading-processor.spec.ts` was corrected with it                                                                                                                                                              |
| Empty or swallowing `catch` blocks               | **0**, across `apps/api/src`, `libs/common/src`, `prisma/`. Every `catch` rethrows, throws typed, or is one of the two `reservations.service.ts` notification paths already recorded as `W1`/`W2` in A7                                      |

---

# B3 - SSM, dev against prd

**56 parameters exist under `/kambriq/dev`. Under `/kambriq/prd` and
`/kambriq/prod` there are `0`.** prd has never been provisioned, which matches
ADR-005.

## An operational fact that governs all four lists

**Only 7 of the 56 are injected into a task definition as `secrets`:**
`api/DATABASE_URL_{CORE,KBS,KAMNET,LANDS}`, `api/JWT_SECRET`,
`web/JWT_EXPIRES_IN`, `web/NEXTAUTH_SECRET` (injected under the env name
`AUTH_SECRET`).

The other 49 reach the container as **plain `environment` entries whose values
terraform rendered at apply time**. So for those 49, `aws ssm put-parameter
--overwrite` changes **nothing** in the running system until a terraform apply
re-renders the task definition.

**This scopes a claim made during H2.** "A typo costs a parameter update, not a
deployment" is true of the **bootstrap prefix**, because
`prisma/bootstrap-admins.ts` reads it at runtime through the SSM SDK. It is
**false** of the other 49. The distinction is the reader, not the store.

## List 1 - what dev has today (56)

`api/` 44, `web/` 5, `db/` 1, plus the 12 bootstrap parameters counted inside
`api/`. Full list in `/kambriq/dev` via `get-parameters-by-path --recursive`.

## List 2 - what prd will need

Everything in list 1 minus lists 3 and 4, with prd values, **plus** the two things
that are not parameters:

- **the bootstrap prefix, in full** - see the worked example below;
- **the API task role's `ssm:GetParameter` on `/kambriq/prd/api/*`.**
  `modules/iam-roles-ecs/main.tf:75` is parameterised on `var.env`, so it follows
  automatically **provided `envs/prd` instantiates that module.** Not verified -
  `envs/prd` was not read in this pass. Flagged rather than assumed.

## List 3 - what must never exist in prd

| Parameter                                         | Why                                                                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `api/PAYPAL_ENVIRONMENT = sandbox`                | a value naming a test environment. Nothing reads it today, so it is harmless today - and it is exactly the shape that becomes harmful the day something does                               |
| `api/EMAIL_TRANSPORT` if ever set to `console`    | not currently set on dev (schema default `ses`). Listed because a prd copied from a dev that had it would send nothing and report success - the seven-month defect, reintroduced by a copy |
| `api/STORAGE_TRANSPORT` if ever set to `disabled` | same shape                                                                                                                                                                                 |
| `db/DB_PASSWORD` copied from dev                  | it is the RDS master password. prd needs its own                                                                                                                                           |
| the 12 `api/bootstrap/*` values copied from dev   | they are personal data and they are per-environment identities                                                                                                                             |

**No dev-only feature flag or test switch was found.** Searched the 56 names for
`DEBUG`, `TEST`, `MOCK`, `FAKE`, `STUB`, `SANDBOX`, `DRY_RUN`, `SKIP`, `DISABLE`,
`BYPASS`: the only hit is `PAYPAL_ENVIRONMENT`'s **value**, not a name.

## List 4 - read by nothing, or by code that no longer exists

**Method, and a correction to my own first attempt.** The first sweep matched the
last path segment as a literal against the webapp tree and produced 22 names. At
least three were wrong: `web/NEXTAUTH_SECRET` is injected under the env name
`AUTH_SECRET`; `web/JWT_EXPIRES_IN` is injected as a secret; `db/DB_PASSWORD` is
read by **terraform**, at `modules/ssm-app-parameters/main.tf:18-22`, to compose
the four `DATABASE_URL_*`. **A name-based sweep cannot see a rename or a
non-application reader.** The list below is the intersection of "no match in the
webapp tree" and "not injected into any task definition by ARN", which removes
those three classes.

Candidates, and the confidence I have in each:

| Parameter                                                                                                                                                                                         | Confidence                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/PAYPAL_ENVIRONMENT`                                                                                                                                                                          | **confirmed unread** - traced end to end above                                                                                                                                                                        |
| `api/CONTACT_WHATSAPP_NUMBER`                                                                                                                                                                     | **confirmed unread by the API.** No WhatsApp sender exists (B2). `apps/web` has its own `site.config.ts` number                                                                                                       |
| `api/VERIFICATION_COST`                                                                                                                                                                           | **likely unread** - KAMBRIQ VERIFY does not exist as a module (B4)                                                                                                                                                    |
| `api/REFERRAL_CODE_EXPIRATION_HOURS`, `api/REFERRAL_INVITATION_TOKEN_EXPIRATION_HOURS`                                                                                                            | **likely unread** - no referral feature found                                                                                                                                                                         |
| `api/DEFAULT_VISITOR_ROLE_ID`                                                                                                                                                                     | **likely unread** - no `VISITOR` role in `RoleCode`                                                                                                                                                                   |
| `api/JWT_ALGORITHM`, `api/JWT_EXPIRES_IN`, `api/JWT_REFRESH_EXPIRES_IN`, `api/PASSWORD_RESET_TOKEN_EXPIRATION_HOURS`, `api/COOKIE_SECURE`, `api/COOKIE_SAME_SITE`, `api/AWS_SES_TO_ADMIN_CONTACT` | **candidates only.** Several have same-named-but-differently-spelled counterparts that ARE read (`JWT_ACCESS_EXPIRATION`, `RESET_TOKEN_EXPIRY_HOURS` as a code constant). Each needs a per-name check before deletion |
| `web/NEXT_PUBLIC_*` (4)                                                                                                                                                                           | **candidates only** - `apps/web` was not swept as thoroughly as the API in this pass                                                                                                                                  |

**Nothing in this list should be deleted on the strength of this table alone.**
The confirmed row is one; the rest are a work list.

## The worked example: the bootstrap prefix

**dev, today:** 12 parameters, `SecureString` under `alias/aws/ssm`,
`/kambriq/dev/api/bootstrap/{admin1,admin2}/{EMAIL,FIRST_NAME,LAST_NAME,PHONE,CITY,COUNTRY}`.
Three at version 2 after the 2026-09-06 correction, nine at version 1.

**prd needs:** its own 12, with prd identities, plus the task role's read
permission on `/kambriq/prd/api/*`, which `D6` states. Because the bootstrap reads
them **at runtime through the SDK**, prd values can be corrected with
`put-parameter` alone - the one place in the estate where that is true.

**Two prd-specific consequences, neither of them settled here:**

1. the deploy step **fails the deploy** when a parameter is missing or blank
   (deliberately - `CLAUDE.md`). A first prd deploy with an unprovisioned prefix
   therefore fails, correctly and loudly. It must be provisioned **before** the
   first prd deploy, not discovered by it;
2. the accounts are created with `emailVerified: false` and no password, and the
   bootstrap now enqueues a verification email. **On prd that email goes to real
   people the moment the first deploy runs.**

---

# B4 - the journeys never exercised

Two questions per journey, kept apart: **does the path exist end to end**, and
**has it ever run**. Conflating them is how S1 stayed broken for seven months.
Evidence for the second is rows, log lines or metrics - never the presence of a
route.

**This is not A3.** A3 is a person walking the product and reporting friction.
B4 is whether the path is there at all.

## 1. Identity document upload - **exists; half of it has run, half never has**

|                   |                                                                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Path**          | `POST /users/me/id-document/upload-url` (`users.controller.ts:77`), `PATCH /users/me/id-document` (`:140`), `PATCH /users/:id/id-document/review` (`:155`, `@Roles(ADMIN_GLOBAL)`). Complete end to end |
| **Evidence, dev** | 136 users. **57 hold an uploaded document and status `pending`.** `none`: 11. **`verified`: 0. `rejected`: 0**                                                                                          |

**The submit half runs on every deploy** - journey 3 submits a document. **The
review half has never run once.** 57 documents are queued for a review that has
never happened, and the queue grows by one per deploy.

The route exists, is guarded, and has a service method with tested branches. It
has never been called against a real document. **A back-office queue that only
ever grows is the "rien ne peut dormir en silence" shape, arriving in identity
rather than in money.**

## 2. KAMBRIQ VERIFY - **does not exist**

|                 |                                                                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Path**        | **none.** `apps/api/src` contains `app assets core health kamnet kbs lands newsletter` - no `verify` module. `prisma/` has `core kbs kamnet lands` - no verify schema              |
| **What exists** | `DATABASE_URL_VERIFY` in `.env.example:11` and as `z.string().optional()` in `envSchema:14`, and `api/VERIFICATION_COST` in SSM. Placeholders, correctly declared, reading nothing |
| **Evidence**    | not applicable - there is no path to have run                                                                                                                                      |

Distinct from `/kbs/public/verify-certificate`, which **does** exist and is proven
(journey 3, `valid: true`). Certificate verification is not KAMBRIQ VERIFY.

## 3. The admin back-office - **exists; parts of it have never run**

| Route                                                    | Ever run on dev?                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| `GET /users`, `GET /users/:id`, `GET /users/roles`       | **yes** - used by this audit and by journey 5                          |
| `POST /users/:id/roles`, `DELETE /users/:id/roles/:code` | **yes** - H4, H6 and journey 5                                         |
| `POST /users/:id/block`, `POST /users/:id/unblock`       | **never.** 0 of 136 users carry `deactivatedBy`                        |
| `PATCH /users/:id/id-document/review`                    | **never** - see 1 above                                                |
| `POST /lands/admin/reservations/:id/documents-received`  | **never** - 0 rows                                                     |
| `.../dossier-started`                                    | **never** - 0 rows                                                     |
| `.../complete`                                           | **never** - 0 rows                                                     |
| `.../confirm`, `.../payment-confirmed`                   | **never against a real reservation** - the one confirmed row is seeded |
| `.../cancel`                                             | **yes** - 27 cancelled rows, most from journey cleanups                |

**Five reservation admin routes out of seven have never been exercised**, and they
are the ones that carry the sale forward. Only `cancel` has real traffic, and it
comes from tests cleaning up after themselves.

## 4. Account reactivation - **exists; never run**

|                   |                                                                                                                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Path**          | `DELETE /users/me` soft-deletes and sets `deletedAt`; login returns `requiresReactivation` inside the grace period; `POST /auth/reactivate` (`auth.controller.ts:161`, `@Public()`) restores. Complete end to end, and `GRACE_PERIOD_DAYS = 30` |
| **Evidence, dev** | **0 of 136 users have `deletedAt` set.** No account has ever been soft-deleted, so the grace-period branch has never been entered and reactivate has never been called                                                                          |

Note it is now also **partly blocked by design**: `DELETE /users/me` refuses for
the last active `ADMIN_GLOBAL` (H4). That guard is proven; the reactivation path
below it is not.

## Checked and clean

| Class                      | Result                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| Routes with no page (web)  | **clean** - `routes-have-pages.spec.ts` covers it                                             |
| Public surface             | **clean** - `route-guards.spec.ts` pins 14 `@Public()` routes across 4 controllers            |
| The four original journeys | **proven and running**, 14 assertions green on `sha-1709ec6`'s predecessor under the sha gate |

---

# What this audit cannot settle

Stated, because an audit that does not know its limits reports them as absences.

1. **Whether a route has run in an environment other than dev.** prd does not
   exist; there is no other environment. Every "never run" above means _never run
   on dev_, and dev is the only place it could have.
2. **Whether a parameter is read by `apps/web` at build time.** Next.js inlines
   `NEXT_PUBLIC_*` at build; this pass swept the web tree by grep only, and did
   not read a built bundle. The four `web/NEXT_PUBLIC_*` candidates in B3 list 4
   are therefore weaker than the API ones.
3. **Whether `envs/prd` instantiates `iam-roles-ecs`.** Not read. B3 list 2 flags
   the task-role permission as _following automatically if it does_, which is a
   conditional, not a finding.
4. **Whether the 57 pending identity documents are real files in S3.** The rows
   carry `idDocumentUrls`; no object was fetched. A row naming an object is not
   an object.
5. **Whether any G-chantier has work in an unmerged branch.** Only `develop` at
   `1709ec6` was read. A branch is not a state of the system, but it would change
   "not started".
6. **Anything about money already collected outside the platform.** The design
   says notaries and mobile money are the real channels. **Zero payments in the
   database is a statement about the database**, not about whether KAMBRIQ has
   been paid.
7. **The B2 sweep is call-site based.** It found degraded modes by reading
   branches and return types. A degraded mode implemented by returning a
   plausible _value_ rather than by an early return would not be caught by this
   method - `[{},{},{}]` was found by running the endpoint, not by reading it.

# kambriq-webapp — Agent guide

Deliberately narrow: the chantier register and the rules that keep it honest.
Not an architecture guide; do not infer conventions from its silence.

**This file is the master.** The KAMBRIQ project copy is the archive. On
disagreement, this file wins.

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

### L3 — Migrate logging to PinoLogger structured fields — `DECIDE, A FAIRE`

`%o` makes payloads **readable** but not **queryable**: the object is serialised
into the message string, so CloudWatch Insights cannot filter on `userId` or
`examId` as fields. Migrating to `PinoLogger`'s `info(obj, msg)` puts them at the
top level of the JSON, which is what the migration buys.

**Decision:** do it later, as its own chantier. Roughly 102 call sites plus DI
changes, and it should not ride along with a change whose value is that it is
mechanical. **Cost: none.**

### R1 — A role code written as a string, and a list of promises — `EN COURS`

Three defects the role sweep found while looking for something else. Two of them
break journeys the functional tests are about to certify, so they were fixed
rather than filed.

**1. A client created by a reservation had no roles.**
`findOrCreateClientUser` read `where: { code: 'client' }` against a stored
`'CLIENT'`. Case-sensitive comparison, `null`, and an `if (clientRole)` that
swallowed it. `@Roles(RoleCode.CLIENT)` gates the whole client portal, so the
reservation returned 201, the portal-access email sent, the job was green, and
**the only symptom was a person who could not get into the thing they had just
been invited to.** The week's pattern with somebody at the end of it.

**The one-word change is not the deliverable.** A string literal where a constant
exists is the defect; the casing is how it surfaced. `RoleCode.CLIENT` cannot be
miscased — TypeScript rejects `RoleCode.Client`, and you do not need a database
to find out. Registration was correct only by the accident of having spelled the
constant, and accidents do not survive the next person in the file.

**So the literal is banned.** `role-code-literals.spec.ts` scans
`apps/api/src`, `libs/common/src` and `prisma/` and fails on any role code
written as a bare string, in either case. The enum is the single exemption; the
seed now uses `RoleCode.*` too, so the codes the database stores and the codes
the application looks up come from one declaration. A missing role is now a
throw rather than a silence: a client user without the client role is a row whose
email promises access that is not there.

**Enforced as a test, not a lint rule, on purpose.** CI runs `nx lint api` only,
so a rule covering `libs/common` and `prisma/` would not actually run — and an
enforcement that does not run is worse than none, because it reads as covered.

**2. `GET /users` returned `[{},{},{}]` with `meta.total: 14`.**
`toUserResponse` is async and the map was not awaited, so `data` was an array of
pending Promises, and `JSON.stringify` renders a Promise as `{}`. **200, correct
envelope, correct pagination, no data.** Every signal healthy except the one
carrying the answer.

**It is the same missing `await` as A3**, which shipped `?token=[object
Promise]` — the second time the same mistake reached dev on a different surface.
`Promise<T>[]` is a perfectly good array, so the type system separates the two no
better here than it did there.

**Its test asserted `toHaveLength(2)`.** An array of two Promises has length two.
Shape, count, envelope and pagination are exactly what this class of defect
preserves. **The envelope contract tests in the remaining scope must assert on
content** — a contract test checking `{success, data}` would have passed this
one, which is the whole reason to write them differently.

**3. The dormant `GRANT_KCA_ROLE` handler is gone.** Confirmed empty first, not
assumed: `waiting 0, active 0, delayed 0, paused 0, failed 0` on the `kbs`
queue, with the name appearing only among historical completions. It now falls to
the default branch and throws. The constant is removed too, so re-enabling it is
a decision rather than an accident.

**`CANDIDATE_KBS` needs no action, only this line.** It is granted self-service
on enrolment and there is no `@Roles(RoleCode.CANDIDATE_KBS)` anywhere. **A label
that looks like a permission is a trap for whoever gates on it next assuming a
check exists.**

**Proof: seven tails, seven mutations**, each observed failing alone:

| #   | Mutation                                   | Test that fired                                                      |
| --- | ------------------------------------------ | -------------------------------------------------------------------- |
| 1   | `code: 'client'` restored                  | no file writes CLIENT as a string literal                            |
| 2   | `code: 'CLIENT'` — right value, wrong form | the same test, so the ban is on the literal not the casing           |
| 3   | missing role silent again                  | fails loudly when the client role is missing                         |
| 4   | lookup kept, assignment dropped            | looks the role up by the constant, and actually assigns it           |
| 5   | the retired KCA grant routed again         | no longer routes the retired KCA role grant                          |
| 6   | the user list stops awaiting               | returns users, not promises — `Expected constructor: not Promise`    |
| 7   | the convention scanner finds no files      | is looking at the source tree at all — `Expected: > 50, Received: 0` |

**A defect in my own matcher, recorded rather than tidied away.** The first
version used `['"`]…['"`]`and flagged the French question bank: in`"Il a changé d'agent"` the apostrophe opened a match the closing double quote
finished. Back-referencing the quote fixed it. Found by the measurement, in the
measurement.

**Live on dev, `kambriq-dev-api:116` / `sha-f069f9d`:**

```
GET  /users?limit=3        200  rows: 3  total: 14   first row: {id, email, firstName, …}
POST /lands/reservations   201  clientUserId ba2c538c-…
GET  /users/ba2c538c-…          CLIENT USER ROLES: ['CLIENT']
```

**Taking the third part of that proof — the client reaching a portal route —
found a fourth defect on the same journey**, recorded as R2 below.
**Cost: none.**

### R2 — The invited client could set a password and still not log in — `EN COURS`

The client used the set-password link from their invite email, got **204**, and
then:

```
POST /auth/login  ->  401  "Veuillez vérifier votre adresse email avant de vous connecter"
GET  /users/<id>  ->  emailVerified: false, roles: ['CLIENT']
```

They were invited by an agent, **proved control of the mailbox by returning a
secret delivered to it**, and were told to prove it again with a verification
link they were never sent. There is no way out of that state from the client's
side. Every step before the login succeeded, which is why nothing surfaced it.

**Decision:** consuming a password-reset token marks the address verified. It is
the same evidence `verify-email` accepts — a secret sent to that address and
returned. Requiring it twice is not extra safety, it is a dead end.

**The existing test asserted `$transaction` had been called and never what it
was called with**, so the entire content of that write was unexamined.

**Proof: two tails, two mutations**, each observed failing alone — dropping
`emailVerified` fails _"marks the email verified"_; dropping the password and
lockout fields fails _"still sets the password and clears the lockout"_, so the
new field cannot quietly displace the old ones.

`EN COURS` until an invited client logs in and reaches `/lands/client/purchases`
on dev. **Cost: none.**

**A measurement defect of mine, on the way.** I read `inbox[0]` from the client's
mailbox, found no link, and was about to record "the invite email carries no
link". There were **two** messages: the newest was the portal-access notice, and
the invite with a valid 64-hex token was the second. Reading the first element of
a list is not reading the list. That is the fifth of these this week, and the
second where I nearly filed a defect that did not exist.

**One real thing did come out of that email, though.** The portal-access notice
says _"Votre agent KAMNET : 00000000-0000-4000-8000-b00000000005"_ — it prints
the agent's raw user UUID where a name belongs, to a client. Not fixed here;
recorded.

### Z1 — Three never-used access keys, one of them full admin — `A DECIDER`, prepared not applied

**This outranks every number in the cost table.** `gitops.admin` holds an
**Active** access key created 2026-02-24 whose `LastUsedDate` is `None`. It
reaches `AdministratorAccess` through the `gitops-admin` group, of which it is
the only member. **A full-admin credential nobody has ever used is a credential
nobody would notice being used.**

Re-checked at 2026-09-04T10:49Z, not at first sight:

| User              | Key                    | Last used  | Service                           |
| ----------------- | ---------------------- | ---------- | --------------------------------- |
| `gitops.admin`    | `AKIAQYAF4F4JLEEQ5ARN` | **never**  | —                                 |
| `ses-kambriq-app` | `AKIAQYAF4F4JNP3WKQMQ` | **never**  | —                                 |
| `kambriq-app-dev` | `AKIAQYAF4F4JLQKD3DWT` | **never**  | —                                 |
| `kambriq-app-dev` | `AKIAQYAF4F4JH34UGKU5` | 2026-08-27 | `s3`                              |
| `vmiaff`          | `AKIAQYAF4F4JNTH6MZ2I` | 2026-09-04 | `logs` — **in use, do not touch** |

#### Nothing depends on them — checked, not assumed

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

### T1 / N1 — Guards, roles and the envelope contract — `EN COURS`

**The live sweep, `kambriq-dev-api:117` / `sha-d27d6e0`.** Every guarded
controller, probed with no token, with a role the hierarchy does **not** imply,
and with an allowed role:

| Controller      | Route                        | no token   | wrong role           | right role |
| --------------- | ---------------------------- | ---------- | -------------------- | ---------- |
| `core/users`    | `/users`                     | 401        | 403 (`ADMIN_KBS`)    | 200        |
| `kbs/admin`     | `/kbs/admin/candidates`      | 401        | 403 (`ADMIN_KAMNET`) | 200        |
| `kbs/candidate` | `/kbs/courses`               | 401        | —                    | 200        |
| `kamnet/admin`  | `/kamnet/admin/applications` | 401        | 403 (`ADMIN_KBS`)    | 200        |
| `kamnet/agent`  | `/kamnet/agents/me`          | 401        | 403 (`CLIENT`)       | 200        |
| `kamnet/agent`  | `/kamnet/applications/me`    | 401        | 403 (`CLIENT`)       | 200        |
| `lands/admin`   | `/lands/admin/reservations`  | 401        | 403 (`ADMIN_KBS`)    | 200        |
| `lands/agent`   | `/lands`                     | 401        | 403 (`CLIENT`)       | 200        |
| `lands/client`  | `/lands/client/purchases`    | 401        | 403 (`ADMIN_KBS`)    | 200        |
| `health`        | `/health`                    | 200 public | —                    | —          |
| `kbs/public`    | `/kbs/public/verify/:kca`    | 200 public | —                    | —          |

The wrong-role column is chosen against `ROLE_HIERARCHY`, not by convenience:
`ADMIN_GLOBAL` implies everything, so it can never be a wrong role, and
`ADMIN_KBS` is lateral to `ADMIN_LANDS` and `ADMIN_KAMNET`, which is what makes
it a real refusal rather than an accident of ordering.

**The regression mechanism is about the opt-out, because that is where the risk
is.** `JwtAuthGuard` and `RolesGuard` are global, so every route is
authenticated unless a decorator removes it. `route-guards.spec.ts` therefore
pins the **public surface as a list** — 9 on `auth`, 3 on `health`, 1 on
`kbs/public`, 1 on `newsletter`, 0 everywhere else — so adding a `@Public()`
becomes an edit to that list and a reviewed decision, rather than a line nobody
sees. It also pins the class-level `@Roles` on the five role-gated controllers:
**a deleted `@Roles` downgrades an admin controller to "any authenticated user"
without changing a single response shape.**

**The envelope contract asserts on content, because shape is what the defect
preserves.** `GET /users` served `{"success":true,"data":[{},{},{}],"meta":{"total":14}}`
— 200, correct envelope, correct pagination, no data. A contract test checking
`{success, data}` would have passed it; so would `Array.isArray(data)`,
`data.length === 3`, or `meta.total`. **Every one of those is true of a list of
Promises.** `envelope-contract.spec.ts` boots a real server, serves that exact
defect from a probe route, shows every shape assertion passing on it, and then
fails it on content — no empty objects, nothing serialising to `{}` or
`[object …]`. `expectCarriesContent` is exported for each module's list
endpoints to reuse.

**Proof: seven tails, seven mutations**, each observed failing alone:

| #   | Mutation                                        | Test that fired                                                                 |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | a `@Public()` slipped onto an admin controller  | exposes exactly the declared number of public routes — `Expected 0, Received 1` |
| 2   | class-level `@Roles` deleted                    | still declares its class-level roles — `Received string: ""`                    |
| 3   | a declared public route removed                 | the same test, the other way — `Expected 1, Received 0`                         |
| 4   | the global `RolesGuard` unwired                 | the global guards are wired, so authentication is opt-out                       |
| 5   | the controller scanner finds nothing            | found the controllers at all — `Expected >= 13, Received 0`                     |
| 6   | the envelope stops wrapping                     | wraps a plain payload in `{ success, data }`                                    |
| 7   | **the content check weakened to a shape check** | rejects a list of unawaited promises — _"Received function did not throw"_      |

**Mutation 7 is the one that matters.** It does not break the code; it weakens
the test. The contract test cannot be quietly downgraded to a shape check,
because the defect-reproduction case stops failing and says so.

**Two defects in my own probe, recorded.** I invented `/kamnet/me`, which does
not exist, and read its 404 as a missing guard — a route that is not there cannot
be unguarded. And I built the API root URL as `API + ''`, hit
`https://dev.kambriq.com/api/v1` with no trailing slash, and got the **Next.js**
404 page: without the slash the ALB does not match the API rule and falls through
to the web service. `/api/v1/` answers 401 and `/api/v1/nope` answers a JSON 404,
so N2 holds. Both were defects in the measurement, and both were briefly read as
defects in the thing measured.

`EN COURS` until the sweep runs from CI rather than by hand. **Cost: none.**

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
day the first real user account is created. `docs/adr/ADR-005` is the prd
bootstrap document; the retention period belongs on that checklist as an explicit
decision rather than a default carried over from dev.

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
Implementation is Ulrich's, on his own PR.

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

| ID  | Chantier                                                                                                                                                                                                                                                                                                                                                                       | Closed by                         | Proof                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Cost                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| B1  | SES: the API had never sent an email. Static-credential gate, no `ses:` grant, and the MessageId was never logged                                                                                                                                                                                                                                                              | infra #16 #17 #18; webapp #39 #41 | `messageId=010701a06a9fd24c-51cc2bd1-7d70-4715-a7a0-ee582c49ea1e-000000`; `AWS/SES Send` 1.0 and `Delivery` 1.0 at 03:43 and 04:14, `Bounce` none, from zero datapoints before                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Contact list free; two IAM policies free; one SSM parameter removed |
| Q1  | `CERTIFIED` was set by grading, on the score alone: certified with no certificate, no `kcaNumber` and nobody's name against it. `certificate/me` answered `{"data":null}` to somebody the API called certified — and grading also granted `KCA_CERTIFIED`, which gates the KAMNET agent routes, so **passing an exam made somebody an agent before any human had approved it** | webapp #54                        | Live on dev, `:108` / `sha-4be405b`, same candidate either side of one admin call. **Before issuance:** `EXAM_PASSED`, `certifiedAt: null`, `nextAction: awaiting-certificate`, `certificate/me: null`, roles `[CLIENT, CANDIDATE_KBS]`. **After issuance:** `CERTIFIED`, `certifiedAt` set, `nextAction: certified`, `KCA-20260904-LNG8`, certificates 7 → 8, roles `[CLIENT, CANDIDATE_KBS, KCA_CERTIFIED]`. The role arriving with the credential and not before it is the half that mattered. Five mutations, all firing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | None — no migration, the column is a `String`                       |
| V1  | A completed sale whose agent lookup failed logged an error and returned `null`, so BullMQ marked the job **completed**: sale recorded, job green, commission never created, and the only symptom available to anybody was an agent noticing they had not been paid. All four processors did the same on an unknown job name                                                    | webapp #58                        | Live on dev, `kambriq-dev-api:112` / `sha-fef4391`. Enqueued `kamnet.definitely-unknown-job` on the `kamnet` queue: `BEFORE failed=0 completed=0` → `AFTER failed=1 completed=0`, `reason=Unknown KAMNET job: kamnet.definitely-unknown-job`. It landed on the **failed** set with its reason, where before it would have completed silently. **Stated limit, not closed:** the probe queue used default job options, so `attemptsMade=1` — it proves the destination, not the three-attempt retry policy. Eight tails, eight mutations, each observed failing alone                                                                                                                                                                                                                                                                                                                                                                                                                                                          | None                                                                |
| W1  | `/reactivate` was in `PUBLIC_PATHS` with no page. `lib/actions/auth.ts` redirects there on `REACTIVATION_REQUIRED`, so a user in the soft-delete grace period — undoing a deletion, on a clock — hit a 404                                                                                                                                                                     | webapp #57                        | Live on dev, `kambriq-dev-web:71` / `sha-68f6c7f`: `/reactivate` **200** (was 404), `id="email"` and `id="password"` present. `days=12` → _"Il vous reste 12 jours"_; `days=1` → _"1 jour"_; `days=999999` and `days=<script>` and no `days` → the neutral _"Votre compte est encore dans sa période de restauration"_. Four tails, four mutations, each observed failing alone                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | None                                                                |
| B3  | KBS not demonstrable: `KbsQuestion` and `KbsExamQuestion` empty since the seed's single run on 2026-02-26, so the largest module (21 routes) could not be exercised                                                                                                                                                                                                            | webapp #47 #49 #50 #51            | Live on dev, `kambriq-dev-api:105`: quiz serves **10**, scores 100/10 and passes; exam serves **20**, `totalQuestions` 20, scores 100, `PASSED`; candidate status changed; **certificates 5 → 6** (`KCA-20260904-N4OY`) — **issued by an explicit admin call during the proof, not by passing.** The exam produced no certificate: `certificate/me` answered `{"data":null}` and the count moved only after `POST /kbs/admin/certificates/:id`. So 5 → 6 proves **issuance works when somebody triggers it**; it is not proof of an end-to-end certification chain, and the chain is deliberately not automatic (Q1). `/kbs/public/verify` returns `valid: true`. Idempotency: two local runs, identical counts. Distribution guard **demonstrated, not asserted**: forcing `9/8/8/5` fails all four banks on `<= 8`; `9/9/9/3`, the per-bank shape of a `31/31/29/10` skew, fails the same way; and `8/8/8/6` — upper bound satisfied — fails all four on `>= 7`, so both tails are observed rather than inferred. 235 tests | None                                                                |
| K2  | A candidate who passed every module was told to "finish all the modules". `checkAndTransitionToExamPending` returned silently on a null `activeCourseId` that the seed never set; `me/overview` answered `course: null` for the same reason                                                                                                                                    | webapp #51                        | `EXAM_PENDING` and `eligible: true` on dev after the fix; `me/overview` returns the course. Mutation: removing the log fails 1, reverting the seed's `update` branch fails 1. `kbsCandidate.updateMany` was absent from the shared mock — the defect was shielding the gap in its own coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | None                                                                |
| K1  | A perfect quiz scored **33%**. The grader divided by the module pool (30) instead of the quiz length (10), so nobody could pass a quiz or reach the exam                                                                                                                                                                                                                       | webapp #50                        | `{"score":100,"correctCount":10,"totalQuestions":10,"passed":true}` on dev, both modules. Mutation: restoring `questions.length` fails 2, removing the completeness check fails 1. Fixtures now hold pool 30 against quiz 10 — the old ones used 2 against 2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | None                                                                |
| S2  | Every seeded identifier — 47 literals, 480 generated — was rejected by the API's own `z.uuid()`: version and variant nibbles both `0`. 23 request-body fields across KBS, KAMNET and LANDS were unreachable with seeded data                                                                                                                                                   | webapp #49                        | Quiz and exam submission accepted on dev after a clean reset and re-seed of the four databases. A test runs all 600 emitted ids through the controllers' own validator, and asserts the literal count is above 40 so an empty match cannot read as a pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | None                                                                |
| N2  | `GlobalExceptionFilter` never executed, in any environment. `PrismaExceptionFilter` is `@Catch()`, wins as last-registered, and rethrew — escaping Nest into Express's HTML error page. Every 401/403/404/500 leaked a stack and broke the envelope                                                                                                                            | webapp #49                        | On dev: `GET /users/me` 401, `GET /nope` 404, wrong password 400 — all `application/json`, enveloped, no stack, no `node_modules`. Mutation: restoring the rethrow fails 5 chain tests while the 57 filter unit tests stay green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | None                                                                |
| E1  | Stack traces in HTTP response bodies, gated on `NODE_ENV`                                                                                                                                                                                                                                                                                                                      | webapp #47, closed by #49         | Mutation: restoring the `NODE_ENV` branch fails 1. The larger half was N2 — my first attribution of this leak to the filter's dev branch was wrong, and the not-found middleware I added in #48 deployed and never fired                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | None                                                                |
| A3  | Every verification email carried `?token=[object Promise]`. `createVerificationToken` called without `await` on the registration path only. No user had ever been able to verify an address                                                                                                                                                                                    | webapp #48                        | Live on dev: signup → mail received at maildrop → `token=d5163844cd9a11ec…` (64 hex) → verify 200 → login 200. Login before verifying correctly refused. `EmailService.send` now throws on any `[object …]` argument, covering every template including ones not written yet. **The cleanest example this project has of a proof that was true and still did not cover the thing it appeared to cover:** yesterday's item-1 proof held, because that path was a **resend, not a signup**. The resend worked. The registration never had                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | None                                                                |
| S1  | Storage: `S3Client` gated on `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, never set on Fargate. Every upload and download dead on dev since February                                                                                                                                                                                                                         | webapp #44                        | Round-trip on dev, `8003ddb` / task def `:100`: presigned URL signed with `ASIAQYAF4F4JDB6N4PDM` — STS credentials from the **task role**, the thing the gate was blocking; PUT 200; `head-object kambriq-media-dev` size 35, etag `333c6389…`; download URL 200; content identical. Mutation: restoring the gate fails 7 of 47 tests in `libs/common`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | None — the IAM grants already existed in `iam-media.tf`             |
| C2  | Middleware decision untested. A redirect loop shipped May 2026, fixed by accident in August, unnoticed                                                                                                                                                                                                                                                                         | webapp #38                        | 101 tests; removing `!isPublic(pathname)` fails 18. e2e public routes 5 → 20                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | None                                                                |
| C1  | Coverage measured only over files a test already imported; `apps/web` never ran in CI                                                                                                                                                                                                                                                                                          | webapp #37                        | api 70.8% → **29.8%** (16 of 60 files were measured); four modules at 0.0%                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | None                                                                |
| D1  | Prisma baseline: four dev databases under Migrate, `db push --accept-data-loss` unreachable                                                                                                                                                                                                                                                                                    | webapp #34 #35 #36                | `migrate deploy` ×4, "No pending migrations" ×4, no `db push`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | None                                                                |
| A1  | e2e uploaded an empty report every run while reporting green                                                                                                                                                                                                                                                                                                                   | webapp #32                        | `playwright-report` 207 530 bytes, was absent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | None                                                                |
| A2  | `scripts/smoke-test.sh` died on its first passing check under `set -e`                                                                                                                                                                                                                                                                                                         | infra #15                         | 8 passed / 0 failed under the CI OIDC role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | None                                                                |
| L1  | The SES MessageId was logged in a metadata object that `nestjs-pino` drops                                                                                                                                                                                                                                                                                                     | webapp #41                        | Mutation: restoring the object form fails 1 of 30 tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | None                                                                |

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

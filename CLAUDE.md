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

### Failing loudly and failing early are two different properties

A step that must fail the pipeline when it fails should sit **as late as its
dependencies allow**.

The bootstrap step was placed immediately after the migrations, because it needs
them. Loudness was the design and remains it: an environment deployed without an
administrator is not a successful deployment, so the step exits non-zero and
takes the run with it. But early placement bought nothing and cost everything -
when its postcondition refused two accounts, it blocked **every other step**:
both service deployments, the seed, the smoke test, both version checks.

dev stayed on the previous build. **Including the branch that fixed the very
defect that was blocking it** - the fix could not deploy, because the thing it
fixed would not let anything deploy. A pipeline that cannot ship its own remedy
is a pipeline with a single point of failure it put there itself.

The step depends on the migrations and on nothing else. Nothing downstream reads
what it writes; the smoke test does not, the version checks do not, the journeys
create their own accounts. So it belongs after both services are deployed and
before the smoke test - **same behaviour on failure, no hostage**.

**The general rule.** When placing a step that can fail the run, ask two separate
questions and do not let the answer to one decide the other:

1. _must it fail the pipeline?_ - about consequence;
2. _what actually depends on it?_ - about position.

"It is important, so it goes first" conflates them. Importance argues for the
first; only a real dependency argues for the second. The order is pinned in
`image-carries-seed-deps.spec.ts`, because moving it back is a one-line edit that
looks like tidying.

### A postcondition that asserted the history of a fact rather than the fact

The bootstrap verified that the super-admin grant had `grantedBy = 'bootstrap'`.
A role that had been revoked by a mis-aimed test and restored through the
ordinary admin route carries the acting administrator's id instead - **correctly;
that is what the column is for**. The next deploy's bootstrap refused the whole
environment, and would have refused every deploy from then on.

The account was in exactly the state the bootstrap exists to produce. The
postcondition read the provenance and called it a failure, which made the
remediation path for a missing role into the thing that permanently broke the
mechanism that maintains it.

**Assert the state you require, not the route by which it arrived.** Provenance
is worth checking only about work the run itself did - `grantedBy` is now
asserted only for accounts that run created, where it says something about this
run rather than about everything that has ever happened to the row.

### A false witness: a broken mechanism that looked like it worked

**The sharpest entry here, and the one that nearly cost a day.**

`H2` shipped a bootstrap that creates two administrators and **sends no email at
all** - it has no email code in it. Nobody noticed, because one of the two
accounts received a verification mail within twenty minutes of being created.

That mail came from a mis-aimed journey-5 run hitting that address through
`forgot-password`. The log even says so: `Password reset email sent`. **An
unrelated defect produced exactly the signal we were waiting for**, on exactly
one of the two accounts, and the second account's silence read as "not yet"
rather than "never".

**This is not the usual failure.** A mechanism that reports success by saying
nothing is a silence you learn to distrust. This was the opposite: a **signal
from the wrong source**, which is far harder, because the thing you were waiting
for did arrive. The control group existed only by accident - `contact@` was the
account the stray test happened not to touch, and its silence is what closed the
diagnosis.

**What to take from it.** When a signal arrives, attribute it before believing
it: which component emitted it, at what timestamp, for which subject. Two
accounts created in the same second behaved differently, and _that asymmetry was
the evidence_, not the arrival. Had the journey aimed correctly, nobody would
have received anything and the answer would have taken thirty seconds.

**And the corollary about tests:** a test that produces side effects on shared
state can supply the evidence for a claim about the product. Journey 5's stray
run wrote a real reset email into a real inbox and, for twenty minutes, that
email was the reason we believed the bootstrap sent mail.

### A preference may not suppress a transactional message

From `A11`. `sendUpdate` honoured `emailNotifications` and returned the **same
`Promise<void>`** whether it queued a message or dropped it, logging the drop at
`debug`. The column **defaults to `false`**, so the skip was the normal path and
no caller could tell. On dev, all 70 users with a profile row have it `false` and
**not one has it `true`**; the deployed log carries real suppressions of
`examPassed`, `certificateIssued`, `reservationCreated` and `reservationCancelled`.

The preference was never the defect. **The signature was**: a mechanism that
reports success by saying nothing, arriving through a return type.

Two things close it, and both are needed:

- `sendUpdate` returns an `EmailOutcome` - `{status:'queued'}` or
  `{status:'suppressed'}` - so a drop is a value the caller receives;
- it **throws** on a transactional template. `SUPPRESSIBLE_TEMPLATES` is an
  **allow-list**, so a template nobody classified is transactional and cannot be
  suppressed by accident. The old docstring already said _"NEVER use this for
  auth, security, compliance or onboarding emails"_ and twelve of the fifteen
  messages routed through it did exactly that - **because a comment refuses
  nothing.**

**Transactional is not a synonym for important.** It means the message carries a
reference, a deadline, money, an outcome the person is entitled to, or an action
they must take. Three messages are suppressible and all three are the same shape:
two work notifications to an **agent** about their own client, and one status
announcement the recipient can already see in their dashboard.

### Do not offer a preference without the capability behind it

From `A12`. `whatsappNotifications` was accepted, stored and echoed back, and
**there was no WhatsApp sender in the API at all**. Every statement the API made
was true and the exchange was false, because offering a preference implies the
capability.

Removed from the API surface and from the web; the column is kept so no stored
value is lost. **Not** labelled "not yet available": a disabled control still
asks a person to form an intention the system cannot honour and stores it, so on
the day a sender exists the stored values are old intentions expressed against a
dead control. And a label is honest only if it is read, where an absent control
needs nobody to read anything - the same reason a guard belongs in a hook rather
than in a test.

`no-unbacked-preference.spec.ts` fails if the preference returns to either
surface, **and also if somebody builds a WhatsApp sender** - which is the moment
to bring it back properly.

### A backlog must answer how many and how long

From `A10`. The identity-review route existed, `ADMIN_GLOBAL` existed, and the
route had **never been called once**: 59 documents sat at `pending`,
`verified: 0`, `rejected: 0`, growing by one per deploy. Neither the route nor
the role was missing. **The queue was** - the only way to find a pending document
was to page through every user and look.

And the data could not be aged: the profile recorded when a document was
**verified** and never when it was **submitted**, so "how long has this been
waiting" had no answer at all. `idSubmittedAt` was added for that reason.

**A count answers "how many". It does not answer "how long has somebody been
waiting", and that is the question a backlog exists to answer.** The queue is
ordered oldest-first, carries `waitingDays` per row and `meta.oldestWaitingDays`
on the envelope. Same principle as the payments en souffrance: nothing may sit
indefinitely with nobody accountable.

### A setting that is stored, echoed back, and read by nothing

`UserProfile.whatsappNotifications` is accepted by `PATCH /users/me`, persisted,
and returned by `GET /users/me`. **There is no WhatsApp sender anywhere in the
API** - every other match for `whatsapp` in the repo is `apps/web` rendering a
`wa.me` link.

So a user turns the setting on, gets a `200`, sees `whatsappNotifications: true`,
and will never receive a WhatsApp message. **Every statement the API makes is
true** - it did store the preference - and the whole exchange is false, because a
preference implies a capability.

This is the "reports success by saying nothing" family arriving through
configuration rather than through a job. The usual shape is a mechanism that
succeeds while doing nothing. This one is a mechanism that **correctly** reports
doing the only thing it does, where the thing worth doing does not exist.

**Before adding a preference, name the code that reads it.** A column is not a
feature, and a setting nobody consumes is a promise the product has not made.

### Per-address delivery is not a thing CloudWatch can tell you

`AWS/SES` publishes `Send`, `Delivery`, `Bounce`, `Complaint` and `Reject` as
**account- and region-level** counters. There is no recipient dimension. Checking
"did _this address_ receive it" against CloudWatch is not a stricter version of
checking the total - it is not available at all.

It becomes available only with an SES **configuration set** carrying an event
destination, and the API sets no `ConfigurationSetName` on any send;
`list-configuration-sets` returns nothing. Until that exists, the honest signals
are: a `Bounce` delta around a single known send (usable only because volume is
low enough to attribute by timing), and the recipient saying so.

`kambriq.com` MX points at Google Workspace, so whether a given local part
resolves to a mailbox, an alias, a group, or nothing is a Workspace question and
not an AWS one. **A zero bounce count is evidence the address was accepted, not
that a person can read it.**

### dev holds real people's accounts now

**This is the entry that outlives the incident.** Until 6 September 2026 dev held
nothing but seeded fixtures, and a journey could write freely because everything
it could reach was disposable. `H2` put two real administrators in that database,
and they exist in every environment by design.

**dev is no longer an environment where a test may write freely**, and nothing
about it announces the change. The seed still looks like the whole population.
The API answers the same. The only difference is that some rows now belong to
people, and a test cannot tell which by looking.

**Any journey that mutates state must prove its target is its own, before it
writes.** Not "matches a test-looking pattern" - a real address can match a
pattern, and the address that cost us was a real one that a pattern was asked
about. Prove **provenance**: the identity was minted by the run itself, and the
row being written to reads back as that identity. `uniqueEmail` / `assertMinted`
/ `assertOwnedByThisRun` in `apps/api-e2e/src/journeys/support.ts` are that, and
they are the minimum for anything new.

The next environment to cross this line is prd, and it will cross it with no
announcement either.

### A test's cleanup is a write like any other

And it inherits none of the caution of the test body.

Journey 5's `afterAll` revoked `ADMIN_GLOBAL` from a real administrator fifteen
seconds after he set his own password. Every line of it read as tidiness: a
`DELETE` on `userId`, a variable set earlier in the same run, guarded by
`if (userId)`.

**The variable was the whole defect.** `POST /lands/reservations` returns
`clientUserId`, and for an address that already exists that is the **existing
person's** id — `findOrCreateClientUser` returns rather than creates. So
`userId` held a real account's id, the cleanup could not tell, and `if (userId)`
was true.

Cleanup gets read as housekeeping and reviewed as housekeeping. It is the part
that runs **even when the test body failed**, which is exactly when the state it
is reasoning about is least trustworthy. A cleanup must prove ownership against
the database immediately before it writes, and it must refuse rather than skip:
`assertOwnedByThisRun` throws, because a cleanup that quietly does nothing leaves
the residue the next run trips over.

### An investigation that stops at the first finding reports it as the whole

Reported that afternoon: _"Nobody was locked out and no account changed state.
One unexpected email is the whole damage."_

That was wrong, and the method that produced it is the point. The run was traced
forward as far as the email, the token was confirmed to have expired unconsumed,
and the trace stopped there — at the first thing found, which happened also to be
the first thing that happened. The `afterAll` was two minutes further on and
revoked a role.

**A run is not audited until every write it made has been enumerated**, from the
log rather than from the code, and each one marked reverted or not. Not "what did
it break", which stops when you find something: **"what did it touch"**, which
stops when the list is exhausted. The same shape as the mailbox read where
`inbox[0]` was taken for the mailbox.

### A guard that reports instead of preventing, and Jest's part in it

Journey 5 must never run against a real administrator's address: it consumes a
single-use reset token, and spending a real holder's would lock them out of
activating their own account. The rule was written as the journey's first test,
asserting the target address — deliberately, so that it would be enforced rather
than remembered.

**Mutated, it failed exactly as designed and prevented nothing.**

```
Expected pattern: /@maildrop\.cc$/
Received string:  "…@kambriq.com"
```

Then the other four tests ran, because **Jest does not stop a `describe` at its
first failing test.** The run reached `forgot-password` and sent a real
password-reset email to a real person's inbox. It went no further only by luck:
the suite cannot read that mailbox, so the token timed out unconsumed instead of
being spent.

**A failing assertion records that something was wrong. It does not stop it.** A
check whose job is to prevent an action belongs in `beforeAll` — a throw there
means no test body executes at all — and the `it` proves the check's logic rather
than standing in for it. Re-mutated against the barrier: five tests failed on the
hook, **zero API requests, zero SES sends**, in seven seconds instead of two
minutes.

This is also the clearest case yet of the rule two headings up. Reading the guard
said it was enforced. Running it said otherwise, and the difference was a real
email to a real person.

### A record that overstates its own uncertainty

The `H2` register entry flagged three values as inferred when only one was. The
brief had quoted both email local parts; the only thing actually read into it was
the TLD, `comp` for `com`. Two correct values were made to look doubtful, and the
one genuine invention - a surname the schema required and the brief never gave -
was buried among them.

**Hedging is not free and it is not neutral.** It reads as care, which is why it
survives review, and it costs exactly what a false claim costs: somebody
re-checks what was already right, and the flag that was real gets the same weight
as the two that were not. A record misleads in both directions.

**Mark what you inferred, and only what you inferred.** If three things are
uncertain, say three. If one is, say one, and say which.

### A key you can still correct is not the same as a field you can still correct

`bootstrap-admins.ts` upserts on email. Every other field is reconciled on the
next run; **the key is not, because changing it creates a row rather than
updating one.** A wrong address corrected after the first run leaves a super
admin at the wrong address, a verification email already sent to it, and a second
account created by the correction itself.

Nothing here failed - the address was right when it mattered. The rule is kept
because the cost is asymmetric and the window is short: **a parameter that forms
an upsert key is corrected before the mechanism that reads it runs, not after.**
Correcting first costs one command.

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
`role-code-literals.spec.ts` bans them across `apps/api/src`, `libs/common/src`,
`prisma/`, `apps/web/src` and the e2e suite. It covered only the first three
while every web gate was a bare string - which is how a role that does not exist,
`ROOT`, came to guard a real layout (`I18`). The web imports the enum once,
through `apps/web/src/lib/roles.ts`. The enum is the only exemption for a role
code; a word merely spelled like one (a translation key, a URL segment) is
exempted per file with its reason, and the exemption fails once it stops
matching.

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

### A test that asserts a behaviour is a test that requires it

G3's suite contained _"every channel detail reaches the message"_ and _"repeats
the instructions rather than referring to them"_. Both passed. Both were the
defect written down: the platform emailed the bank account, the mobile money
number and the notary's address to anyone who clicked, and then emailed them
again in the reminder.

The reasoning behind each was sound — a message should be complete; a person who
needs a reminder cannot find the first message. The conclusion was wrong, and
having it as a green test made it **harder** to see, because the suite was
agreeing with it.

When a design changes, the tests that encoded the old design do not merely need
updating — they are the clearest statement of what was wrong, and inverting them
is the fix. **Ask of a passing assertion: if this behaviour were wrong, would
this test tell me, or defend it?**

### Two fields that mean different things must not be allowed to merge

A client's _wish_ and the _record of what was used_ look interchangeable right up
to the day they differ — and on that day, one field cannot say which one you are
reading. So `preferredChannel` and `channel` are separate columns, and the rule
is checked from three directions: the write path must not touch the preference,
no read may fall back to it, and both columns must exist.

`channel ?? preferredChannel` is the merge written defensively, and it is the
form it will actually take — nobody deletes a column on purpose; they add a
fallback to fix a null.

### A guard placed at the end of a sequence guards nothing that happened first

The identification gate lived in `transition`, which is the choke point every
state change passes through — the right place, and it looked complete. But the
send _emails first and transitions afterwards_, deliberately, so that the state
never claims a message that did not go. The gate therefore let an unverified
client receive the notification and merely stopped the state from moving.

Found because the test asserted `email.send` was not called and counted two.
**When ordering is itself a designed property, check the guard against the
order** — not just against the state machine.

### An enum you rename is a migration; an enum you narrow is a rewrite

Postgres will rename an enum value in place but will not drop one. Splitting
`MOBILE_MONEY` into `OMO` and `MOMO` therefore meant recreating the type — and
deciding what the old rows become, when the old model never recorded which
operator it was. They become `HIST`, "channel not recorded", because that is a
true statement and a guess is not.

The migration then tried to write the old value into each row's `note`, and the
append-only trigger refused it. **The trigger was right and the migration was
wrong.** A schema migration is not an exemption from immutability, and disabling
a trigger to annotate a row swaps a guarantee held by the database for one held
by whoever remembers to switch it back on. The nuance was recorded in the
migration and the register instead, where writing nothing costs nothing.

### The design document is the decision, and the format you read it in matters

_Who creates a payment_ looked like a judgement call. It was not: the design's
state table gives `INITIE` a "Qui le declenche" of **"Le client, sur la
plateforme"**, and its architecture section reads "Le client declenche". Two
independent statements, both explicit.

They are only in the `.docx`. The `.md` export in the same Drive folder flattens
the table and **drops the "Qui le declenche" column entirely** - so the file that
is easiest to grep is the one with the answer removed. Four chantiers were built
against the `.md`.

When a design exists in several formats, read the richest one before deciding
something it may already have decided.

### Configuration that provisions a value can undo the design that reads it

`G3` chose a runtime SSM reader so a wrong bank account number is corrected with
one command instead of a deploy. Putting those twelve values into terraform is
the obvious way to stop them existing only by hand - and done naively it destroys
exactly the property they were designed for:

- as ECS `secrets`, a correction needs a task restart;
- as terraform-rendered `environment_variables`, it needs an apply;
- as `aws_ssm_parameter` **without** `lifecycle { ignore_changes = [value] }`,
  the next apply silently reverts the correction.

The shape that keeps the choice: terraform declares the parameters and never
touches their values again, the task definition carries **only the prefix**, and
the app reads through the SDK. Proved rather than asserted - a `put-parameter` at
23:56 changed the bank name in an email sent at 23:57 by the same process that had
sent the old one at 23:55, with no restart and no deploy.

**When provisioning something, check what property the thing being provisioned was
chosen for.**

### `terraform plan` cannot warn you about a resource it is adopting

The plan showed twelve clean creations. The twelve parameters already existed -
created by hand - and were `SecureString`; the new declaration said `String`.
Terraform had nothing to compare against, because from its point of view those
resources did not exist, so the plan was silent and applying would have converted
twelve bank details to plaintext.

**A plan is a diff against state, not against reality.** When terraform adopts
resources that already exist, compare the declaration with the live resource
yourself - type, tier, encryption - because that is exactly the comparison the
plan cannot make.

### A guard that is quiet when it knows nothing has it backwards

`PaymentChannelsService` threw when a parameter was empty and **warned and
returned** when the prefix was absent entirely. One wrong value was fatal; knowing
nothing at all was a log line. It stayed that way for three deploys, on an
environment where the prefix was never set.

`StorageService` already had the rule: _disabling must be a choice, never an
inference from absent configuration._ An explicit `..._TRANSPORT=disabled` is a
sentence somebody wrote; an unset variable is a sentence nobody wrote.

**When a service has a degraded mode, make the unconfigured case the loud one.**

### An API is not delivered until something renders it

`A10` shipped a pending-documents queue the API could answer and no screen ever
called. G4 was told to build the screen in the same chantier for that reason, and
the screen is what found the defects: **five faults that `nx typecheck` and 445
passing unit tests could not see**, each visible on the first real request.

Two of them were the API's own — a presigned-URL route returning
`{uploadUrl: {uploadUrl, fileUrl}}`, and a controller shadowed by a sibling's
`:id` route. Neither is reachable from a unit test: the first typechecks because
the object has the right shape one level down, and the second is a property of
the **routing table**, not of the class a controller test instantiates.

An endpoint with a green test and no caller is a claim that it works.

### Verify the premise, not the report of the premise

A chantier began "PR #89 has been re-landed on develop - VERIFY that, do not take
it on report." It had not been. What _had_ been merged was the document
describing the problem. **The record landed and the work did not**, and every
downstream step would have been built on a fact that was one command away from
being checked:

```
git merge-base --is-ancestor <the merge commit> origin/develop
```

Two chantiers in a row started on a false premise about what was deployed, and
both times the check took under a minute. A premise stated in a brief is a claim
like any other; the brief itself said so.

### A sweep that counts a token counts it in prose too

`route-guards.spec.ts` counted `@Public()` by splitting on the token. A new route
carried a description explaining that the route was deliberately **not** public -
and that sentence, inside a string, was counted as a fourth public route. The
sweep reported the words "this is not public" as a public route.

Comments can be stripped. Strings cannot, because a decorator and a mention of
one are the same characters. What separates them is **position**: a decorator
opens its own line. `/^[ \t]*@Public\(\)/gm` counts positions and cannot match a
mention.

The same shape has now appeared three times - `payment-money.tsx`'s doc comment
naming the APIs it bans, `lands-client.controller.ts` explaining that it does not
send instructions, and this. **When a sweep bans a token, the code that explains
the ban is the first thing it will flag.** Match the shape, not the substring, and
prove the sweep still fires afterwards.

### A stacked PR must be re-based when its base merges, or it merges into nothing

`#89` was stacked on `#88` because develop did not carry `#88`'s work yet. That
was right when it was opened. `#88` then merged to develop, and **eighty-nine
seconds later** `#89` merged into `feat/g9-payment-entry-point` - a branch that
had already been consumed. GitHub reported it merged, the PR went green, and
fifty-one files went nowhere.

Nothing warns about this. The PR says "Merged"; the branch it merged into is just
a branch. The next chantier began on the premise that the work was deployed, and
the first thing it did was read a version endpoint that agreed - because the sha
it served _was_ develop's head.

**When a stacked PR's base merges, retarget the child to develop before merging
it.** And when a chantier's premise is "X is deployed", check that the code is on
develop, not only that the served sha matches develop:

```
git merge-base --is-ancestor <the merge commit> origin/develop
```

A served sha matching develop proves the deploy worked. It proves nothing about
what develop contains.

### A stale generated client makes your own tree look like a broken branch

Develop's suite showed five failing suites on checkout. The cause was in my
working directory: the local database carried a migration from another branch, so
the generated Prisma client had that branch's enum while develop's source had the
old one. `prisma generate` against develop's schema: 472 passing.

Generated code is not in git and does not change when you change branches.
**Before reporting a branch as red, regenerate what is generated.** "Develop is
broken" is a claim that costs somebody an afternoon, and it is the kind that gets
believed because it is delivered with conviction.

### A service method with no caller is not a feature

`createPayment` and `sendInstructions` are written, tested, deployed to dev, and
**called by nothing**. There is no route, no job, no button. Every payment that
exists on dev was written by the `G1` migration backfill.

`G1`'s own document says _"the service methods exist; there are no routes"_ - about
`G4`, which has them now. Nobody wrote the same sentence about creation, so it
was never anybody's chantier, and `G8` - _one payment carried end to end on dev_ -
is scheduled behind dependencies that do not include the thing it starts with.

The `A10` rule was _an API is not delivered until something renders it._ This is
the step before: **a method is not delivered until something calls it.** When a
chantier ends, ask what invokes the code, and if the answer is "a test", say so
in the register.

### A role that projects a record is not a setting

`KCA_CERTIFIED` says "holds a valid KCA certificate". Four writers disagreed with
that sentence. An admin status change granted it with no certificate. The admin
role doors could grant or drop it by hand. Expiry never removed it. And the one
function that asked the certificate - `isUserCertified` - had no caller and
ignored revocation. KAMNET meanwhile asked a different question, whether the
number the applicant _typed_ was valid, so a stranger's number passed.

A role that reflects a record is written only by the service that owns the
record (`record-derived-roles.ts` closes the admin doors), withdrawn by every
event that ends the record - revocation **and** expiry - and never consulted to
answer the question the record answers. "Is this person certified" is asked of
the certificate (`findActiveCertificate`), not of the role. (`I15`)

### Configuration written by hand is configuration that exists on one environment

`G3` reads twelve SSM parameters at runtime, and the reasoning was good: a wrong
bank account must be correctable in one command rather than a deploy. The twelve
parameters were then created with `aws ssm put-parameter` while building it, and
never added to terraform - and `PAYMENT_CHANNELS_SSM_PREFIX`, the variable that
makes the API read them, was never added to the task definition either.

So the parameters exist, the reader exists, and on dev the reader has never once
been called. Nothing failed: the service takes its unconfigured branch, warns at
startup, and throws if anything asks for a channel detail. Correct behaviour,
and it hid the gap for three deploys.

**A `put-parameter` typed into a terminal is a change to one environment that
prd will not have.** If a chantier needs configuration, the configuration is part
of the chantier - in terraform, in the task definition, in the same PR or a named
follow-up.

### Check the cause you were told to check, then keep going

The brief said: if the channel service will not start, look for
`AccessDeniedException` on `ssm:GetParameter` **first**. That was the right first
guess and it was wrong - there was no denial, because the SDK was never called.

Stopping at "not an IAM problem" would have left two further findings unmade: the
missing task-definition variable, and the fact that nothing creates a payment at
all. And a third that mattered in the other direction - SES has production access,
so the sandbox was never going to block the send either.

**Three gaps, reported together.** The habit this repository keeps relearning is
that the first finding is where an investigation starts.

### A type that lies is worse than no type

The web's API client already strips the `{ success, data }` envelope. The G4
server actions were nonetheless typed `serverApi.get<{ data: PaymentDetail }>`,
so TypeScript believed in a `.data` the runtime had removed. `nx typecheck web`
passed. The page threw
`Cannot read properties of undefined (reading 'reference')` the moment it was
opened.

The same shape twice in one chantier: a service assigning
`StorageService`'s whole `{ uploadUrl, fileUrl }` to a field named `uploadUrl`.
Typechecked. Made the browser `PUT` a file at `/admin/payments/[object Object]`.

**A wrong annotation does not merely fail to catch the defect — it recruits the
compiler into agreeing with it.** When a declared shape and a runtime shape
disagree, the runtime is right; check the response, do not assert it.

### A route is answered by whoever registered first

Nest registers routes in the order the module lists its controllers, and Express
answers with the first pattern that matches. `LandsAdminController` at
`lands/admin` carries `@Get(':id')`, so while it was listed first it answered
`GET /lands/admin/payments` with **"Parcelle de terrain introuvable"** — a 404
about a land, for a request about the payment queue.

**A controller whose path extends another's must be registered before it**, most
specific first. `controller-route-shadowing.spec.ts` holds this, and the general
form of the rule immediately found a second, latent case: `lands/client` sitting
below `lands`, safe today only because no agent route happens to have the right
shape.

### A shared library is compiled by every app that imports it

`libs/common/package.json` declared `"type": "commonjs"`. Turbopack takes that as
the module format for every file beneath it, so the first web import of shared
source failed the build with _"Specified module format (CommonJs) is not matching
the module format of the source code"_ — while the API, which compiles the same
files through tsc, noticed nothing.

The field governed nothing real: there is not one `.js` file under
`libs/common/src`, and an absent `type` already means CommonJS to Node. It was a
declaration about files that do not exist, and it broke a screen in another app
with an error naming neither. Removing it was proven safe by **running** both
source-run scripts under `tsx`, not by reasoning about them.

Money is `BigInt` here, so `apps/web` also has to target ES2020 — the alternative
was writing `BigInt(0)` into shared money code to please a browser target the API
does not have.

### A barrier that fires correctly still has to be reported correctly

The payment state machine refused `INSTRUCTIONS_ENVOYEES -> VALIDE` exactly as
designed. The screen answered with a full-page stack trace, because
`createAction` converts a `ServerActionError` and **rethrows everything else** —
and an `ApiError` is everything else.

A refusal is a correct answer to a question the operator asked, and they should
read it under the button they pressed. Only a genuine bug should reach the error
overlay. Distinguish the two at the boundary, or a working guard is indistinguishable
from a crash.

### A test that bans the mechanism has not banned the outcome

The rule was _money is rendered by one function_. The test banned the alternative
formatters — `formatXAF`, `Intl.NumberFormat`, `toLocaleString`. It passed while a
literal `XAF` typed beside a rendered amount produced exactly the defect it
existed for: **"750 000 FCFA XAF"**, the currency twice, no formatter involved.

Found by mutating the screen and watching every test still pass. Ban the outcome,
then the mechanisms — and force the assertion red before believing it.

### An immutable ledger makes a reset a design decision

G1 made `Payment.reservationId` a foreign key and gave `PaymentReceipt` and
`PaymentTransition` `BEFORE DELETE` triggers. A reservation carrying money is
therefore undeletable **by anybody, including `prisma/seed.ts`**, which had been
deleting reservations on seeded parcels since long before payments existed. The
seed died on a bare `ForeignKeyConstraintViolation` after three modules had
already been written.

That is the triggers working. **Money that arrived is not test data, and a reset
that could erase a receipt could erase evidence.** So the seed skips those rows,
names them and their payment references, and completes. The general rule: adding
immutability to a table changes what every existing cleanup path can do, and the
cleanup paths do not announce themselves.

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

### The runner's architecture is a build input, and nothing in the file says so

Found 2026-09-07, moving CI onto a self-hosted Apple Silicon runner.

`docker/build-push-action` with no `platforms:` builds for **whatever the runner
is**. On `ubuntu-latest` that is amd64, which is what Fargate needs — so three
workflows were correct for two years by accident, and the thing making them
correct was written down nowhere.

Point the same file at an ARM64 Mac and every image becomes arm64. Nothing in
the build fails. Nothing in the push fails. ECS accepts the task definition. The
task then stops with an exec-format error minutes later, in a place that reads
like a defect in the application rather than in the pipeline.

**The rule: pin `platforms: linux/amd64` explicitly, then assert the pushed
manifest against the registry.** Both halves. The flag says what was asked for;
only the registry says what arrived, and they are different claims.

Reading the architecture back is its own trap: a single-platform push returns a
v2 image manifest with **no `.manifests` array and no top-level
`.architecture`** — the platform lives in the config blob the manifest points
at. `docker manifest inspect | jq .architecture` therefore yields null for every
correctly built image, and an assertion built on it refuses everything. That
fails closed, which is the right direction, but a gate that refuses everything
proves nothing about what it lets through. `--verbose` returns the resolved
descriptor. Prove such a gate discriminates before trusting it: feed it a known
arm64 image and watch it refuse.

The general shape, which is [the same as the merge-tree grep](#a-fallback-pipeline-is-a-second-implementation-and-it-rots-quietly):
**a property that held because of the environment, not because anything asserted
it, is a property you do not have.** It survives exactly until the environment
changes.

---

### CI is billed per job, rounded up — so four fast jobs cost more than one slow one

Measured 2026-09-07, moving back to hosted runners under a spending cap.

The `quality` matrix ran lint, typecheck, typecheck:web and test in parallel:
47s, 58s, 58s, 118s. Wall clock 118 seconds, which reads like an efficient
pipeline. **Billed: 1+1+1+2 = five minutes**, because GitHub rounds each job up
to the minute and charges per job.

Of those 4m22s of machine time, **102 seconds was the actual checking**. The
rest was four checkouts, four `setup-node`s and four `pnpm install`s — the same
40 seconds of setup, paid four times, to save 24 seconds of waiting.

**The rule: parallelism is bought, not free, and the price is one rounded-up
minute of setup per job.** Split jobs when someone is genuinely waiting on the
wall clock; merge them when they are only waiting on the bill.

Both directions of that trade are in this repository, and the numbers decide
each one:

- the quality matrix **merged**: two billed minutes saved for 24 seconds of
  extra waiting
- the two image builds **kept parallel**: one billed minute would be saved for
  two and a half minutes added to every deploy

The same rounding makes `timeout-minutes` a cost control rather than a
formality. The default is **360 minutes**; one job hung on a network read burns
18% of a monthly quota before anyone opens the tab.

And measure the levers rather than assuming them. `nx affected` sounds like it
halves the bill; here it skips everything on a docs or workflow PR and skips
**nothing** on a normal one, because `libs/common` is a dependency of both apps
so any change to it affects every project. A saving that only applies to the
cheap case is still worth having — but it is not the saving it looks like, and
[an optimisation reported by intention rather than measurement is worth
nothing](#the-runners-architecture-is-a-build-input-and-nothing-in-the-file-says-so).

---

### One `@Processor` per queue, or one of them eats the other's work

Found 2026-09-09, in `G6`, **by running it and counting the messages that
arrived**.

`DunningProcessor` was declared `@Processor(QUEUES.NOTIFICATIONS)` beside the
`EmailProcessor` that already owned that queue. BullMQ hands a job to one
worker; whichever won a given job kept it. The dunning processor returned
`undefined` for job names it did not recognise — so when it won a
`notifications.send-email`, it **consumed the reminder and threw it away**.

What that looked like from outside:

```
one email sent instead of two
bull:notifications:wait    -> 0
bull:notifications:failed  -> 0
```

No error, no retry, no log line. **A chantier whose entire subject is "nothing
may fail silently" had introduced exactly that**, and every unit test passed
because each mocks its own queue.

**The rule: one `@Processor` per queue name. A scheduled job that needs a worker
gets its own queue, not a second handler on somebody else's.**
`one-processor-per-queue.spec.ts` enforces it and names both files when it
fires. And a processor that receives a job it does not own must **throw**, never
return quietly — the early return is what made the loss invisible.

Two things this cost that are worth keeping:

- It was invisible to the unit suite and visible on the first real run. Proof by
  execution again — [the same lesson as the `?token=[object Promise]` link](#a-message-is-read-by-a-person-so-read-it-as-a-person-before-shipping-it).
- The same run, read as a message rather than as a payload, found the reminder
  still saying _"Les instructions complètes sont rappelées ci-dessous"_ with
  nothing below it — copy left over from the v02 template that did carry the
  channel block. **v03 removed the coordinates and left the promise.** Read the
  message that arrives, not the template that produced it.

---

### Every layer tested, and the seam between two of them not

From `A17`. G11 added `paidBy` to the DTO, the service, the CHECK constraint
and the form, each with its test, and the controller's hand-built call to
`recordReceipt` never forwarded it. A `DEPO` keyed on the screen with its payer
filled in would have been refused by the service for having none. Four green
suites, one field lost between two of them.

**A field that crosses a boundary by being copied is a field a test has to
watch cross.** `payment-back-office.spec.ts` now pins every field of that call.
The general shape: when a layer rebuilds an object by hand rather than passing
it through, the rebuild is the place a field goes missing, and it is the place
nobody tests because each side already has its own.

### A test that reads a superseded file is a test of the archive

From `A17`. _the database CHECK is the backstop, and still confines the
exception_ read G1's migration and asserted `'INCONNU_HISTORIQUE'`. G11 had
dropped that constraint and re-created it against `HIST` two days earlier. The
test stayed green about a definition no database carried, because G1's file
still says what it said.

A migration file is history; the live definition is whatever the last migration
to touch it says. **Pin the behaviour against a database where you can, and
where you must read a file, read the one that defines the thing now.**

### A fortuitous observation is not a property

From `A17`. The append-only trigger had refused G11's migration UPDATE, the
migration's comment recorded it, and the register cited it as the trigger
working. It was. It was also the only time anything had exercised it, by
accident, in a direction nobody planned. The day a later migration dropped the
trigger, nothing would have refused anything and nothing would have gone red.

**An observation tells you the guard worked once. A test tells you it will fail
on purpose when it stops working.** The two are not the same evidence, and the
first has a way of being cited as if it were the second.

### A form that validates a control nobody can see refuses and explains nothing

From `L1`. The public contact form put `required` on a Radix `<Select>`, which
renders a **native `<select required>` at 1x1 pixels**, `aria-hidden`,
`tabIndex={-1}`, behind the visible trigger. Native constraint validation runs
_before_ the submit event, so with no subject chosen the browser blocked the
submission, could neither focus nor annotate the control it objected to, and the
submit handler never ran. **The button did nothing, silently.**

The audit that found this reported the form as showing a false success toast,
which was the _other_ path - the one taken once a subject had been picked. The
worse behaviour was the one nobody could describe, because it produced no
output at all.

**A validity rule belongs where the message can be rendered.** `required` came
off, the rule went into the resolver, the message renders under the field tied
by `aria-describedby`, and focus moves to the trigger. The general form: if a
guard's failure has no visible surface, it is not a guard, it is a silence.

### `<label for>` does not name a button

Also from `L1`, and worth separating because the obvious fix is wrong. The
subject label was a `<label>` with no `for`, and the control was a
`<button role="combobox">`. Adding `for` would have changed nothing:
`<label for>` names form controls, not buttons, so the computed accessible name
stays empty and the control keeps announcing itself as an unnamed combo box.

`aria-labelledby` pointing at the label's id is what names it.

```
before: computeAccessibleName(trigger) === ""        (length 0)
after : computeAccessibleName(trigger) === "Sujet *"
```

**Measure the accessible name, do not infer it from the markup.** The DOM had a
label next to the control the whole time.

**A placeholder is not a name either.** From `P2`: the newsletter's address field
had a placeholder and no label, and `computeAccessibleName` returned `""`. It
looked labelled to anybody who can see, which is why it survived.

### A mutation that cannot fail because the test mocks the thing being mutated

From `L1`, and it is the sharpest thing that chantier found. The server action
was mutated to always return success - the exact defect being fixed, one layer
down - and **all twelve component tests stayed green**, because they mock the
action. The form was proved to behave correctly _given an honest action_, and
nothing anywhere proved the action was honest.

The tests were not wrong to mock it; a component test that opens a socket is a
worse test. What was wrong is that the mocked collaborator had **no tests of its
own**, so the boundary between them was covered from neither side.

**When a mutation comes back green, suspect the test before believing the
code.** And when a test mocks a module, ask what proves that module - the answer
is a file, and if it does not exist the mock is a hole rather than a boundary.

### A negative matcher is a list of what somebody remembered to exclude

From `P3`. The auth middleware matched
`/((?!api|health|_next/static|...).*)` - everything except a hand-written list.
So it ran on every URL the site does not serve, decided each was not public, and
redirected it to `/login?callbackUrl=...`. `/pricing`, `/tarifs`, `/robots.txt`
and every typo answered `307`, and **the only path on the whole site that could
return a 404 was under `/api/*`**, because that happened to be excluded.

A negative matcher answers "what is not excluded". That set is unbounded, grows
silently with every public page anybody adds, and cannot be checked by reading
it. A positive one - the prefixes that are actually protected - is a list a
person can audit, and it makes the dangerous direction the visible one.

**Narrowing a gate is where this goes wrong**, so the list is not trusted: a
test walks the route files, computes every URL, and fails if anything
`isPublic()` refuses is no longer matched. The failure names the route.

### A page that says "not found" over a 200 is worse than the redirect

Also `P3`. The obvious way to check a 404 is to look at the page, and it is the
one check that cannot see the defect: a soft 404 renders the right words, and a
crawler indexes it, a monitor reports the site healthy, and broken URLs stop
being countable.

**Assert the status code.** `page.goto` follows redirects, so an HTTP-level
assertion needs the raw request client - otherwise a 307 to a 200 login page
reads as success.

### `NODE_ENV` cannot tell dev from prd in this repository

From `P4`, and it is the trap that chantier existed to walk into.
`docker/Dockerfile.web` sets `ENV NODE_ENV=production` on the runtime image
**unconditionally, for every environment**, because that is what a Next.js
production build runs as. dev.kambriq.com reports `NODE_ENV === 'production'`
exactly as prd would.

A `NODE_ENV !== 'production'` check therefore puts nothing on anything that is
actually deployed, while every local test agrees it works. `APP_ENV` exists for
this one decision and is read by nothing else. Deriving it from the hostname or
from `NEXT_PUBLIC_APP_URL` would be the same mistake wearing a different value.

**And the default is a decision with a direction.** Absent means noindex,
because the two failures are not symmetrical: a prd that forgot to declare
itself is visible in Search Console within a day and fixed by one variable, and
a dev that forgot is indexed under the brand name, invisible until somebody
searches, and weeks to unpick.

### A header set by an interceptor misses every response that matters most

From P4's second half. Dev was noindex on every page and indexable on its
API: nothing on the API set `X-Robots-Tag`. The obvious place to add it is an
interceptor, and that would have missed exactly the two responses a crawler
meets most on an API: **an interceptor runs only for a matched handler**, so a
404 for an unknown route and a 401 from a guard go out without it.

**A header that must be on every response is Express middleware, registered
before routing.** `robotsHeaderMiddleware()` sits right after helmet in
`main.ts`, and `api-sends-robots-header.spec.ts` sees it on a 200, a 404 and a
401 over real HTTP.

**And one hostname answers one way.** The rule moved to `libs/common`, and the
web re-exports the same function, pinned by identity, not by agreement. Its
import is relative, because the loader that compiles `next.config.ts` cannot
resolve the `@kambriq/common` alias. Anything `next.config.ts` imports must not
use it.

### A server that calls on a visitor's behalf is one visitor to everything downstream

From `A45`. A2 fixed the rate limiter to key on the last `X-Forwarded-For` hop,
and that was right for a browser calling the API. But nearly every call here is
made by the Next server, through the same public ALB, so the last hop is the web
task's own address. Every visitor's login, registration, contact request and
newsletter subscription spent **one bucket for the whole site**, while a caller
hitting the API directly kept a bucket of its own. Nothing failed, and the limits
only looked like they worked because traffic was low.

The web could not be recognised by its connection, which is always the ALB, or
by its address, which was new at every deploy (four in one day). So it
**vouches** for the visitor, with a secret only it and the API hold, and the API
believes the claim with that secret and never otherwise. A forwarded address
believed from anybody is worse than none, because a caller could then choose
its own bucket.

**Before proposing any limit, find out who the caller is**, by reading the
request log for a marked request rather than reasoning about the topology. And
a header that carries a secret must be redacted from the request log in the
same change that adds it.

### A guard written before anything can use it

`callbackUrl` is written in four places in this app and **read in none**:
`logInAction` passes a hard-coded `redirectTo: '/'`. There is no open redirect
today, and the parameter is decorative.

It is one line from not being. The natural way to make it work is
`redirectTo: searchParams.callbackUrl`, and written that way it sends somebody
to another origin immediately after they type a password. So the constraint
exists now, at every write site, exported so whoever wires the read finds it
sitting next to what they are about to use.

**A guard is cheapest to write while nothing depends on the hole it closes.**

### A check that never runs looks exactly like a check that passes

From `A19`, and it had been true for seven months.

`ci.yml` says, in as many words, that a push to develop runs _"the full set, no
base to diff against"_. The command it called was `pnpm run lint`, and that
script was `nx lint api` - **one project of six**. So develop linted the API and
nothing else, and `libs/common` carried two real dependency errors the whole
time: `ioredis` and `@jest/globals` imported and undeclared.

Nothing was failing. Nothing was running. The two are indistinguishable from
outside, and the green tick is the same shape either way - which is why this
survived every glance at the pipeline.

It surfaced only because `#98` was the first pull request in months to touch
`libs/common`, and a **pull request** lints what it affects rather than what the
root script names. The defect was found by a branch that had nothing to do with
it, which is the usual way.

**The rule: when a check is widened, reintroduce the defect and watch the new
command fail where the old one passed.** Both directions, because "it is green
now" is compatible with "it still checks nothing". Proved here:
`nx lint api` succeeds against the reintroduced defect and
`nx run-many -t lint --all` fails naming both errors.

And the corollary, which is the cheaper habit: **a comment that describes what a
command covers is a claim, and it rots silently.** This one was wrong for seven
months and read as documentation the entire time. If a comment says "the full
set", something has to make that true.

### A postcondition that counts a word has not checked the thing

From `A31`, which turned develop red on 14 September and let four merges in on
top of it.

The seed keeps reservations that carry payments, because the ledger is
append-only and money is not test data - correct. It printed _"Those parcels
keep their current status"_ - and the next loop reset every seeded parcel to its
seeded status regardless. Eight parcels on dev were listed AVAILABLE under a
PENDING reservation. The listing said free; the reservation service, which
refuses any parcel with a reservation that is not CANCELLED, said taken; every
journey that took the first available parcel got a 409.

Its postcondition passed. It counted rows whose `status` was AVAILABLE, found
the eighteen it expected, and said so - over eight parcels nobody could
reserve. **A count says how many rows carry a word, not whether the word is
true.** The check now asks the question a caller relies on: no seeded parcel is
AVAILABLE while a reservation holds it. Proved by the mutation that matters -
develop's seed with only the new check added: the count passes exactly as it did
on dev, and the new check alone refuses, naming the parcels.

Two lessons beside the main one:

- **a log line is a claim about the code below it**, and this one was false from
  the day it was written. Nothing read it against the loop that followed.
- **the brief's hypothesis was wrong in its detail** - "the seed creates rows the
  journeys create". The seed created nothing; it overwrote one column under rows
  it had decided to keep. Read the output and the rows, not the hypothesis.

### A public verdict says yes only on an explicit, complete yes

From the verify-certificate chantier (D wave 1). `/verify-certificate/[n]`
rendered a hard-coded certificate - a name, a score, **"Certificat valide"** -
for any `n` at all, anonymously, since the page was written. The comment above
the constant said _"In production, fetch from API"_. A comment refuses nothing.

The endpoint it should have called had two defects of its own:

- **`revokedAt` was stored and never read.** `revokeCertificate` stamped it,
  `verifyCertificate` ignored it, so a withdrawn certificate answered
  `valid: true` until it expired. Same family as a setting stored and read by
  nothing, arriving through a column.
- **It returned the holder's user UUID to strangers.** KCA numbers are a date
  and four hex characters, so they enumerate. The answer is now about the
  certificate and names nobody; whether a name should ever appear is a product
  and legal decision, not a default.

**The rule, which is directional:** a page that tells the public something is
authentic gives a positive verdict only when the source says so explicitly,
about the thing asked, with every field agreeing. Unknown shape, missing
field, a different number echoed back, an API that could not be reached - all
of it lands on a negative or on "cannot verify right now", never on yes. And
"cannot verify" is its own answer: calling a real certificate a fake because
the API was down is a false statement too.

Proved by mutation at three layers, including a render test that mocks only the
HTTP client (`page-through-the-bff.spec.tsx`): the page spec that mocks the
action could not have seen the action lying.

### A gate that only sees the pull request cannot see develop

From `A32`. On 14 September develop was red on the delivery journeys from
08:22 UTC, and six pull requests merged on top of it before anybody repaired
it. Every one of their gates was green, correctly: the journeys need a deployed
build, so they run on develop after the merge, and nothing a pull request runs
could see them.

The CI Gate now reads develop's state **at its head**: the sha of `develop`,
then the CI run for that sha, then its journeys. Green passes; anything else
refuses. Four decisions are worth keeping:

- **Ask by name, not from a list.** The first version took the newest completed
  develop run from a list, and on 15 September the list answered #134 with a
  run six merges old: the gate passed on a verdict about another build. Asked
  by sha, the only wrong answer left is "no run", and that refuses. The price is
  stated where it is paid: every push to develop blocks merges for the ~20
  minutes its run takes, and the step prints so.

- **The override is a label, `merge-on-red-develop`, then a re-run of the
  job.** Without one, the pull request that repairs develop could never merge
  and the first red would close the repository. Labels are read live through
  the API, because a re-run replays the original event and its stale labels.
- **It fails closed.** A call that cannot be made, a head with no run, or a run
  not finished is "unknown", and unknown refuses. A probe that fails to run looks exactly
  like one that was refused; an empty answer is never "fine".
- **It stops the stacking, not the breaking.** The first merge that breaks the
  journeys is still only seen after deploy. What this prevents is the second
  merge on a known red.

### A test that fails every other run is not coverage, and saying so is

From `A33`. The WebKit successful-login test (A28) failed on 4 of the 8 develop
runs that ran E2E since it was added, and a fifth passed only on its retry. Every
failure looked the same: the click was accepted and **no request left the
page** for 15 seconds. That rules out a slow server and a wait that is too
short - nothing was in flight to wait for. Twenty local WebKit runs all passed,
so the cause (a click landing before hydration on a slower runner, or a WebKit
event difference) was not established in the hour bounded for it.

Raising the timeout would have hidden exactly that. WebKit is out of the matrix
instead, with the reason at the line where it was and in the register:
**Safari is not tested.** That sentence is honest; a test that lies every other
run and is retried into green is a claim of coverage that is not there. Safari
is the default browser on the iPhone the diaspora uses, so WebKit comes back
with its cause, not without it.

### A notification is proven by the message that arrived, not the step that sent it

From `D19`. The dev deploy failed on 12 September at 10:28 and again at 19:20,
at `Run Prisma migrations`, and nobody knew for nine hours: dev served the
previous image all day while proofs were taken against it. Nobody was careless.
There was no mechanism, so there was nothing to be vigilant about.

`deploy-dev.yml` now ends with a step on `failure() || cancelled()` that sends
one message FROM `noreply@` TO `contact@` through SES, naming the run, the
failed step (read from `steps`, which is why every step carries an `id`), the
commit, the images and the environment. `cancelled()` is not decoration: a job
that reaches `timeout-minutes` is cancelled, not failed.

**Its acceptance is a message in the mailbox, never the step's exit code.** D14
built an SNS topic with no subscription and it published successfully to nobody.
SES accepting a send is the same claim one hop later. The step logs the SES
`MessageId`, and the delivered message carries it in its `Message-ID` header -
that is how a mail in `contact@` is attributed to a run rather than assumed.

What it cannot see, written down so nobody learns it by waiting: a job that
never starts (quota, runner, environment rule), a failure in the credentials
step itself, and the delivery journeys, which are another job.

### A prose guarantee is a claim, and the system is not obliged to keep it

From `A36`. The journey client threw on a 429 and explained itself in a comment:
_"In CI the suite runs once per deploy and never sees it."_ Run `35306506751`
saw it twice, in one job, four minutes apart.

The sentence was not careless when it was written - it was true of one suite. It
stopped being true when `#146` added a second one, and **nothing anywhere had to
change for it to become false.** That is the same family as
[a comment that describes what a command covers](#a-check-that-never-runs-looks-exactly-like-a-check-that-passes)
and as a guard that names a danger without refusing it: a guarantee written in
prose has no mechanism behind it, so it rots without a single line being edited.

**What was actually true**, and is now in the file with its measurements: the
`journeys` target runs `runInBand`, so both suites execute in **one process from
one runner address**, and `ThrottlerBehindProxyGuard.getTracker` keys on the last
`X-Forwarded-For` entry - so the two suites **legitimately** share one bucket of
100 requests per 60 000 ms. The gap between them is the whole variable: 9.33 s
passed on `1cbde1a`; 0.36 s failed on `70a5e07`; that job re-run alone, at
0.35 s, failed identically. The guard was doing its job and the product was
fine.

**Waiting is what a client owes a rate limiter.** So `call()` waits one full
window and retries, bounded, printing one line per wait. Two fixes were refused
on the way: a fixed pause between suites works today and breaks when the fourth
suite arrives, and raising `THROTTLE_LIMIT` on dev removes a real protection to
make a test pass. The wait is the **whole** window because the throttler's record
expires one TTL after the request that opened it and a client holding a 429
cannot know when that was - anything shorter is a guess. And the message it
throws after the last attempt is pinned **verbatim**, so a genuine throttle
problem is never absorbed by the waiting.

### A test has to live somewhere that runs, and a project can have nowhere

Also `A36`, and it nearly shipped as coverage that never executed.

The natural home for a unit test of `support.ts` is `apps/api-e2e`. That project
had **one target, `journeys`** - no `test` - and the root script ran
`--projects=api,common,web`. A spec dropped in next to the helper it tests would
therefore have run in exactly one place: `Delivery journeys (dev)`, against a
deployed environment, **after** the merge, and never on a pull request. The only
job it would execute in is the job it was written to repair.

So the project gained a `test` target and a second Jest config with no
`globalSetup`, `src/unit/` is ignored by the journeys config, and both root
scripts name `api-e2e`. Both halves matter: the target puts it in `Quality` on
pull requests, and the script puts it in the develop run - narrow one and it
becomes [a check that never runs](#a-check-that-never-runs-looks-exactly-like-a-check-that-passes)
again.

**Before writing a test, name the job that will run it.** "It is in the repo" is
not an answer, and a green pipeline looks identical either way.

### The code that decides who owns the bucket had no test

`getTracker` was one occurrence in the whole of `apps/api`: its own definition.
It answers "whose quota is this request spending", and it is wrong in two
directions. Key on the ALB's address and every client shares one bucket, so one
user exhausts the login limit for everybody - the `A2` defect it was written to
fix. Key on an entry the **client** controls and any client picks its own bucket,
which is the same as having no limit at all.

Eleven tests now pin it, and they were **watched failing**: mutated to
`parts[0]`, five fail, including `Received: "a-value-the-client-chose"`. That
mutation is the one that matters, because the plain "takes the last entry" case
also passes a leftmost implementation on a one-element chain - so the spoofing
case is a separate test rather than a second tail on the first.

### A second row of something turns every unfiltered count into a defect

From the KCA1 switch. For as long as `KbsCourse` held one row, every count in
KBS was accidentally correct: `kbsModule.count()` meant "the modules of the
course" because there was no other course to count. Loading KCA1 beside the
demonstration course made six modules exist, and three separate counts became
wrong in the same instant without a line being edited - the exam pool and draw
(`I36`), eligibility, and `overallProgress` on `GET /kbs/me`.

The one that mattered refused people: a candidate who had passed all four KCA1
parcours was told `Formation incomplete : 4/6 modules termines` and could never
sit the exam. **Training worked, certification was unreachable, and nothing
looked broken** - the arithmetic was internally honest, as in the quiz
denominator and the coverage percentage before it.

**And scoping one side of a ratio is worse than scoping neither.** Eligibility
compared `kbsCandidateProgress.count()` against `kbsModule.count()`. Filter only
the denominator and the active course has 4 modules while the numerator still
counts every passed row anywhere - so two KCA1 modules plus two demonstration
ones make 4 of 4, and somebody sits a certification exam having done half the
course. The unfixed bug refuses a candidate; the half fix certifies one. A
ratio's two sides are one change, never two, and they get one test each because
they fail in opposite directions.

**The rule: when a table that was effectively a singleton gains a second row,
grep every `count()` and `findMany()` against the tables hanging off it before
the switch, not after.** `checkAndTransitionToExamPending` already had the right
shape the whole time, which is the other half of the lesson - the correct
version existing elsewhere in the codebase is not what makes the wrong one
correct.

### An active course that is not published navigates, and serves nothing

Also from the switch, and it is one `UPDATE` from being invisible.
`getMyOverview` reads the active course by id and does not care whether it is
published; `findCourseModules` and `findLessonById` both require
`isPublished`. Point `activeCourseId` at a draft course and a candidate gets a
complete-looking dashboard - four parcours, correct lesson counts, the first one
open - where **every lesson answers 404**. The switch is therefore two writes,
and the second is not tidying.

### A constant is changed by its name; it is encoded by its value

From P9, and it cost a red `develop`.

`KAMNET_MAX_SPONSORSHIP_DEPTH` went from 3 to 1. The sweep that followed
searched `N2`, `N3`, `level 3` and `terminates` across `apps` and `libs`,
corrected nine comments and inverted three web tests. It missed
`kamnet-network-isolation.spec.ts`, which encodes the old value **numerically** -
`network(eric, 3)` - and describes its effect **in prose**: "Eric sponsors three
directly, one of whom sponsors Amina: four below him." Neither string contains
the constant's name, `N3`, or the digit in any form the sweep looked for.

The merge went green and `develop` turned red on the push:

```
● does not put Eric's referrals in Sylvie's network
  Array [ "AGT-2025-0002", "AGT-2025-0003", -"AGT-2025-0004", "AGT-2025-0005" ]
```

`AGT-2025-0004` is Amina, at N2 - exactly the level the constant had removed.
The platform was right and the test was stale.

**When you change a constant, sweep for three things, not one:** its NAME, the
LITERALS that encode its value at call sites, and the PROSE that describes its
effect. The first is a grep; the last two need reading. Every argument passed to
a function whose behaviour that constant governs is a place the old value may be
written down as a bare number.

**And the reason this one reached `develop`: the delivery journeys are SKIPPED on
pull requests and run only on the push after a merge.** So a stale journey
assertion cannot be caught by any PR gate, however green. For a change that
alters what an endpoint returns, the journeys are not a safety net before the
merge - they are the first execution after it. Run the affected journey against
dev by hand before merging, the way the repair for this one was proved.

### A barrier guards a table, and the same fact was recorded in two of them

From wave 4. `G1` split recording money from agreeing that it settles a payment
and put every guarantee on `Payment`: an append-only ledger, one write path to
the state, `assertTransitionIsDeliberate`, `assertTransitionIsEvidenced`, a
receipt drawn from that payment's own ledger. All of it real, all of it proved.

**`LandReservation.downPaymentConfirmed` is the same fact in a different table**,
and `confirmDownPayment` set it, with `status: CONFIRMED`, in one bare
`landReservation.update`: no amount, no currency, no receipt, no evidence, no
audit row. One admin button walked past the whole barrier, and `complete()`
requires `CONFIRMED`, so the agent's KAMNET commission was downstream of a
checkbox.

**The past tense is what hid it.** `payments.service.ts` says, in its class
docstring: _"The old `confirmDownPayment` did both in one `update`, which is how
a payment becomes settled because somebody typed an amount."_ `G1` wrote that
about the code it was replacing, and nobody checked that the replacement had
reached the reservation. **A comment refuses nothing, and a comment in the past
tense about live code is worse than one that says nothing: it reads as evidence
the work was done.** Three chantiers were built on top of that sentence.

**The repair is `I15`'s rule at one boundary further out.** There, a role that
projects a record is written only by the service that owns the record. Here, a
reservation step that projects the ledger asks it rather than answering for it:
the step refuses unless the reservation carries a payment in `VALIDE`, which is
the only state meaning the money arrived **and** somebody with the authority to
commit agreed it settled the payment.

**The general rule: when you put a guarantee on a table, grep for the other
places that record the same fact.** A second column in a second table is not a
denormalisation, it is a second door, and it has none of the first one's locks.
The two questions are separate and both have to be asked: _what does this
barrier protect_, and _what else claims to know the same thing_.

And the half that was refused, because a partial fix here would have been worse
than none: **step 4, the balance, has no ledger at all.** Nothing creates a
payment for it, so gating it identically would block the step with nothing able
to unblock it. It is left ungated, the reason is written at the method, and the
gap is a row in the register - rather than a guard that looks complete and
refuses everybody.

### A second record is worse than no record, because one of them is believed

From the wave 3 fold. Between 18 and 23 September the work of PRs #155 to #162
was written into a `WAVE_STATUS.md` at the repository root rather than into
`docs/ops/registre-chantiers.md`. Both files were maintained, by different
people, and they disagreed: the register still read _"Last closed: Friday 4
September"_ and carried no mention of `I38`, `I42`, `I17`, `P9`, `P20`, `P21`,
`A38` or `P11`.

**The file every session is told to load was the stale one.** A reader who
followed the instructions in this brief got the wrong answer, and got it with
the confidence the instruction lends. That is the difference between a missing
record and a second one: a gap makes you go and look, and a stale record answers.

**And nothing reports it, because a stale record is shaped exactly like a
current one.** Rule 4 of this file and rule 1 of the register both say the
register is updated in the same commit as the work. Both were written before
either was enforced by anything, and a rule with no mechanism is
[a prose guarantee](#a-prose-guarantee-is-a-claim-and-the-system-is-not-obliged-to-keep-it).

Three further defects were sitting in that document and none had been noticed,
which is the measure of how much it was actually read:

- **the `## Open` table existed twice**, back to back, each copy carrying rows
  the other lacked, and different people were editing different copies. A
  develop commit updated a `P4` row that existed only in the second;
- **`H1`'s entry had lost its heading**, so a `PROUVE` chantier's body hung off
  the end of that table and `### H1` matched nothing;
- **the states table declared four states while the document used eight.**
  `PROUVE LOCALEMENT` was carried by fourteen entries and defined nowhere, so
  whether it meant "nearly done" or "not deployed" was a guess, and it is the
  state most likely to be read as finished.

**What closes it:** `register-is-the-record.spec.ts`. One Open table, no
chantier listed twice, no state the document has not declared, every open
chantier either carrying an entry or named in an inventory that is pinned in
both directions, and no second file in the repository shaped like a record of
work. Six of its seven assertions were each watched failing alone.

**The general rule: a record is a single file, or it is not a record.** When
work needs a longer working note than an entry, the note is archived where it
cannot be mistaken for the record, says in as many words that it is not the
record, and is frozen. Kept for how something was proved; never read for what is
true now.

### A wildcard in an allowlist trusts whoever can register a name under it

From `A40`. `images.remotePatterns` allowed `**.amazonaws.com`, read as "our S3".
It meant every S3 bucket in the world, and anybody can create one. The optimizer
at `/_next/image` is anonymous and hands what it fetches to `sharp`, so the
wildcard let a stranger choose the bytes our server decodes. That was the one
reachable critical out of 111 critical and high alerts.

Nothing about it looked wrong. The comment beside it even said _"update with the
actual bucket hostname when configured"_: a placeholder that shipped, with a
comment to say so, and a comment refuses nothing.

**A host in an allowlist is literal, and the list has one home.**
`src/lib/security/image-hosts.ts` feeds both `remotePatterns` and the CSP
`img-src`. A host that differs per environment comes from a build variable, and
when the variable is missing the host is refused, never widened.
`image-hosts.spec.ts` fails on a wildcard, on a host written into
`next.config.ts`, and on a build that stops receiving the variable.

Two properties of Next.js make this easy to get wrong:

- a standalone build freezes `images` and `headers()` at `next build`, so the
  variable must reach the Docker build, not the container;
- a pattern with no `search` matches every query string. Presigned URLs need
  that, and it is a statement about what the entry allows, not a detail.

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

### A message is read by a person, so read it as a person before shipping it

From `G3`. The instruction email passed every test and then arrived saying
**"750 000 FCFA XAF"** - the currency twice, one of them hardcoded - and gave the
deadline as `2026-10-06`. Both were found by reading the message that landed in
the mailbox, and neither was visible in the code: `formatXAF` appends "FCFA"
itself, so composing it with the payment's own `currency` reads correctly at the
call site and wrong in the inbox.

**A template is not done when it renders. It is done when somebody has read
what arrived.** The same standard as proof by execution, applied to prose.

Two things follow, and both are now enforced by tests:

- **an amount carries its currency once**, and the currency is the payment's,
  not a helper's assumption;
- **a date a person must act on is written the way they write dates.** `Intl` is
  the tool for both. Note that its French group separator is U+202F, a narrow
  no-break space - an assertion typed with an ordinary space fails while showing
  two strings that look identical, so normalise before comparing and say that you
  did.

**Write for the reader, not the sender.** The payment instruction assumes it
will be read on a phone by somebody in the diaspora, forwarded once, and read
again by a relative who was not in the conversation. So: no links to click, no
login, no reference to an earlier message, and the reference set in monospace on
its own line because it will be copied by hand onto a transfer slip.

### Channel details are configuration, and the reader decides whether a fix needs a deploy

From `G3`. Bank details, mobile money numbers and a notary's contact are business
data that changes without anybody deploying, and a wrong one sends a client's
money to the wrong place.

They are read **through the SSM SDK at runtime**, cached for a minute - not from
the task definition. `B3` established that only 7 of 56 parameters reach the
container as ECS `secrets`; the other 49 are values terraform rendered at apply
time, and for those `put-parameter` changes nothing until the next apply. **A
wrong account number has to be correctable in the time it takes to type one
command**, so the reader is chosen to make that true.

**Nothing is optional and nothing is blank.** Every parameter is required;
`PaymentChannelsService` fails at **startup** when the prefix is set and
incomplete, naming every missing or empty parameter rather than the first, and
refuses to compose a message when it is absent. A blank where an account number
belongs is not a degraded message - it tells somebody to transfer money into
nothing.

**On dev the values are deliberately unmistakable** (`DEV-COMPTE-FICTIF-NE-PAS-
UTILISER`), because an invented IBAN that looks plausible is worse than an
obviously fake one: somebody eventually reads a dev email.

### The payment reference, and why each part of it is what it is

From `G2`. `KBQ-YYMM-XXXXX-C`. This string is dictated over the telephone,
copied onto a transfer slip by hand, read aloud by a notary and retyped by the
back office - **it is the only thing tying money that moved outside the platform
to a payment inside it.** Every decision follows from that.

**The alphabet is derived, not spelled.** 29 characters: `A-Z0-9` minus
`O 0 I L 1 S 5`, the ones that collide when written and when spoken. Defined once
in `payment-reference.ts`. One duplicate could not be removed - G1's SQL `CHECK`
spells the class and cannot import TypeScript - so a test asserts the two are
character-for-character identical.

**The check character is a weighted sum modulo 29, and 29 being prime is the
whole argument.** A single wrong character shifts the sum by `w·d`, never zero
mod a prime larger than both factors; a transposition shifts it by
`(w_i − w_{i+1})(v_i − v_{i+1})`, and consecutive weights differ by one, so it is
zero only when the two characters are identical - when there is no error. Luhn
mod N gets the first property and misses specific adjacent pairs. **A checksum
that catches neither class is decoration.**

Measured, not asserted: **100% of single-character errors, 100% of transpositions
within a segment, 96.6% across the `YYMM`/body hyphen.** The boundary is not
total and the reason is exact - a character is worth its digit value in `YYMM`
and its alphabet index in the body, so a swap changes both values in a way the
weighting cannot cancel reliably. Recorded rather than rounded up.

**Collision-free by construction, not by improbability.** The body encodes a
Postgres sequence through a bijection over the 29^5 space. `nextval` is
serialised across concurrent transactions; a bijection cannot collide. Random
generation would have been _unlikely_ to collide, which is a different property.
G1's unique index remains the **backstop** - it can only fire if the counter
wraps 20 511 149 values inside one month - and creation retries on it rather than
losing the payment.

**Validation rejects; it never corrects.** `O` is not in the alphabet, so a `0`
in the body is unambiguous evidence of a typo. Reading it as `O` would turn a
mistyped reference into a **different valid** reference and attach one person's
money to another's payment - the exact failure the check character exists to
prevent, reintroduced by code trying to be helpful. Case, spaces and hyphens are
presentation and are normalised; confusable characters are not. The restriction
is **positional**: a `0` in `YYMM` is January, not a typo.

### Money, and the three rules that hold it

From `G1`. Enforced, not asked for.

**Money is an integer in the currency's indivisible unit, with the currency
stored beside it.** `BigInt`, never `Float`. **XAF has no minor unit** - one unit
is one franc, not a centime, which is the thing people get wrong. An amount
without its currency is a number, not money.
`no-float-money.spec.ts` fails on any monetary field declared `Float`, `Decimal`,
`Double` or `Real` across all four schemas; five pre-existing columns are
quarantined there with the reason each is not yet converted, and the list is
pinned in both directions so it cannot rot into a lie.

**A computed total is never a stored column.** `Payment` has no `totalReceived`.
The total is a sum over `PaymentReceipt`, and a correction appends a signed line
pointing at the line it corrects - it never edits one. Same reasoning as the
coverage denominator: a figure you can edit by hand is a figure that lies one
day, and the day it lies nothing signals it. Both ledger tables carry a
`BEFORE UPDATE OR DELETE` trigger that raises, so append-only is a property of
the database rather than a promise made by a service - a service can be bypassed
by a script, a console, or the next person in a hurry.

**No transition that commits money is automatic.**
`assertTransitionIsDeliberate` throws when a payment is moved to
`PARTIELLEMENT_RECU`, `VALIDE`, `REJETE` or `ANNULE` without a named person and a
reason. It is a barrier in the service path, not an assertion in a test: **an
assertion in a test is a report about a run that already happened, and it cannot
refuse a write.** This is `KCA_CERTIFIED` granted on an exam score, one boundary
further along - there the business event made somebody an agent, here it would
settle money.

`EXPIRE` is the single sanctioned exception, because the design asks for exactly
one automatic transition. Recording money and agreeing that it settles a payment
are **two calls**; the pre-G1 `confirmDownPayment` did both in one `update`.

### A database guarantee has a database-backed test, or it is a claim

From `A17`. Until 9 September no test in this repository opened a database. The
two append-only triggers and five CHECK constraints on the payment tables were
text in migration files, and a migration dropping all of them would have passed
CI with 575 unit tests green. One of the triggers had fired once, in anger,
refusing G11's own migration UPDATE - which was right, and was an observation,
not a property.

**`pnpm test:db`** runs `*.dbspec.ts` under `apps/api/src/__test__/database/`
against `kambriq_lands_test` on the docker-compose Postgres, migrated by the
real migration files. It refuses any database whose name does not end in
`_test`. The unit suite (`nx test api`) still opens no connection. Rules that
come with it:

- **A guarantee is proved by removal.** Drop the trigger or constraint in a
  scratch migration, watch the test read `Received has value: null` - the
  UPDATE went through - delete the scratch, `pnpm test:db:reset`. A test that
  passes against a database where the guarantee was never installed proves
  nothing about the guarantee. Every one of the nine was done this way, and
  the failing test names are in the register.
- **Assert the constraint by its name**, not only the SQLSTATE. A row refused
  by a different rule would otherwise pass the test for this one.
- **Send the assault as SQL.** The trigger exists to refuse the caller that does
  not use the service; a raw `UPDATE` through `pg` is that caller.
- **`Payment.state` has one door.** `single-state-write-path.spec.ts` finds
  every Prisma write to `payment` and requires exactly one to set `state`:
  `transition()`, in the same `$transaction` as the audit row, after every
  guard. A second `payment.update({ data: { state } })` anywhere fails it by
  file and method name.
- **A transition into `PARTIELLEMENT_RECU` or `VALIDE` names the receipt it
  rests on** (`EVIDENCED_STATES`), which must be on that payment's ledger. Every
  other state carries `NULL` on purpose, and the constant says why for each.
  Demanding a receipt where none is behind the step fills a trail with
  evidence of nothing.

### An exam records which questions it served, not how many

From `I21`. `startExam` drew 20 questions from a pool of 60 and stored only
`totalQuestions: 20`. `saveAnswer` upserted an answer for any `questionId` in
the pool, and `gradeExam` divided every correct saved answer by 20, uncapped.
Answering the whole pool graded 300%; a few answers remembered from an earlier
attempt turned a fail into a pass. Since I15 a certificate confers
`KCA_CERTIFIED` and, through KAMNET, `AGENT`.

- **The served set is data.** One empty `KbsExamAnswer` slot per served
  question, written in the start's own transaction. An answer is accepted only
  onto an existing slot, and only with answer ids of that question. The table
  already existed; what was missing was writing it at the right moment.
- **The cap at 100 is a second barrier, and it never fires.** It is there so the
  next hole of this kind grades 100, not 300.
- **Proved red with the exploit itself**, in `exam-integrity.dbspec.ts` against
  the real kbs migrations: 60 correct answers on a 20-question exam gave
  `{ refused: 0, score: 300 }` before and `{ refused: 40, score: 100 }` after.
- **The clock is checked where answers are written.** Only `saveAnswer` checked
  it, so a late submit wrote answers until the expiry job ran. Past the deadline
  plus 30 s the exam is closed on what was saved in time, graded, and the
  submission refused. The close is `updateMany ... where status = IN_PROGRESS`,
  because the expiry job races for the same row.

### An inbound lead is stored first, and announced second

From `L1`. `ContactRequest` lives in **core**, not in `kamnet`: a public request
is module-agnostic - its subject can be lands, VERIFY, KAMNET, KBS or a
partnership - and it arrives from somebody with no account. `KamnetLead` is an
agent's own prospect, `agentId` required and foreign-keyed; giving a public
request a fabricated agent would put a lead in an agent's pipeline they never
spoke to.

**The write is the success criterion and nothing else is.** A `201` means the
row exists, and the success toast fires on that alone. The notification and the
acknowledgement are queued afterwards and their failure is logged at `error`
without failing the request - the lead is already safe, and telling somebody who
wrote three paragraphs that nothing arrived makes them send it twice.

That trade is only payable because **the daily digest counts rows, not
messages**, so a request whose email was lost is still in tomorrow's count.
Remove the digest and this becomes a silent failure again.

**Consent is stored as a timestamp, and the timestamp is the server's.** A
consent time supplied by a browser is a claim about the past; the column is
`NOT NULL`, so a row cannot exist without one whatever route wrote it. The
policy path is stored beside it: consent is to a document, and documents change.

### A digest that always arrives beats an alert that never has

From `L2`. The contact form sent nothing for its entire life and no alert
noticed, because an alert fires on a condition somebody predicted and nobody had
predicted this one. The digest goes out **every day, zero included**, so its
_absence_ is the signal - and absence is something a person notices without
being told what to watch for.

It rides on `QUEUES.CORE`, as a job name in the processor that already owns that
queue. **Never a second `@Processor` on an existing queue**: BullMQ hands a job
to one worker, and that is how G6's dunning processor silently ate a payment
reminder.

### SSM is not a live configuration channel, except where it is

Of 56 parameters under `/kambriq/dev`, **7** are injected into a task definition
as `secrets` - the four `DATABASE_URL_*`, `JWT_SECRET`, and two on the web side.
The other 49 reach the container as plain `environment` values **that terraform
rendered at apply time**.

So for those 49, `aws ssm put-parameter --overwrite` changes **nothing** in the
running system. The value the container holds was copied at the last apply, and
it stays until the next one. Change `FRONTEND_URL` in SSM and every link in every
email keeps pointing where it did.

**The exception is the bootstrap prefix**, `/kambriq/{env}/api/bootstrap/*`, which
`prisma/bootstrap-admins.ts` reads at runtime through the SSM SDK. Those twelve
are genuinely live, which is the property the design was chosen for.

**The distinction is the reader, not the store.** Before saying "that is just a
parameter update", find out which of the two kinds it is.

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

### Every URL carries its locale, and the gate is asked positively

`localePrefix: 'always'`, configured once in `apps/web/src/i18n/routing.ts`.
Every page lives under `app/[locale]/`, which is also the **root layout** - there
is deliberately no `app/layout.tsx`, because two files rendering `<html>` is
invalid and the locale has to be readable where `lang` is set.

**Navigation goes through `@/i18n/navigation`.** `next/link` and
`next/navigation`'s `useRouter`, `usePathname` and `redirect` know nothing about
the prefix, so they produce URLs that resolve to nothing.
`no-unlocalised-navigation.spec.ts` bans them, and bans a hardcoded `/fr` in an
href first - the outcome before the mechanism. `notFound` and `useSearchParams`
stay on `next/navigation`: they carry no pathname, so no locale can be lost
through them.

**Two differences bite at the call site.** `usePathname` returns the path
**without** the prefix, so comparisons against route constants work unchanged.
`redirect` requires an explicit `locale` - `getLocale()` in a Server Component,
`currentLocale()` from `lib/locale.ts` anywhere else, because a Server Action
carries no `[locale]` segment and `getLocale()` would quietly answer with the
default.

**The proxy asks `isProtected()`, never `!isPublic()`.** The matcher has to see
the public paths in order to redirect an unprefixed URL to a locale, so being
matched no longer implies being protected. Negation under that wider matcher is
`P3` reintroduced: every typo becomes a members' area. The partition is the
guard - `middleware-matcher.spec.ts` fails when a route on disk is neither
public nor covered by `PROTECTED_PREFIXES`, and names it.

**The matcher stays a positive list**, in three locale entries plus the public
and protected prefixes unprefixed. next-intl documents a negative lookahead for
this file and it is not used; the refusal is written at the matcher, because
somebody will read those docs.

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

**A missing or blank bootstrap parameter turns the dev deploy red, and that is
the design.** `deploy-dev.yml` runs `prisma/bootstrap-admins.ts` unconditionally
after the migrations and fails the deploy on a non-zero exit. So an incomplete
`/kambriq/{env}/api/bootstrap/*` stops the release.

That looks like a fragility and is the opposite of one. The alternative is a
bootstrap that skips an account it cannot configure, and what it skips is an
**administrator**: the deploy goes green, the platform comes up, and the only
symptom is somebody discovering months later that an account they were told
exists never did. **A degraded path must be an explicit setting, never an
inference from absent configuration** - and there is no setting here, because
there is no environment that is allowed to have no super admin.

The failure is loud, names every parameter that is missing or empty rather than
the first, and writes nothing before it aborts. The fix is one
`aws ssm put-parameter` and a re-run of the workflow. **Do not make this step
conditional, and do not make it tolerate a partial prefix.**

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

| Thing                     | Path                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| The delivery journeys     | `apps/api-e2e/src/journeys/` — `pnpm test:journeys`                |
| Convention guards         | `apps/api/src/__test__/conventions/`                               |
| The database-backed suite | `apps/api/src/__test__/database/` — `pnpm test:db`                 |
| The route table           | `apps/web/src/middleware-matcher.spec.ts` — prints it on every run |
| Seed and its data         | `prisma/seed.ts`, `prisma/seed-data/`                              |
| Envelope contract         | `libs/common/src/__test__/interceptors/envelope-contract.spec.ts`  |
| Deployed build identity   | `GET /api/v1/health/version`                                       |
| The chantier register     | `docs/ops/registre-chantiers.md`                                   |

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

### A config file can make every type in a project a lie

`tsconfig.base.json` sets neither `strict` nor `strictNullChecks`. `apps/web`
and `libs/common` each set it locally; `apps/api` did not, so the entire API
compiled with them off. Every `T | undefined` collapsed to `T`, and every
optional property was dereferenceable without a check.

What that looked like: `dto.bio.length` typechecked on a DTO whose Zod schema
declares `bio: z.string().max(2000).optional()`. The compiler agreed that a
field the request body need not carry was always present - for every request
body the API accepts.

Turning it on cost **one** error across the whole shipped tree, in
`queue-health.service.ts`, and it was real: `'failed' in r` narrowed nothing,
because TypeScript had widened both branches of the union to carry each other's
keys as `undefined`. So the setting had been absent for no measured reason.

This is the "a type that lies" entry arriving through configuration rather than
through an annotation, and it is worse in that form: an annotation is visible at
the call site, and a compiler flag is visible nowhere. **Check what the compiler
is actually being asked to check before trusting what it accepts.**
`api-compiles-strict.spec.ts` pins it, because removing the line resolves any
strict error and nothing else would report it.

### `pnpm run lint` does not lint the repository

It is `nx run-many -t lint --all`, which covers the **six nx projects**. The
root `prisma/` directory belongs to none of them, so nothing under it is ever
linted by that command: not `seed.ts`, not `bootstrap-admins.ts`, not the KCA1
loaders.

`lint-staged` does reach them, because it runs eslint on staged paths from the
repository root. So a rule can pass `pnpm run lint` and fail the pre-commit
hook, which is how a `no-console` rule added in `A19`'s own shape came to break
seven command-line scripts after a clean lint run.

**Two scopes, and the script name names neither.** When adding or widening an
eslint rule, check it against both: `nx run-many -t lint --all` and an eslint
run from the root over the paths the hook would stage. And when a gate gains an
exemption, prove it still refuses what it is for - this one was re-checked by
reintroducing a `console.log` into a web component and watching it fail while
`prisma/` stayed clean.

A related trap sits next to it: a bare `npx eslint .` reports **138 000**
problems, because the root config ignores only `**/dist` and `**/out-tsc`, and
`apps/web/.next/` is neither. That number is build output and says nothing
about the source.

### An upsert key that differs from the key everything else uses

`prisma/seed.ts` upserts users on **email** and every other module keys on the
**id**. An account already at a seeded address keeps its own id, the seed's
`IDS.USER_*` constant is never written, and KBS candidates, KAMNET agents and
land reservations carry that id as a plain string in **separate databases**
where no foreign key can refuse a dangling one.

It surfaced as a bare `UserProfile_userId_fkey` violation, and that was the
lucky case: core is the one module with a foreign key to catch it. Keyed the
same way as the rest, the seed would have completed and attached three modules'
fixtures to a user id that does not exist.

The precondition now throws before anything is written, naming each account.
**When two writers key the same row differently, one of them is writing
somewhere the other cannot see** - and across databases, nothing tells you.

### A test can depend on typing cadence without saying so

`contact-form.spec.tsx` failed once in ten runs. The symptom was `toHaveFocus`
pointing at the **email** input, which carried `aria-invalid="true"`: the
240-character message typed one keystroke at a time had not finished, the email
was validated partial and invalid, and react-hook-form correctly focused the
first invalid field.

**Raising the timeout would have been the wrong repair** and would have looked
like the right one: the slow run would finish and the focus assertion would
still fail, at a higher number. The cause was cost, so the cost went - `delay:
null` and a paste instead of 240 keystrokes. Alone that saved 0.2 s; under the
four-project run it was the difference between six timeouts and none.

Two things beside it, both measured:

- **the first measurement was invalid and said so**. Ten runs failed ten times,
  on an Nx native binding error from a Node switch, not on the spec. A run that
  fails for a reason you introduced is not evidence about the code.
- **`nx run-many` oversubscribes the machine**: three projects in parallel, each
  with jest's default worker count. `--parallel=1` measured _faster_ (55 s, 55 s,
  49 s against 63 s) and deterministic, so `test` and `test:cov` now carry it.
  Parallelism that thrashes is slower than none.

### A library's documented default can be the defect you already removed

From wave 5. next-intl's own documentation gives this for `proxy.ts`:

```
matcher: '/((?!api|trpc|_next|_vercel|.*\..*).*)'
```

That is the **exact** negative pattern `P3` deleted, and the defect it removed:
the proxy runs on every URL the site does not serve, finds it is not public, and
sends it to a login page. Following the documentation would have reintroduced a
catalogued defect, in a file whose own comment explains why it must not exist.

The positive list survives the locale move, and that was established before
anything was written by compiling candidates through **Next's own parser**
(`next/dist/lib/try-to-parse-path`, which `getMiddlewareMatchers` calls):

```
/(fr|en)/admin/:path*  ->  ^(?:\/(fr|en))\/admin(?:\/(...))?[\/#\?]?$
true /fr/admin   true /en/admin   false /de/admin
true /admin      false /pricing   false /administration
```

**A documented default is a claim about the general case, and this repository is
a particular case with its reasons written down.** Read the local reason before
adopting the recommendation, and when you refuse one, say in the file that you
refused it and why - otherwise the next person reads the docs, sees a mismatch,
and "fixes" it.

### The framework ships a tester for its own matcher, and its docs name it wrong

Also wave 5. `middleware-matcher.spec.ts` carried a hand-written `compile()`: a
small regex translator for the two matcher shapes the repo used, which returned
`null` for anything else. It was careful, it named its own limits, and it was
still **a second implementation of somebody else's parser** - and a wrong model
reports a protected route as covered.

Next exports `unstable_doesMiddlewareMatch` from
`next/experimental/testing/server`, which answers with the code that decides at
runtime. It needs `@jest-environment node`, because it constructs a real
`Request` and jsdom has none.

**And the documentation for 16.3.6 calls it `unstable_doesProxyMatch`.** That
name appears in exactly one place in the installed package - the bundled copy of
that same documentation page - and in no shipped JavaScript. The docs were read
first, the package second, and only the second is what runs.

**Read the docs for the intent and the shipped `.d.ts` for the signature.** A
doc page will not tell you a default is a negative matcher; a type will not tell
you what the thing is for. Neither is optional, and where they disagree the
package wins.

### Moving the root layout under a dynamic segment removes the boundary above it

From wave 5, found by a browser test and invisible to 432 unit tests.

`app/layout.tsx` was deleted and `app/[locale]/layout.tsx` became the root
layout - which Next documents for internationalisation. `/fr/zzz-does-not-exist`
then answered **404 with Next's built-in page**, not the one `P3` built with
links back into the site.

Two separate causes, and the first hid the second:

- `not-found.tsx` is a **boundary**, and something has to trigger it. An
  unmatched URL under a matched dynamic segment triggers nothing, so it falls
  through to the built-in page. `[locale]/[...rest]/page.tsx` calling
  `notFound()` is what closes it.
- A `notFound()` thrown **from the root layout** has no boundary above it. So an
  unconfigured first segment still gets the built-in page, and closing that needs
  `experimental.globalNotFound`, which is off by default. It is left open, with
  the difference pinned in both directions so it is a known bound.

**The status code was 404 throughout, which is why nothing reported it.** The
assertion the suite already had - and the right one - is about the status; the
page is a second property, and it needed a test of its own.

### A path that crosses a boundary unprefixed invalidates nothing

From wave 5. Client components read their path from next-intl's `usePathname`,
which returns it **without** the locale - `/account`, never `/fr/account` - and
passed it to a server action that called `revalidatePath(path)`.

`revalidatePath` matches on the **route file structure**, so an unprefixed path
matched nothing once every page moved under `[locale]`. Nothing reports it: the
mutation still succeeds, the action still returns `{success: true}`, and the
screen simply goes on showing the old value. Forty call sites, one silent class
of staleness.

Fixed in one place rather than forty - `revalidateLocalisedPath` puts the
request's locale back - and the spec that caught it now expects
`/fr/agent/prospects`. **When a value is produced in one layer and consumed in
another, ask what the consumer matches it against**, not what the producer meant.

### An async helper that answers with a default where it cannot know

Also wave 5, and it was one line from shipping. `getLocale()` resolves the locale
from the rendered `[locale]` segment. **A Server Action is a POST handled outside
that render**, so nothing populates it - and it does not fail. It returns the
default locale.

So `redirect({href: '/login', locale: await getLocale()})` inside a server action
would have sent every English visitor into French, correctly typed, with a green
suite. next-intl's own documentation says it in one line - _"the locale is not
picked up automatically"_ - on a page about something else.

`lib/locale.ts` reads the `referer` first, because on a Server Action that is the
page the visitor submitted from, and falls back to the locale cookie. **A helper
that cannot know the answer and returns a plausible one is the "reports success
by saying nothing" family, wearing a return value instead of a silence.**

### Control flow thrown as an error, and logged as a failure

From wave 5, found by reading a build that exited 0. `next build` printed
**sixteen** `UnhandledServerActionError` lines, from the application's own
logger, for routes doing exactly the right thing.

Next signals redirects, `notFound()` and a bail-out to dynamic rendering by
**throwing**, with the reason in `error.digest`. `createAction` recognised
`NEXT_REDIRECT` and only that, so the other two were logged at `error` and
rethrown. The digests were read from the shipped package rather than remembered:
`NEXT_REDIRECT`, `NEXT_HTTP_ERROR_FALLBACK` (which carries `notFound`,
`forbidden` and `unauthorized`) and `DYNAMIC_SERVER_USAGE`.

**The cost is not the noise.** It is that a real unhandled error in that log is
indistinguishable from normal operation - the same shape as
[a barrier that fires correctly still has to be reported correctly](#a-barrier-that-fires-correctly-still-has-to-be-reported-correctly),
one layer down. 16 lines to 0, proved by rebuilding.

### TypeScript will not narrow through a `never` it was handed indirectly

`redirect` from next-intl **is** declared as returning `never`, and it does - it
delegates to Next's `redirect`, which throws. But it arrives as
`export const { redirect } = createNavigation(routing)`, a binding destructured
from a call, and TypeScript narrows control flow through a `never`-returning call
only when the callee's declaration carries an **explicit type annotation**.

The compiler therefore reported `'candidate' is possibly 'null'` at six call
sites and `A function returning 'never' cannot have a reachable end point` at a
seventh - seven errors describing the same missing annotation, none of them
naming it. One line fixes all seven:

```ts
export const redirect: typeof navigation.redirect = navigation.redirect;
```

**When several unrelated call sites break at once, suspect the declaration they
share**, not each of them.

### A transform allowlist copied from npm does not work under pnpm

next-intl is ESM-only, and its documentation gives
`transformIgnorePatterns: ['node_modules/(?!next-intl)/']`. Under pnpm a real
path is
`node_modules/.pnpm/next-intl@4.8.3_.../node_modules/next-intl/dist/...`, and the
pattern is **unanchored** - so it matches at the first `node_modules/`, the one
followed by `.pnpm`, and the file is ignored after all. The failure reads as
next-intl being broken.

`node_modules/(?!.*(?:next-intl|use-intl|@formatjs|intl-messageformat|icu-minify|@schummar))`
asks whether the whole remaining path mentions one of them, so it answers the
same at every `node_modules/` in it. **And the list is the dependency chain, not
the package you imported**: each one surfaces only once the one above it is
transformed, and a short list fails with the next package's name.

### A merge can move a file to a path that stopped existing, and nothing reports it

From the develop merge of 25 September, and it is the sharpest thing that merge
found.

Wave 5 moved every page under `app/[locale]/`. Develop, meanwhile, added six new
files at the old paths - `app/(app)/agent/profile/` and
`app/products/kamnet/annuaire/`. Git merged them **cleanly**: they are new files
on one side and the other side never touched them, so there is no conflict to
raise. The suite stayed green.

**What made it invisible is that the URL is the same.** Both route walkers -
`middleware-matcher.spec.ts` and `routes-have-pages.spec.ts` - strip `[locale]`
when computing a URL, precisely so the lists in `routes.ts` can be written
without it. A page at `app/(app)/agent/profile/page.tsx` therefore computes
`/agent/profile`, exactly as one under `[locale]` does, and both walkers were
satisfied. The page would have rendered outside the only root layout the app
has: no `<html>`, no locale, no provider.

`no-unlocalised-navigation.spec.ts` now asserts the **placement** as well as the
navigation: every `page.tsx` and `route.ts` lives under `[locale]`, bar a named
list of files Next requires at the app root. It found three more offenders the
same minute - `newsletter-signup.tsx`, `directory-section.tsx` and
`certificate-number-lookup.tsx`, all importing `next/link` or `next/navigation`.

**The general rule: after a merge that follows a large move, ask what the other
branch created while the move was happening.** A conflict is raised when two
sides edit the same path. Nothing is raised when one side edits a path the other
side deleted out from under it, and nothing is raised at all when one side
simply adds a file where a directory used to mean something.

### A suite that cannot run reports no defect, and looks like a suite that passes

Also from that merge. `image-hosts.spec.ts` - A40's guard against a wildcard in
the image allowlist, the one reachable critical out of 111 alerts - failed with
`ReferenceError: TextDecoder is not defined` and ran **zero** of its 25 tests.
It imports `@aws-sdk/client-s3`, which reaches `@smithy/core`, which reads
`TextDecoder` at module scope; jsdom does not provide it and the project's
default environment is jsdom.

**It was red on develop, not broken by the merge**, and that was established
rather than assumed: reverting the web jest config to develop's own left the
failure unchanged. Not one line of the spec touches the DOM, so
`@jest-environment node` is the whole fix, and 25 assertions began running.

This is [a check that never runs](#a-check-that-never-runs-looks-exactly-like-a-check-that-passes)
arriving through the test environment rather than through a script. **`Tests: 0
total` beside a red suite is not a failing test - it is a missing one**, and a
summary line that counts suites rather than assertions reads the two alike.

### A comment rewrite can delete the reason and keep the sentence

The uncomfortable one, and it is about our own work. Wave 2 rewrote comments
repository-wide under section 9 - be technical, be concise, remove the stories.
On four files the merge showed what that cost, because develop still had the
originals:

- `throttler-behind-proxy.guard.ts` became _"Custom ThrottlerGuard to correctly
  identify the client IP behind a load balancer"_, losing **why the last
  `X-Forwarded-For` entry** and the note that a CDN would move the offset;
- `robots.ts` lost the entire reason `NODE_ENV` cannot make the decision - which
  is the defect P4 existed to prevent;
- `types/kamnet.ts` lost the warning that `PublicAgentProfile` is a misnomer for
  an agent-to-agent view carrying ranking metrics;
- `kamnet.module.ts` lost what the public directory publishes and what it does not.

Develop's versions were taken back on all four.

**Concise is not the same as short.** Section 9 says to cut anecdote and to keep
what clarifies a non-obvious constraint; a measurement, a threat model and a
misnomer warning are the constraint. The test to apply is not "can this be said
in fewer words" but **"can the next person get this wrong without it"** - and if
they can, the words are load-bearing however conversational they look.

### A freeze written on one branch is a claim, not a property

`WAVE_STATUS.md` was archived and frozen on 24 September on the remediation
branch, with a banner saying nothing further would be written in it. Develop had
not seen that commit, so the file went on being written there for another day -
five hundred and fifty more lines, six more chantiers - and the merge brought all
of it in, onto the renamed path, without a conflict.

Nothing was wrong on either side. The freeze simply was not a fact about the file
until both branches held it. **A convention introduced on a long-lived branch is
not in force until that branch merges**, and the window is exactly as long as the
branch is unmerged - which is the argument for merging often rather than for
writing louder banners.

## 9. Code Comments and Documentation Tone

**The goal is strict, concise, and professional technical documentation.**

When writing or rewriting comments across the codebase, adhere to these rules:

1. **Be Technical and Direct**: Focus strictly on the technical behavior, domain logic, constraints, and intent. Explain _what_ the code does and _why_ it does it technically.
2. **Remove Fluff and History**: Never write conversational stories, personal anecdotes, or lengthy histories about _how_ a bug was discovered or _which_ developer made a decision (e.g., "Visquis arbitrated this in September", "Due to a bug in Next.js...", "This is here because we used to...").
3. **Keep it Concise**: Distill long-winded paragraphs into succinct summaries. If it can be said in one sentence, don't use three.
4. **Professional English and Punctuation**: Write in good, formal English. Use standard punctuation marks and formatting. Avoid emotional language, complaints, or casual asides.
5. **No Useless Comments**: Skip commenting if the code is self-explanatory (e.g., simple DTOs). Do not add noise. Add comments only where they clarify complex logic, business rules, or non-obvious architecture.
6. **Use Correct Tools**: Use `///` for Prisma schemas, `/** */` for JSDoc/TSDoc on classes/functions, and `//` for inline logic explanations.

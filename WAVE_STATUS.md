# WAVE_STATUS - the 20 September wave

One section per step. Written as each step closed, so a run id named here is the
run that certified the commit above it.

**A note that applies to every stacked PR in this wave.** `ci.yml` declares
`pull_request: branches: [main, develop]`. A PR whose base is a feature branch
matches no trigger, so it runs **no CI at all** - and GitHub still reports it
mergeable. #155 (base `develop`) has 10 checks; #156 and #157 have 0. The wave
brief requires stacking when the previous PR is unmerged, so this is a
consequence of the instruction rather than a mistake, but it means the gates for
steps 2 and 3 were run locally and in full, and those PRs are only really gated
once retargeted to `develop`.

---

## Step 1 - I38: unscoped reads in KBS

**PR #155** - `fix/i38-kbs-course-scope` -> `develop`
**Run 35509437289** - conclusion **success**.
Jobs: CI Gate, Commitlint, Database suite, Quality, What changed all `success`;
build/deploy/journeys `skipped`, as expected on a pull request.

### Proved red

`apps/api/src/__test__/database/kbs-quiz-course-scope.dbspec.ts`, new, against
real Postgres and the real kbs migrations. Two courses coexist and the candidate
is enrolled in one. Before the guard, the five candidate entry points accepted a
module or lesson id belonging to the OTHER course - the refusal assertions
resolved instead of rejecting - and the two absence assertions found rows that
should not exist: `KbsCandidateProgress` and `KbsLessonCompletion` banked against
a course the candidate was not studying.

The fixture is the point. Every existing quiz unit test mocks
`kbsModule.findUnique` returning a module with no course context, so none of them
could ever have caught this: the discriminating data was not in the fixture.

### Changed

One reader and one guard in `apps/api/src/kbs/settings/active-course.ts`:
`readActiveCourse` (returns the row, because `examPoolShortfall` and
`findModuleDetail` read counts from the same row) and `assertInActiveCourse`
(refuses with `NotFoundException`, not `Forbidden`, so a candidate does not learn
that a foreign module exists; reuses existing i18n keys, so no new user-facing
wording).

Six holes closed: `findQuestionsForQuiz`, `findModuleDetail`, `findLessonById`,
`findLessonView`, `markLessonComplete` and `submitQuiz`. The three that WRITE
refuse; the read-only display paths allow an absent settings row, because I21
established that a missing row is a state and not a 500.

### Premises checked

| Premise                                                   | Held                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| Three unscoped reads named in the brief                   | Yes - and a sixth, `findLessonView`, which the brief did not name |
| Two of the holes write rows                               | Yes - `KbsCandidateProgress` and `KbsLessonCompletion`            |
| A shared helper is better than three copies of the filter | Yes                                                               |

### Reported, not fixed

- **Injecting `KbsSettingsService` was measured and rejected.** About seventeen
  spec files construct these services with explicit provider lists, and a new
  constructor dependency makes each fail to INSTANTIATE. A suite that fails to
  build is not red. The function takes the `KbsPrismaService` all four services
  already hold.
- `submitQuiz`'s `previousModules` check is **not** redundant after the guard.
  The guard proves the module is in the active course; that check proves the
  earlier modules were passed. Orthogonal, so it stays.

### Copy invented

None. The guard reuses `kbs.module.notFound` and `kbs.lesson.notFound`.

---

## Step 2a - I42: the seed undoes the course switch

**PR #156** - `fix/i42-seed-keeps-active-course` -> `fix/i38-kbs-course-scope`
**No run exists** - stacked PR, see the note at the top. Gate run locally:
api 875/875, test:db 109/109, web 348/348, typecheck api 0, typecheck web 0,
lint 6/6, prettier clean.

### Proved red, in three states, each watched

`apps/api/src/__test__/database/kbs-settings-seed.dbspec.ts`, new.

| state                                                  | "a switch survives a re-seed"                         | "a NULL row is repaired"                       |
| ------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------- |
| `update: { activeCourseId }` - develop's code          | **RED** `Expected "…33467a4a" / Received "…672c3721"` | green                                          |
| `update: {}` - the obvious fix, forbidden by the brief | green                                                 | **RED** `Expected "…615b8585" / Received null` |
| the fix                                                | green                                                 | green                                          |

Either assertion alone passes for the wrong reason. That is why there are two,
and why both wrong fixes were run rather than reasoned about.

### Changed

`prisma/kbs-settings-apply.ts`, new: create carries the id, a NULL row is
repaired, a row naming a course is left alone whichever course it names. The
condition is a `where` clause on `updateMany`, so Postgres holds the rule rather
than this code remembering to check it. It returns an outcome
(`created` / `repaired` / `left-in-place`) and the seed prints it, because a
mechanism that reports success by saying nothing is the defect being fixed.

The comment in `seed.ts` was **rewritten, not deleted** - it now explains both
halves: why a NULL must be repaired, and why an existing choice must not be
overwritten.

### Premises checked

| Premise                                                                | Held                                               |
| ---------------------------------------------------------------------- | -------------------------------------------------- |
| `seed.ts:437` is `update: { activeCourseId: IDS.KBS_COURSE }`          | Yes                                                |
| `IDS.KBS_COURSE` is the DEMONSTRATION course, created at `seed.ts:324` | Yes (created at 321-331)                           |
| The comment above it states its reason honestly                        | Yes - and it is still true for the null case       |
| The seed step is gated on `run_seed`, default false                    | Yes - not imminent, dangerous on any manual reseed |

### Reported, not fixed

- **`seed.ts` exports nothing.** `main()` is private and runs at module load
  across all four databases, so a test importing it would execute ~1500 lines of
  seeding as an import side effect. The settings write was therefore extracted to
  `prisma/kbs-settings-apply.ts` - the split `kca1-apply.ts` already uses - so the
  seed calls the function the test calls. This was a design decision the brief did
  not specify.
- **A test defended the defect.** `seed-ids.spec.ts` asserted the id appeared in
  the upsert TWICE - accurate about the code, wrong about the requirement, green
  for exactly as long as the defect existed. Inverted, not deleted: it now pins
  the wiring while the dbspec proves the behaviour.

### Proof by execution

Against local docker, through the real `pnpm db:seed` - the discriminating form,
because the first run reported "left alone" over a row that already held the
seeded id, where leaving it and rewriting it look identical:

- row switched to another course -> re-seed -> `left alone, active course stays
…cffffffffff1`, row unchanged
- row set to NULL -> re-seed -> `repaired to …c00000000001`

### Copy invented

The three outcome sentences printed by the seed (`KBS settings created…`,
`… had no active course - repaired to …`, `… left alone, active course stays …`).
Operator-facing log lines, not product copy, but flagged for Visquis.

---

## Step 2b - I17: the candidate routes carry no role

**PR #157** - `fix/i17-candidate-route-roles` -> `fix/i42-seed-keeps-active-course`
**No run exists** - stacked PR, see the note at the top. Gate run locally:
api 880/880, test:db 109/109, web 348/348, typecheck api 0, typecheck web 0,
typecheck api-e2e 0, lint 6/6, prettier clean.

### Proved red, and non-vacuously

```
● the role-free candidate routes are exactly the pre-candidate surface
    - Expected  - 2
    + Received  + 21

● every other candidate route demands CANDIDATE_KBS
    Expected length: 19
    Received length: 0
```

The second assertion was added after noticing the test passed **vacuously**
without it: the loop iterates the routes that HAVE roles, and in the red state
that list is empty, so every assertion inside it was satisfied while not one
route carried a role.

### Changed

Route-level roles on `kbs-candidate.controller.ts`, never class-level. 4
role-free, 17 guarded. `route-guards.spec.ts` gained a route-level sweep that
counts decorator POSITIONS rather than token occurrences - the lesson that file
already records - plus a separate, independently failable assertion that the
candidate role is never at class level.

### Premises checked

| Premise                                                           | Held                                                                                                                                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RolesGuard` returns true when a route declares no roles          | Yes - `roles.guard.ts`, the whole defect                                                                                                                                                               |
| Hazard 1: `KCA_CERTIFIED` is added, `CANDIDATE_KBS` never removed | Yes - `addRole` at `certificates.service.ts:116` (brief said 115); `removeRole` exists for `KCA_CERTIFIED` and `AGENT`, never for `CANDIDATE_KBS`                                                      |
| Hazard 2: roles re-read from the DB per request                   | Yes - `jwt.strategy.ts:80` maps `user.userRoles`; the token payload is not trusted                                                                                                                     |
| `ADMIN_KBS -> CANDIDATE_KBS`, `AGENT` not                         | Yes - `ROLE_HIERARCHY`                                                                                                                                                                                 |
| The controller has 22 routes, 20 to guard                         | **NO - it has 21, so 17 are guarded.** The brief's own count, already once corrected, is still off by one. It changes neither the design nor the risk, so I decided and report it rather than stopping |

### Escalated, and decided by Visquis

`GET /kbs/me` and `GET /kbs/certificate/me` fit neither tier. They are the
"am I enrolled / do I have a certificate" probes, which only have a point when
the answer may be no. Guarding them turns a 404 into a 403, and the web's
`nullOn404` catches exactly 404 while `create-action.ts:40` rethrows everything
else - so `/kbs/enroll`, the page the public call to action links straight at and
which is authentication-only, would have rendered an error overlay instead of its
form. Healthy for everyone already enrolled, broken for exactly the population
being added. **Visquis chose the role-free tier.**

### Reported, not fixed

- `getCourseModules` carries an `if (!candidate)` branch for non-enrolled users
  that is now unreachable. Left in place; deleting it is not this subject's call.
- Guarding `GET /kbs/courses` forecloses a pre-enrolment catalogue. Nothing calls
  it today - not the web, not the journeys - and a public catalogue would belong
  on `kbs-public.controller.ts`.
- **The behavioural proof does not gate this PR.** Journey 3 carries the three
  assertions (CLIENT gets 403; can still reach `cv/upload-url` and enrol; the
  SAME token then passes the guard with no re-login), and it runs in
  `Delivery journeys (dev)` **after** merge. Naming the job that runs a test is
  the rule, and this one's job is post-merge.

### Copy invented

None.

---

## Step 3 - P9: the KAMNET arbitrage in code

**PR #158** - `fix/p9-kamnet-arbitrage` -> `fix/i17-candidate-route-roles`
**No run exists** - stacked PR, see the note at the top. Gate run locally:
api 886/886 (73 suites, 2 new), web 348/348, test:db 109/109, typecheck api 0,
typecheck web 0, lint 6/6, prettier clean. Suites re-run after formatting.

### Proved red - three assertions, each watched

| assertion                           | red against develop                        |
| ----------------------------------- | ------------------------------------------ |
| sponsor chain levels present        | `[1, 2, 3]` where `[1]` was expected       |
| `getMyNetwork(_, 3)` nesting        | a nested tree where one level was expected |
| promote on 10 sales and 0 referrals | `Number of calls: 0` - update never called |

Two fixture decisions carry those assertions. The depth fixture is **four deep
in both directions**, so an answer of one level proves the CLAMP and not the
shape of the data - a shallow fixture agrees with every possible limit and
discriminates between none. The promotion fixture has **zero** referrals,
because ten-sales-and-ten-referrals is promoted under the old rule and the new
one alike, so a test built that way cannot tell them apart.

The depth spec also carries an explicit fixture assertion, because without it
every assertion below it would pass against a one-level fixture.

### Changed

`KAMNET_MAX_SPONSORSHIP_DEPTH` 3 -> 1, with a comment saying what it now means
and why, so the next reader does not "restore" it. `MANAGER_REFERRALS` removed;
MANAGER is ten completed sales. `_count: { referrals: true }` removed from
`checkPromotion` - a count loaded for a condition that no longer exists is a
query nobody can explain later. `findById` keeps its own count: that is the
profile's `referralCount`, and referrals still exist and still matter.

### Every comment corrected

A constant changed while comments keep describing the old value is how the next
reader gets it wrong. `N2`, `N3` and `level 3` swept across `apps` and `libs`:

- `constants/kamnet/index.ts` - the constant's own `// N1, N2, N3`
- `network.service.ts` - class docstring, the depth table on `getMyNetwork`, the
  sponsor-chain walk comment
- `kamnet.module.ts` - "N1-N3 depth"
- `kamnet-agent.controller.ts` - the network route description, the `depth`
  `ApiQuery` description, the sponsor-chain description
- `commissions.service.ts` - the level scheme
- `kamnet-admin.controller.ts` - "levels 0 (DA) through 3 (N3)"
- `types/kamnet.ts` - `NetworkNode` recursion note and the commission level doc
- `lib/actions/kamnet.ts` - the clamp comment
- `agent/network/page.tsx` - the tier/depth prose

**Two UX-specification quotations were left exactly as written** and marked
superseded instead (`network-content.tsx`, `page.spec.tsx`). Editing a citation
to match a later decision misrepresents the document it cites.

### A hardcoded 3 that the constant never reached

`DEPTH_FOR_TIER` in `agent/network/page.tsx` held a literal `3`. When the
constant moved, it did not: the page went on asking for a depth the action
silently clamped, so page and server disagreed and nothing reported it. It now
reads the constant. That literal is also exactly why one of the three inverted
tests did NOT go red when the constant changed - it was agreeing with the page
rather than with the platform.

### Three tests inverted, not deleted

`kamnet.spec.ts` x2 and `page.spec.tsx` x1. Each asserts the **literal 1**, not
`KAMNET_MAX_SPONSORSHIP_DEPTH`: an expectation computed from the same constant
the code reads passes for every value of it, including one nobody decided.

### Premises checked

| Premise                                                                                                 | Held                                                                       |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| The constant is read in four places (`network.service.ts` 48, 62, 124; `web/lib/actions/kamnet.ts` 185) | Yes                                                                        |
| No commission logic reads it                                                                            | Yes                                                                        |
| Seeded commissions are level 0 and 1 only                                                               | Yes - and the dev kamnet database holds only `0` (3 rows) and `1` (2 rows) |
| No code path writes level 2 or 3                                                                        | Yes - nothing is stranded                                                  |
| `MANAGER_REFERRALS` has exactly one reader (`agents.service.ts:193`)                                    | Yes                                                                        |

### Reported, not fixed

- **I32 is untouched and still open.** `getMyNetwork` still never reads the
  caller's tier; the rule lives in the page. The depth change shrinks what that
  gap can expose, because everyone is clamped to N1 anyway. **A narrowed blast
  radius is not a fix**, and the day the depth rises the hole is the size it
  always was.
- The depth DTOs still `.max(3)` and the `ApiQuery` still lists `[1, 2, 3]`, so
  a caller may ask for 3 and be clamped rather than refused. Narrowing
  validation would turn an existing clamp into a 400 for any client still
  sending 3, and that is its own decision.
- `KamnetCommission.level` remains an `Int` that accepts 2 and 3, and the admin
  create-commission endpoint still does too, though nothing produces them.

### THE GAP BETWEEN STEP 3 AND STEP 4 - live while it lasts

Required by the wave brief, and true right now:

**`products.kamnet.agentJourney.step7.description` still reads "Manager (+10
filleuls +10 ventes)" / "Manager (+10 referrals +10 sales)" on the public site.**
P9 has just removed the referral condition from the code. If #158 merges before
step 4 lands, the site states a tier rule the platform no longer applies.

The same page also still publishes `products.kamnet.commissions.saleDetail` -
"3% de la valeur de vente - versés à J+15" - a rate, a base and a payment
deadline that nothing in the platform computes or pays. That is P21, and it is
step 4's subject rather than a consequence of this step.

### Copy invented

None. This step changed no user-facing string.

---

## Step 4 - P21 + P20: the public site stops promising what does not exist

**PR #159** - `fix/p21-p20-site-honesty` -> `fix/p9-kamnet-arbitrage`
**No run exists** - stacked PR, see the note at the top. Gate run locally:
web 357/357 (21 suites, 1 new), api 886/886, test:db 109/109, typecheck api 0,
typecheck web 0, lint 6/6, prettier clean. Suites re-run after formatting.

**This step closes the gap step 3 opened.** Merged in order, the site is never
left stating the tier rule the code stopped applying.

### Proved red, in three stages

**One.** The pin failed on six assertions with the copy in place, naming the
offenders: `commissions.saleDetail` and `.reservationDetail` for a rate quoted
as remuneration (both languages), `saleDetail` again for the `J+15` / `D+15`
deadline, and ten (fr) / eleven (en) keys for the earning promise.

**Two - the pin was NARROWED, because it flagged two honest strings.** Both are
the shape this repository keeps relearning: the copy that explains a thing is
the first casualty of a sweep that bans the word.

- `products.kbs.modulesDetail.items[3].lectures[3].title` = "Argent &
  commissions - Pourquoi l'agent ne touche jamais l'argent". A KCA1 LESSON
  TITLE, teaching the opposite of a promise. Banning it would delete curriculum.
- `products.kbs.hero.certificateBadge` (en) = "Earn your KCA certificate". That
  earns a certificate, not an income.

The pattern now matches phrases that promise money to an agent, and the loaded
syllabus is excluded by name with its reason.

**Three - proved by mutation.** Reinstating one removed string trips THREE
assertions: the rate ban, the delay ban, and the fr/en parity check, because the
key came back in one language only.

### Why the ban is narrow

Eight honest public strings carry a percentage - "100% en ligne", "Score minimal
: 80 %", "évite 80% des erreurs terrain", "plus de 95% du territoire", and four
"Acompte ... 5%" lines. **The buyer's 5% deposit is real, implemented and
charged.** A guard that refuses it is deleted by the first person it blocks, so
what is banned is a percentage WITH remuneration wording, plus any `J+n`/`D+n`
delay - a pattern that occurred exactly once in the whole file, in the string
being deleted. `app` and `landsAdmin` are excluded: `landsAdmin.form.pv` is
literally "coefficient de commission", and once C14 settles a grid the agent's
own space will legitimately carry rates.

### Every key removed, both files in lockstep

- `products.kamnet.commissions` - the whole block (`title`, `subtitle`,
  `saleLabel`, `saleDetail`, `reservationLabel`, `reservationDetail`)
- `products.kamnet.whyAgent.commissions` - `title`, `description`
- `products.kbs.whyKbs.income` - `title`, `description`

### Every key rewritten, both files

| key                                                  | why                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `products.kamnet.hero.title`                         | the earning promise; replaced around the agent's role and the certification |
| `products.kamnet.hero.subtitle`                      | promised commissions AND the exclusive catalogue; both go                   |
| `products.kamnet.agentJourney.step7.description`     | "+10 filleuls" - the condition step 3 removed from the code                 |
| `products.kbs.admission.sponsorship.description`     | claimed "accès prioritaire avec un code parrain"                            |
| `products.kbs.admission.freeApplication.description` | read as open to anyone; the form is behind the login wall                   |

### Premises checked

| Premise                                                                                 | Held                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `products.kamnet.commissions` publishes a rate, a base and a deadline in both languages | Yes, verbatim as the brief quotes it                                                                                                                                                                                                                    |
| `POST kamnet/applications` carries `@Roles(RoleCode.KCA_CERTIFIED)`                     | Yes - `kamnet-agent.controller.ts:49-50`. You qualify into KAMNET after the certificate                                                                                                                                                                 |
| The sponsor code grants no priority                                                     | Yes - stored at `candidates.service.ts:84` and echoed back at five read sites; nothing orders, prioritises or gates on it                                                                                                                               |
| The admission form sits behind the login wall                                           | Yes - `admission.tsx:52` links to `/kbs/enroll`, and `/kbs` is in `PROTECTED_PREFIXES`                                                                                                                                                                  |
| "Read P20's row in the tracker"                                                         | **Partly.** There is no P20 row in `registre-chantiers.md`. P20, P21 and C14 live in the dated 2026-09-20 entry of `ops_kambriq_base-comprehension_v01.md`. The three promises were read there and confirmed against the code rather than reconstructed |

### Copy invented - FOR VISQUIS TO APPROVE

Two strings, in both languages. Everything else was a removal or a factual
correction.

- `products.kamnet.hero.title`
  - fr: "Le réseau des agents certifiés KAMBRIQ"
  - en: "The network of KAMBRIQ certified agents"
- `products.kamnet.hero.subtitle`
  - fr: "Les agents KAMNET sont certifiés par KAMBRIQ Business School et
    accompagnent les acheteurs à chaque étape. On rejoint le réseau après la
    certification KCA."
  - en: "KAMNET agents are certified by KAMBRIQ Business School and support
    buyers at every step. You join the network after obtaining the KCA
    certification."

Written around the chain the code already enforces - candidate, KBS, certified,
then agent application - and never around what an agent earns.

The four corrected strings (step7, sponsorship, freeApplication) are factual
rather than editorial, but they are still words on a public page and are listed
above for the same reason.

### Reported, not fixed

- **Two dead components deleted**, which goes beyond "copy only" and is a
  judgement call: `commissions-model.tsx` rendered the schedule and
  `kamnet-hero.tsx` the old hero. Neither symbol appeared outside its own file,
  and the live page mounts `Hero`, `WhyKambriqAgent`, `WhyKamnetAgent`. A
  component that still renders a deleted commission schedule is how it comes
  back. **Worth knowing: the schedule therefore had no mounted renderer** - it
  shipped in the message bundle rather than on a rendered page.
- **The login wall on `/kbs/enroll` is P5's** and is untouched. `routes.ts` says
  so in as many words. The copy was corrected to match reality instead.
- `whyKbs.network.description` and `whyAgent.exclusiveAccess.description` still
  promise the exclusive catalogue. That is **P10**; the brief said not to
  overcorrect.
- `apps/web/src/app/kamnet/apply/page.tsx` is a hardcoded French form with no API
  wiring behind it - placeholder inputs and a local `STATUS_CONFIG`. Not this
  subject, and named here so it is not mistaken for working.

### A mistake I made and caught

Reverting the mutation with `git checkout -- fr.json` reset that file to HEAD
and silently **wiped all four of my fr.json edits**, while `en.json` kept its
own - the exact fr/en lockstep defect this brief exists to prevent, self-
inflicted. It was caught by reading the working-tree listing rather than
assuming the revert did what it was aimed at, and the edits were re-applied with
a parity assertion. A mutation should be undone by re-applying the edit, not by
checking the file out.

---

## A38 - CI runs on every pull request, whatever its base

**PR #161** - `fix/a38-ci-gates-every-pr` -> `develop`. Gate run **35645150062**,
conclusion **success** (CI Gate, Commitlint, Quality, What changed; build,
deploy, e2e and journeys skipped as normal on a PR). Not merged: merging is
Visquis's act.

### The five `if:` lines I read, quoted, with their line numbers

All on `.github/workflows/ci.yml` as this PR leaves it:

```
285:    if: github.event_name == 'push' && github.ref == 'refs/heads/develop'   # build-api
398:    if: github.event_name == 'push' && github.ref == 'refs/heads/develop'   # build-web
499:    if: github.event_name == 'push' && github.ref == 'refs/heads/develop'   # deploy-dev
526:    if: github.event_name == 'push' && github.ref == 'refs/heads/develop'   # journeys
553:    if: github.event_name == 'push' && github.ref == 'refs/heads/develop'   # e2e
```

The brief named the last only as "the job at ~548"; it is **e2e**, declared at
548 with its condition at 553. Line numbers shifted +5 from the brief's estimates
because the widened trigger carries a six-line comment.

Since every expensive job is gated on push-to-develop rather than on the
trigger's filter, widening cannot build, push to ECR, deploy, or run the
journeys or e2e. What it adds on a PR to any base is `changes`, `commitlint`,
`quality`, `test-db` and `gate` - and `quality` is conditioned on
`needs.changes.outputs.code == 'true'` (line 153), `test-db` on that plus
`db == 'true'` (line 237).

### What the shape test asserts, and both mutations

`apps/api/src/__test__/conventions/ci-runs-on-every-pull-request.spec.ts`, run by
`Quality` via `nx test api`, alongside its 22 siblings. Four assertions:

1. it is reading the workflow it thinks it is (vacuity guard);
2. `pull_request` carries no `branches` restriction;
3. `push` still restricts to `[main, develop]`;
4. each of the five expensive jobs still carries its push-and-develop condition.

**Watched red before the fix:** 1 failed, 7 passed - the failure being assertion
2 alone, `Expected pattern: not /^\s*branches:/m`.

**Both mutations watched failing, each alone:**

| mutation                             | result                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------- |
| put `branches: [main, develop]` back | assertion 2 fails; 1 failed / 7 passed                                     |
| remove the `journeys` job's `if:`    | `journeys still runs only on a push to develop` fails; 1 failed / 7 passed |

It parses text, not YAML: neither `js-yaml` nor `yaml` is a dependency, and
`image-carries-seed-deps.spec.ts` and `env-vars-declared.spec.ts` already read
build files as text.

**The behavioural half is an observation, not a test.** Nothing automated covers
GitHub's own dispatch, and it can only be seen after this merges.

### #156 to #159: gated only by local runs, or not?

The brief asked for this explicitly, and the accurate answer differs from the
one I first wrote - I corrected the commit message and the PR body after checking
the API rather than my own notes.

| PR   | head merged | base at merge | pull_request runs on that head             |
| ---- | ----------- | ------------- | ------------------------------------------ |
| #155 | `7fa8123`   | develop       | 35509437289 success                        |
| #156 | `cdb4e2b`   | develop       | 35620911896 success                        |
| #157 | `79a7324`   | develop       | 35623641088 cancelled, 35623641855 success |
| #158 | `fd61be4`   | develop       | 35626085692 success                        |
| #159 | `78a0cf8`   | develop       | 35642046441 success                        |

**All four were re-targeted, and all four were gated.** None merged on local runs
alone. What is true is the defect stated from the other side: while stacked,
their original heads carried nothing at all, and still do -

```
7cc8f53  total runs ever: 0
d4ef20e  total runs ever: 0
5bea3ca  total runs ever: 0
a2cecef  total runs ever: 0
```

The re-targeting is what gave them CI. Without it they would have merged with no
checks, and GitHub would have called each one mergeable.

### Reported, not fixed

`ci.yml` is deliberately left un-prettier-formatted. Checked **in place** - the
only way the config resolves correctly - develop's own copy is equally
non-conforming, yml sits outside the lint-staged globs, and `--write` rewrites 27
lines across eleven hunks of quote style in jobs this subject never touches, and
drops a line at end of file. The diff here is exactly two hunks.

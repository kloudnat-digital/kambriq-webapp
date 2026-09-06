import {
  API,
  assertMinted,
  assertOwnedByThisRun,
  call,
  findTokenInMailbox,
  login,
  uniqueEmail,
} from './support';

/**
 * The journeys the delivery is defined by, run against a deployed API.
 *
 * They were proven by hand on 2026-09-04. Proven by hand means proven once, by
 * one person, on one build — nothing stops them regressing on Tuesday. This is
 * the same evidence, taken automatically, against a build identified by its
 * commit.
 */

const PASSWORD = 'Test1234!';
const PRE = '00000000-0000-4000-8000-';
const MODULE_1 = `${PRE}c00000000002`;
const MODULE_2 = `${PRE}c00000000003`;
const LESSONS = [31, 32, 33, 34, 35, 36].map((n) => `${PRE}c0000000${String(n).padStart(4, '0')}`);

jest.setTimeout(300_000);

let admin: string;
let agent: string;

/**
 * The sha gate.
 *
 * A live proof taken against the wrong build proves nothing about the change it
 * was meant to certify. That happened this week: a deploy was gated on the ECS
 * revision number reaching 106, the number advanced for an unrelated merge, and
 * a fix appeared to fail against a build that did not contain it. **A monotonic
 * counter says something changed, not what is running.**
 *
 * `EXPECTED_SHA` is supplied by CI as the commit under test. Locally it is
 * usually unset, and then the gate reports what it found rather than asserting —
 * an unset variable must not read as a passing gate, so the value is printed.
 */
beforeAll(async () => {
  const res = await call('GET', '/health/version');
  if (res.status !== 200) {
    throw new Error(`${API}/health/version answered ${res.status}: ${res.body.slice(0, 200)}`);
  }
  const { data } = res.json<{ data: { gitSha: string; imageTag: string; env: string } }>();
  const expected = process.env['EXPECTED_SHA'];

  if (expected) {
    const short = expected.slice(0, 7);
    if (!data.gitSha.startsWith(short) && data.imageTag !== `sha-${short}`) {
      throw new Error(
        `sha gate: expected ${short}, deployed gitSha=${data.gitSha} imageTag=${data.imageTag}. ` +
          `Refusing to certify a build that is not the one under test.`,
      );
    }
  } else {
    console.log(
      `sha gate NOT ENFORCED (EXPECTED_SHA unset). Deployed: ${data.imageTag} / ${data.gitSha}`,
    );
  }

  admin = await login('admin@kambriq.com');
  agent = await login('eric.mbou@kambriq.com');
});

// ---------------------------------------------------------------------------

describe('journey 1 - a new user signs up, verifies, and logs in', () => {
  const email = uniqueEmail('j1.signup');
  const mailbox = email.split('@')[0];

  it('registers, and refuses the login until the address is verified', async () => {
    const reg = await call('POST', '/auth', {
      body: {
        email,
        password: PASSWORD,
        firstName: 'Journey',
        lastName: 'One',
        phone: '+237600000001',
      },
    });
    expect(reg.status).toBe(201);

    const early = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
    expect(early.status).toBe(401);
    // Refused for the right reason, not by accident.
    expect(early.body).toContain('vérifier votre adresse email');
  });

  it('sends a verification link carrying a real token, not a promise', async () => {
    const token = await findTokenInMailbox(mailbox, /verify-email\?token=([0-9a-f]{64})/);

    // A3: the link shipped `?token=[object Promise]` for months.
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const verify = await call('POST', '/auth/verify-email', { body: { token } });
    expect(verify.status).toBe(200);
  });

  it('logs in once verified', async () => {
    const res = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
    expect(res.status).toBe(200);
    const { data } = res.json<{ data: { user: { roles: string[] } } }>();
    expect(data.user.roles).toContain('CLIENT');
  });
});

// ---------------------------------------------------------------------------

describe('journey 2 - a file is uploaded and comes back through a working URL', () => {
  it('round-trips a file through presigned URLs', async () => {
    const email = uniqueEmail('j2.upload');
    const mailbox = email.split('@')[0];
    await call('POST', '/auth', {
      body: {
        email,
        password: PASSWORD,
        firstName: 'Journey',
        lastName: 'Two',
        phone: '+237600000002',
      },
    });
    const token = await findTokenInMailbox(mailbox, /verify-email\?token=([0-9a-f]{64})/);
    await call('POST', '/auth/verify-email', { body: { token } });
    const user = await login(email);

    const content = `journey 2 upload ${new Date().toISOString()}`;

    const urlRes = await call('POST', '/users/me/id-document/upload-url', {
      token: user,
      body: { filename: 'journey.txt', contentType: 'text/plain' },
    });
    expect(urlRes.status).toBe(200);
    const { data } = urlRes.json<{ data: { uploadUrl: string; fileUrl: string } }>();

    // S1: this used to return an unsigned URL with HTTP 200, against a bucket
    // whose four public-access blocks are all true.
    expect(data.uploadUrl).toContain('X-Amz-Signature');

    const put = await fetch(data.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: content,
    });
    expect(put.status).toBe(200);

    const attach = await call('PATCH', '/users/me/id-document', {
      token: user,
      body: { idDocumentUrls: [data.fileUrl] },
    });
    expect(attach.status).toBe(200);

    const me = await call('GET', '/users/me', { token: user });
    const profile = me.json<{ data: { profile?: { idDocumentUrls?: string[] } } }>();
    expect(profile.data.profile?.idDocumentUrls ?? []).toContain(data.fileUrl);
  });
});

// ---------------------------------------------------------------------------

describe('journey 3 - a candidate trains, passes the exam, and is certified', () => {
  let candidateToken: string;
  let candidateId: string;

  it('enrols after submitting an identity document', async () => {
    const email = uniqueEmail('j3.kbs');
    const mailbox = email.split('@')[0];
    await call('POST', '/auth', {
      body: {
        email,
        password: PASSWORD,
        firstName: 'Journey',
        lastName: 'Three',
        phone: '+237600000003',
      },
    });
    const token = await findTokenInMailbox(mailbox, /verify-email\?token=([0-9a-f]{64})/);
    await call('POST', '/auth/verify-email', { body: { token } });
    candidateToken = await login(email);

    const url = await call('POST', '/users/me/id-document/upload-url', {
      token: candidateToken,
      body: { filename: 'cni.txt', contentType: 'text/plain' },
    });
    const { data } = url.json<{ data: { uploadUrl: string; fileUrl: string } }>();
    await fetch(data.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: 'id',
    });
    await call('PATCH', '/users/me/id-document', {
      token: candidateToken,
      body: { idDocumentUrls: [data.fileUrl] },
    });

    const enrol = await call('POST', '/kbs/enroll', {
      token: candidateToken,
      body: { engagementAccepted: true },
    });
    expect(enrol.status).toBe(201);
    candidateId = enrol.json<{ data: { id: string } }>().data.id;

    const promote = await call('PATCH', `/kbs/admin/candidates/${candidateId}/status`, {
      token: admin,
      body: { status: 'IN_TRAINING' },
    });
    expect(promote.status).toBe(200);
  });

  it('serves exactly ten quiz questions per module and scores them out of ten', async () => {
    for (const lesson of LESSONS) {
      await call('POST', `/kbs/lesson/${lesson}/complete`, { token: candidateToken, body: {} });
    }

    for (const moduleId of [MODULE_1, MODULE_2]) {
      const keyRes = await call('GET', `/kbs/admin/modules/${moduleId}/questions?limit=100`, {
        token: admin,
      });
      const key = new Map(
        keyRes
          .json<{
            data: Array<{ id: string; answers: Array<{ id: string; isCorrect: boolean }> }>;
          }>()
          .data.map((q) => [q.id, q.answers.filter((a) => a.isCorrect).map((a) => a.id)]),
      );

      const quizRes = await call('GET', `/kbs/modules/${moduleId}/quiz`, { token: candidateToken });
      expect(quizRes.status).toBe(200);
      // The quiz payload is `{ moduleId, moduleTitle, questions: [...] }`, not a
      // bare array. Reading `data` as the array is what the first version of
      // this spec did, and the assertion failure named the shape rather than a
      // product defect.
      const quiz = quizRes.json<{
        data: { questions: Array<{ id: string; answers: Array<{ id: string }> }> };
      }>().data.questions;

      // B3: the pool is 30 per module and the quiz is 10. A short pool used to
      // shrink the quiz silently.
      expect(quiz).toHaveLength(10);
      // The candidate must never be told which answer is right.
      expect(JSON.stringify(quiz)).not.toContain('isCorrect');

      const submit = await call('POST', `/kbs/modules/${moduleId}/quiz`, {
        token: candidateToken,
        body: { answers: quiz.map((q) => ({ questionId: q.id, answerIds: key.get(q.id) })) },
      });
      expect(submit.status).toBe(200);
      const result = submit.json<{
        data: { score: number; passed: boolean; totalQuestions: number };
      }>();

      // K1: this scored 10/30 = 33% and failed every candidate.
      expect(result.data.totalQuestions).toBe(10);
      expect(result.data.score).toBe(100);
      expect(result.data.passed).toBe(true);
    }
  });

  it('becomes eligible, sits a twenty-question exam, and passes', async () => {
    // K2: the transition needs kbsSettings.activeCourseId, which the seed sets.
    const eligibility = await call('GET', '/kbs/exam/eligibility', { token: candidateToken });
    expect(eligibility.json<{ data: { eligible: boolean } }>().data.eligible).toBe(true);

    const scheduled = await call('POST', '/kbs/exam/schedule', { token: candidateToken, body: {} });
    expect(scheduled.status).toBe(201);
    const examId = scheduled.json<{ data: { id: string } }>().data.id;

    const started = await call('POST', `/kbs/exam/${examId}/start`, {
      token: candidateToken,
      body: {},
    });
    // start is 200 (it mutates an existing exam); schedule is 201 (it creates one).
    expect(started.status).toBe(200);
    const exam = started.json<{
      data: { totalQuestions: number; questions: Array<{ id: string }> };
    }>().data;

    expect(exam.questions).toHaveLength(20);
    expect(exam.totalQuestions).toBe(20);

    const keyRes = await call('GET', '/kbs/admin/exam-questions?limit=200', { token: admin });
    const key = new Map(
      keyRes
        .json<{ data: Array<{ id: string; answers: Array<{ id: string; isCorrect: boolean }> }> }>()
        .data.map((q) => [q.id, q.answers.filter((a) => a.isCorrect).map((a) => a.id)]),
    );

    const submit = await call('POST', `/kbs/exam/${examId}/submit`, {
      token: candidateToken,
      body: {
        answers: exam.questions.map((q) => ({ questionId: q.id, answerIds: key.get(q.id) })),
      },
    });
    expect(submit.status).toBe(200);

    let graded: { status?: string; score?: number } = {};
    for (let i = 0; i < 30; i++) {
      const res = await call('GET', `/kbs/exam/${examId}/results`, { token: candidateToken });
      graded = res.json<{ data: { status?: string; score?: number } }>().data ?? {};
      if (graded.status === 'PASSED' || graded.status === 'FAILED') break;
      await new Promise((r) => setTimeout(r, 3000));
    }
    expect(graded.status).toBe('PASSED');
    expect(graded.score).toBe(100);
  });

  it('is EXAM_PASSED and holds no certificate until an admin issues one', async () => {
    // Q1: grading used to set CERTIFIED and grant KCA_CERTIFIED on the score
    // alone, which made somebody a KAMNET agent with no certificate and no human
    // in the loop.
    const overview = await call('GET', '/kbs/me/overview', { token: candidateToken });
    expect(overview.json<{ data: { candidate: { status: string } } }>().data.candidate.status).toBe(
      'EXAM_PASSED',
    );

    const none = await call('GET', '/kbs/certificate/me', { token: candidateToken });
    expect(none.json<{ data: unknown }>().data).toBeNull();

    const before = await call('GET', '/kbs/admin/certificates?page=1&limit=1', { token: admin });
    const total = before.json<{ meta: { total: number } }>().meta.total;

    const issued = await call('POST', `/kbs/admin/certificates/${candidateId}`, {
      token: admin,
      body: {},
    });
    expect(issued.status).toBe(201);
    const kca = issued.json<{ data: { kcaNumber: string } }>().data.kcaNumber;
    expect(kca).toMatch(/^KCA-/);

    const after = await call('GET', '/kbs/admin/certificates?page=1&limit=1', { token: admin });
    expect(after.json<{ meta: { total: number } }>().meta.total).toBe(total + 1);

    const now = await call('GET', '/kbs/me/overview', { token: candidateToken });
    expect(now.json<{ data: { candidate: { status: string } } }>().data.candidate.status).toBe(
      'CERTIFIED',
    );

    const verify = await call('GET', `/kbs/public/verify/${kca}`);
    expect(verify.status).toBe(200);
    expect(verify.json<{ data: { valid: boolean } }>().data.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('journey 4 - an agent reserves a parcel and the client reaches the portal', () => {
  it('creates a client who holds CLIENT and can open the portal', async () => {
    const listed = await call('GET', '/lands?limit=50', { token: agent });
    expect(listed.status).toBe(200);
    const lands = listed.json<{ data: Array<{ id: string; status: string }> }>().data;
    const available = lands.filter((l) => l.status === 'AVAILABLE');

    // The seed is restorative and carries margin; an empty pool here means the
    // fixtures were not restored, not that the API is broken.
    expect(available.length).toBeGreaterThan(0);

    const email = uniqueEmail('j4.portal');
    const mailbox = email.split('@')[0];

    const reserved = await call('POST', '/lands/reservations', {
      token: agent,
      body: {
        landId: available[0].id,
        clientName: 'Journey Four',
        clientEmail: email,
        clientPhone: '+237699887700',
      },
    });
    expect(reserved.status).toBe(201);
    const clientUserId = reserved.json<{ data: { clientUserId: string } }>().data.clientUserId;

    // R1: this user used to be created with no roles at all, because the lookup
    // asked for `code: 'client'` against a stored 'CLIENT'.
    const created = await call('GET', `/users/${clientUserId}`, { token: admin });
    expect(created.json<{ data: { roles: string[] } }>().data.roles).toContain('CLIENT');

    // The invite is not the only mail this flow sends; search the whole mailbox.
    const token = await findTokenInMailbox(mailbox, /set-password\?token=([0-9a-f]{64})/);
    const set = await call('POST', '/auth/reset-password', {
      body: { token, newPassword: PASSWORD },
    });
    expect(set.status).toBe(204);

    // R2: setting the password used to leave emailVerified false, so the client
    // could never log in and had no way to fix it.
    const client = await login(email);

    const portal = await call('GET', '/lands/client/purchases', { token: client });
    expect(portal.status).toBe(200);
    const purchases = portal.json<{ data: Array<{ landId: string }> }>().data;
    expect(purchases.length).toBeGreaterThan(0);
    expect(purchases[0].landId).toBe(available[0].id);

    /**
     * Give the parcel back.
     *
     * This suite runs on every deploy to dev and each run consumes one parcel.
     * The pool went 18 -> 15 in three runs before anybody noticed; at roughly one
     * deploy per change it empties inside a fortnight, and the next tester finds
     * an empty catalogue and reports a bug that is not there. **The seed being
     * restorative is not enough if nothing re-runs it**, and a test that depends
     * on somebody else tidying up is a test with a hidden prerequisite.
     *
     * Cancelling is also the assertion: the parcel must come back to AVAILABLE,
     * which is the restorative property proved through the API rather than
     * against the database.
     */
    const reservationId = reserved.json<{ data: { id: string } }>().data.id;
    const cancelled = await call('POST', `/lands/admin/reservations/${reservationId}/cancel`, {
      token: admin,
      body: { reason: 'automated journey cleanup - returning the fixture parcel' },
    });
    expect(cancelled.status).toBe(200);

    const after = await call('GET', '/lands?limit=50', { token: agent });
    const parcel = after
      .json<{ data: Array<{ id: string; status: string }> }>()
      .data.find((l) => l.id === available[0].id);
    expect(parcel?.status).toBe('AVAILABLE');
  });
});

// ---------------------------------------------------------------------------

/**
 * Journey 5 - an administrator activates through the ordinary flow.
 *
 * H3's claim is that there is **no parallel path for administrators**: a super
 * admin created without a password activates through `forgot-password` ->
 * `reset-password`, the same two public routes a client uses, and the same
 * transaction that sets the password is what marks the address verified.
 *
 * ---------------------------------------------------------------------------
 * Why this runs on a maildrop address and never on the two real accounts
 * ---------------------------------------------------------------------------
 * **The reset token is single-use.** `resetPassword` stamps `usedAt` and the
 * next attempt is refused. A test pointed at a real administrator's address
 * would request a link, consume it, and set a password only the test knows -
 * so the real holder, following the link they were sent, would be told their
 * token was already used, on an account they have never logged into. The suite
 * would have locked a person out of activating their own account and reported
 * a pass for doing it.
 *
 * That is not a hypothetical to be remembered; `refusesToRunAgainstARealAccount`
 * below makes it an assertion, because a rule that lives in a comment is one
 * copy-paste from being gone.
 *
 * ---------------------------------------------------------------------------
 * Why the account is created by a reservation
 * ---------------------------------------------------------------------------
 * It is the only path in the public API that produces the state the bootstrap
 * produces: `passwordHash` null, `emailVerified` false. Registering would give
 * the account a password, and an activation test that starts from a password
 * is not testing activation. The parcel is given back at the end, exactly as
 * journey 4 gives its own back - two journeys each consuming one parcel per
 * deploy is neutral only for as long as both of them cancel.
 *
 * The role is granted before activation and revoked after, and the revocation
 * is asserted rather than assumed: a throwaway account left holding
 * `ADMIN_GLOBAL` on dev is a stray privileged account, which is the thing this
 * whole block exists to avoid creating.
 */
describe('journey 5 - a passwordless super admin activates through the ordinary flow', () => {
  const email = uniqueEmail('j5.superadmin');
  const mailbox = email.split('@')[0];

  /**
   * Membership, not shape.
   *
   * The previous guard asked whether the address matched `/@maildrop\.cc$/`.
   * That is a question about a string, and it is the wrong question: a real
   * address can satisfy a pattern, and a pattern cannot tell an address this
   * run created from one somebody typed. `assertMinted` asks whether
   * `uniqueEmail()` produced it **in this process**, which nothing hand-written
   * can answer yes to.
   *
   * It is also a barrier rather than a detector. It runs in `beforeAll`, so a
   * throw means Jest executes no test body at all. The earlier version was an
   * `it()`: it failed exactly as designed, the remaining tests ran anyway
   * because Jest does not stop a `describe` at its first failure, and the run
   * reached `forgot-password` on a real account and then revoked its role.
   */
  beforeAll(() => assertMinted(email));

  let userId: string;
  let landId: string;
  let reservationId: string;

  it('refuses any address it did not mint itself', () => {
    // The barrier is the `beforeAll`; this proves what the barrier enforces.
    // Note the second case: a perfectly well-formed maildrop address is still
    // refused, because the point is provenance, not shape.
    expect(() => assertMinted('someone@kambriq.com')).toThrow(/was not generated by uniqueEmail/);
    expect(() => assertMinted('handwritten@maildrop.cc')).toThrow(
      /was not generated by uniqueEmail/,
    );
    expect(() => assertMinted(email)).not.toThrow();
  });

  it('is created with no password and cannot log in', async () => {
    const listed = await call('GET', '/lands?limit=50', { token: agent });
    expect(listed.status).toBe(200);
    const available = listed
      .json<{ data: Array<{ id: string; status: string }> }>()
      .data.filter((l) => l.status === 'AVAILABLE');
    expect(available.length).toBeGreaterThan(0);
    landId = available[0].id;

    const reserved = await call('POST', '/lands/reservations', {
      token: agent,
      body: {
        landId,
        clientName: 'Journey Five',
        clientEmail: email,
        clientPhone: '+237699887701',
      },
    });
    expect(reserved.status).toBe(201);
    userId = reserved.json<{ data: { clientUserId: string } }>().data.clientUserId;
    reservationId = reserved.json<{ data: { id: string } }>().data.id;

    // No password exists, so no password can be right. Any string must be
    // refused - a passwordless account that lets somebody in is the failure
    // this assertion is here for.
    const early = await call('POST', '/auth/login', {
      body: { email, password: 'not-the-password-because-there-is-none' },
    });
    expect(early.status).toBe(401);
  });

  it('is made a super admin before it has ever had a password', async () => {
    const granted = await call('POST', `/users/${userId}/roles`, {
      token: admin,
      body: { roleCode: 'ADMIN_GLOBAL' },
    });
    expect(granted.status).toBe(200);
    expect(granted.json<{ data: { roles: string[] } }>().data.roles).toContain('ADMIN_GLOBAL');

    // Holding the top role changes nothing about being unable to log in. If it
    // did, there would be a parallel path, which is exactly what H3 denies.
    const still = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
    expect(still.status).toBe(401);
  });

  it('activates through the two public routes, with the link read out of the mailbox', async () => {
    const requested = await call('POST', '/auth/forgot-password', { body: { email } });
    expect(requested.status).toBe(204);

    /**
     * Out of the mailbox, not out of the database.
     *
     * A3 is the reason this distinction is worth the third-party dependency: a
     * token read from the row it was written to proves the row. It proved the
     * row for months while every delivered link carried
     * `?token=[object Promise]`. **A send is not a signup.**
     */
    /**
     * `/reset-password`, and deliberately NOT `/auth/set-password`.
     *
     * By this point the mailbox holds **two** valid PASSWORD_RESET tokens for
     * this user: the reservation invite sent
     * `${FRONTEND_URL}/auth/set-password?token=` when the account was created,
     * and forgot-password has just sent `${FRONTEND_URL}/reset-password?token=`.
     * Both work. A pattern matching either would activate the account and leave
     * the journey unable to say which of the two paths it proved - two
     * candidate explanations producing identical output, which is not a choice
     * between them.
     *
     * H3 is about the forgot-password path, so only that link counts.
     */
    const token = await findTokenInMailbox(mailbox, /\/reset-password\?token=([0-9a-f]{64})/);
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const reset = await call('POST', '/auth/reset-password', {
      body: { token, newPassword: PASSWORD },
    });
    expect(reset.status).toBe(204);

    // Single-use, and this is where that is proved rather than asserted about.
    // It is also why this journey may never point at a real administrator.
    const replay = await call('POST', '/auth/reset-password', {
      body: { token, newPassword: PASSWORD },
    });
    expect(replay.status).toBe(400);
  });

  it('reaches a 200 login carrying ADMIN_GLOBAL, and an admin-only route answers', async () => {
    const res = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
    expect(res.status).toBe(200);

    const { data } = res.json<{
      data: { user: { roles: string[] }; tokens: { accessToken: string } };
    }>();
    expect(data.user.roles).toContain('ADMIN_GLOBAL');
    expect(data.tokens.accessToken).toBeTruthy();

    /**
     * The token is the proof, not the login.
     *
     * A 200 with a role in the response body says the API believes it. Spending
     * the token on a route only `ADMIN_GLOBAL` may open says the guard believes
     * it too, and those have been different things here before.
     *
     * `/users/roles` rather than `/users`: the admin user list is known to
     * serialise every row to `{}` while answering 200 with a correct
     * `meta.total`, so it would pass a status check and prove nothing about
     * content. Recorded in the register; do not "fix" this by pointing the
     * assertion at the endpoint with the defect.
     */
    const roles = await call('GET', '/users/roles', { token: data.tokens.accessToken });
    expect(roles.status).toBe(200);
    expect(roles.json<{ data: Array<{ code: string }> }>().data.map((r) => r.code)).toContain(
      'ADMIN_GLOBAL',
    );
  });

  /**
   * Leave nothing behind: no privilege, no held parcel.
   *
   * `afterAll` runs even when a test above fails, which is when cleanup matters
   * most - and that is exactly what makes it dangerous. **A cleanup is a write
   * like any other and inherits none of the caution of the test body.** This one
   * revoked a real administrator's role, and it did so while every line of it
   * read as tidiness: a `DELETE` on `userId`, a variable set earlier in the same
   * run.
   *
   * The variable was the problem. `POST /lands/reservations` returns
   * `clientUserId`, and for an address that **already exists** that is the
   * existing person's id, not a new one - so `userId` was a real account's id
   * and nothing in the cleanup could tell.
   *
   * So the id is proved against the database before anything is deleted:
   * `assertOwnedByThisRun` reads the row back and requires its email to be the
   * address this run minted. It throws before the first write rather than
   * reporting after it.
   */
  afterAll(async () => {
    if (userId) {
      // Throws if this row is not ours. Nothing below runs.
      await assertOwnedByThisRun(userId, email, admin);

      const revoked = await call('DELETE', `/users/${userId}/roles/ADMIN_GLOBAL`, { token: admin });
      // Asserted, not fired and forgotten. A 409 here would mean this throwaway
      // account had become the last super admin on the environment, which is a
      // finding rather than a cleanup failure.
      expect(revoked.status).toBe(200);
      expect(revoked.json<{ data: { roles: string[] } }>().data.roles).not.toContain(
        'ADMIN_GLOBAL',
      );
    }

    if (reservationId) {
      // Same proof before the second write. The reservation the mis-aimed run
      // created was cancelled rather than deleted, so a real person's account
      // still carries a CANCELLED row a test put there.
      await assertOwnedByThisRun(userId, email, admin);

      const cancelled = await call('POST', `/lands/admin/reservations/${reservationId}/cancel`, {
        token: admin,
        body: { reason: 'automated journey cleanup - returning the fixture parcel' },
      });
      expect(cancelled.status).toBe(200);

      const after = await call('GET', '/lands?limit=50', { token: agent });
      const parcel = after
        .json<{ data: Array<{ id: string; status: string }> }>()
        .data.find((l) => l.id === landId);
      expect(parcel?.status).toBe('AVAILABLE');
    }
  });
});

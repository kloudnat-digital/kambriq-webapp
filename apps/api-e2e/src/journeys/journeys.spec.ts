import { API, call, findTokenInMailbox, login, uniqueEmail } from './support';

/**
 * The four journeys the delivery is defined by, run against a deployed API.
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

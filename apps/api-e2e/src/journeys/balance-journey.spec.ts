import { call, exactMoney, findTokenInMailbox, login, uniqueEmail, sessionFor } from './support';

/**
 * G1 / G8 / G20 end to end on a deployed environment: one reservation, from a
 * validated deposit through to a validated balance, every step through the API
 * a person would use - the client asks, the back office sends instructions,
 * records a receipt with its proof, and validates.
 *
 * **Opt-in** (`RUN_BALANCE_JOURNEY=1`), not part of every deploy's run: it
 * consumes a parcel and leaves two validated payments behind, on purpose - the
 * back office then holds a deposit and a balance side by side, which is the
 * screen #225 could not be read on. Run by hand, once, when that is wanted.
 */
const PASSWORD = 'Test1234!';
const run = process.env['RUN_BALANCE_JOURNEY'] === '1' ? describe : describe.skip;

jest.setTimeout(600_000);

type Payment = { id: string; amountDue: string };

const put = async (url: string, contentType: string, body: string) => {
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body });
  expect(res.status).toBe(200);
};

run('journey 7 - a reservation from a validated deposit to a validated balance', () => {
  let admin: string;
  let agent: string;
  let client: string;
  let clientUserId: string;
  let reservationId: string;
  let totalPrice: number;
  let deposit: Payment;
  let balance: Payment;

  /** The back office's six steps, INITIE to VALIDE, on one payment. */
  const settle = async (p: Payment, label: string) => {
    const step = async (path: string, body: Record<string, unknown>, status = 200) => {
      const res = await call('POST', `/lands/admin/payments/${p.id}${path}`, {
        token: admin,
        body,
      });
      if (res.status !== status) throw new Error(`${label} ${path}: ${res.status} ${res.body}`);
      return res;
    };
    await step('/send-instructions', { channel: 'VIR', reason: `journey 7: ${label} by transfer` });
    await step('/transition', {
      to: 'ANNONCE_CLIENT',
      reason: `journey 7: client announced the ${label}`,
    });
    await step('/transition', {
      to: 'EN_VERIFICATION',
      reason: `journey 7: ${label} under verification`,
    });

    const upload = await step('/proof-upload-url', {
      fileName: `${label}-receipt.pdf`,
      contentType: 'application/pdf',
    });
    const { uploadUrl, key } = upload.json<{ data: { uploadUrl: string; key: string } }>().data;
    await put(uploadUrl, 'application/pdf', `%PDF-1.4 journey 7 ${label} receipt`);

    const receipt = await step(
      '/receipts',
      {
        amount: p.amountDue,
        currency: 'XAF',
        channel: 'VIR',
        receivedAt: new Date().toISOString(),
        evidenceUrl: key,
        note: `journey 7: the whole ${label}`,
      },
      201,
    );
    const receiptId = receipt.json<{ data: { id: string } }>().data.id;
    await step('/transition', {
      to: 'PARTIELLEMENT_RECU',
      reason: `journey 7: ${label} received`,
      evidenceReceiptId: receiptId,
    });
    await step('/validate', {
      reason: `journey 7: ${label} settled`,
      evidenceReceiptId: receiptId,
    });

    const read = await call('GET', `/lands/admin/payments/${p.id}`, { token: admin });
    const detail = read.json<{ data: { state: string; outstanding: string; purpose: string } }>()
      .data;
    expect(detail).toMatchObject({ state: 'VALIDE', outstanding: '0' });
    return detail;
  };

  /** The client's request answers id, reference and amount; the purpose is the back office's to show. */
  const purposeOf = async (p: Payment) =>
    (await call('GET', `/lands/admin/payments/${p.id}`, { token: admin })).json<{
      data: { purpose: string };
    }>().data.purpose;

  beforeAll(async () => {
    admin = await sessionFor('admin@kambriq.com');
    agent = await sessionFor('eric.mbou@kambriq.com');
  });

  it('reserves a parcel for a new client, who signs in', async () => {
    const listed = await call('GET', '/lands?limit=50', { token: agent });
    const lands = listed.json<{
      data: Array<{ id: string; status: string; totalPrice: number; remainingM2: number }>;
    }>().data;
    const land = lands.find((l) => l.status === 'AVAILABLE');
    if (!land) throw new Error('No AVAILABLE parcel on dev: the seed pool is empty.');
    totalPrice = land.totalPrice;

    const email = uniqueEmail('j7.balance');
    const reserved = await call('POST', '/lands/reservations', {
      token: agent,
      body: {
        landId: land.id,
        purchasedM2: land.remainingM2,
        clientName: 'Journey Seven',
        clientEmail: email,
        clientPhone: '+237699887707',
      },
    });
    expect(reserved.status).toBe(201);
    ({ id: reservationId, clientUserId } = reserved.json<{
      data: { id: string; clientUserId: string };
    }>().data);

    const token = await findTokenInMailbox(
      email.split('@')[0],
      /\/reset-password\?token=([0-9a-f]{64})/,
      undefined,
      /Définissez votre mot de passe|Set your password/,
    );
    await call('POST', '/auth/reset-password', { body: { token, newPassword: PASSWORD } });
    client = await login(email);
  });

  it('has its identity verified, which sending instructions requires', async () => {
    const url = await call('POST', '/users/me/id-document/upload-url', {
      token: client,
      body: { filename: 'cni.txt', contentType: 'text/plain' },
    });
    const { uploadUrl, fileUrl } = url.json<{ data: { uploadUrl: string; fileUrl: string } }>()
      .data;
    await put(uploadUrl, 'text/plain', 'journey 7 identity');
    await call('PATCH', '/users/me/id-document', {
      token: client,
      body: { idDocumentUrls: [fileUrl] },
    });

    const review = await call('PATCH', `/users/${clientUserId}/id-document/review`, {
      token: admin,
      body: { status: 'verified' },
    });
    expect(review.status).toBe(200);
  });

  it('settles the deposit, and the reservation is confirmed on it', async () => {
    const asked = await call('POST', `/lands/client/purchases/${reservationId}/payment`, {
      token: client,
    });
    expect(asked.status).toBe(201);
    deposit = asked.json<{ data: Payment }>().data;
    expect(await purposeOf(deposit)).toBe('ACOMPTE');

    await settle(deposit, 'deposit');
    const confirmed = await call('POST', `/lands/admin/reservations/${reservationId}/confirm`, {
      token: admin,
    });
    expect(confirmed.status).toBeLessThan(300);
  });

  it('receives the client documents', async () => {
    for (const type of ['ID_CARD', 'PROOF_OF_ADDRESS']) {
      const url = await call(
        'POST',
        `/lands/client/purchases/${reservationId}/documents/upload-url`,
        {
          token: client,
          body: { type, filename: `${type}.pdf`, contentType: 'application/pdf' },
        },
      );
      const { uploadUrl, fileUrl } = url.json<{ data: { uploadUrl: string; fileUrl: string } }>()
        .data;
      await put(uploadUrl, 'application/pdf', `%PDF-1.4 journey 7 ${type}`);
      const registered = await call('POST', `/lands/client/purchases/${reservationId}/documents`, {
        token: client,
        body: { type, url: fileUrl, name: `${type}.pdf` },
      });
      expect(registered.status).toBeLessThan(300);
    }
    const received = await call(
      'POST',
      `/lands/admin/reservations/${reservationId}/documents-received`,
      {
        token: admin,
      },
    );
    expect(received.status).toBeLessThan(300);
  });

  it('settles the balance: the total minus what the deposit received', async () => {
    const asked = await call('POST', `/lands/client/purchases/${reservationId}/payment`, {
      token: client,
    });
    expect(asked.status).toBe(201);
    balance = asked.json<{ data: Payment }>().data;
    expect(await purposeOf(balance)).toBe('SOLDE');
    expect(BigInt(balance.amountDue) + BigInt(deposit.amountDue)).toBe(BigInt(totalPrice));

    await settle(balance, 'balance');
    const confirmed = await call(
      'POST',
      `/lands/admin/reservations/${reservationId}/payment-confirmed`,
      {
        token: admin,
      },
    );
    expect(confirmed.status).toBeLessThan(300);
  });

  it('leaves nothing owed, and the back office holds both, side by side', async () => {
    const detail = await call('GET', `/lands/client/purchases/${reservationId}`, { token: client });
    const money = detail.json<{ data: { money: { balanceOwed: unknown } } }>().data.money;
    expect(exactMoney(money.balanceOwed)).toBe(true);
    expect(money.balanceOwed).toBe(0);

    const list = await call('GET', '/lands/admin/payments?limit=100', { token: admin });
    const mine = list
      .json<{ data: Array<{ reservationId: string; purpose: string; state: string }> }>()
      .data.filter((p) => p.reservationId === reservationId);
    expect(mine.map((p) => `${p.purpose}:${p.state}`).sort()).toEqual([
      'ACOMPTE:VALIDE',
      'SOLDE:VALIDE',
    ]);
    console.log(
      `journey 7: reservation ${reservationId}, deposit ${deposit.id}, balance ${balance.id}`,
    );
  });
});

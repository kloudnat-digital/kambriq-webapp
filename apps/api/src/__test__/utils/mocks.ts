/**
 * Shared mock factories for unit tests.
 *
 * Usage:
 *   const prisma = mockCorePrisma();
 *   const i18n   = mockI18n();
 */

import { jest } from '@jest/globals';

/** Mock for async Prisma methods - allows mockResolvedValue with any value in tests. */
const fn = () => jest.fn<(...args: unknown[]) => Promise<unknown>>();

// ----- Core Prisma ----- //

export const mockCorePrisma = () => ({
  user: {
    findUnique: fn(),
    findMany: fn(),
    create: fn(),
    update: fn(),
    count: fn(),
    delete: fn(),
  },
  role: {
    findUnique: fn(),
    findMany: fn(),
  },
  userRole: {
    findUnique: fn(),
    findMany: fn(),
    create: fn(),
    createMany: fn(),
    deleteMany: fn(),
    count: fn(),
  },
  userProfile: {
    findUnique: fn(),
    findFirst: fn(),
    findMany: fn(),
    count: fn(),
    upsert: fn(),
    update: fn(),
    updateMany: fn(),
  },
  refreshToken: {
    findFirst: fn(),
    create: fn(),
    update: fn(),
    updateMany: fn(),
  },
  verificationToken: {
    findUnique: fn(),
    create: fn(),
    update: fn(),
    updateMany: fn(),
  },
  /** L1 - the inbound contact request. */
  contactRequest: {
    create: fn(),
    findUnique: fn(),
    findFirst: fn(),
    findMany: fn(),
    count: fn(),
    update: fn(),
  },
  $transaction: jest.fn((args: Promise<unknown>[] | ((client: unknown) => Promise<unknown>)) =>
    Array.isArray(args) ? Promise.all(args) : args(mockCorePrisma()),
  ),
  $connect: fn(),
  $disconnect: fn(),
  $queryRawUnsafe: fn(),
});

export type MockCorePrisma = ReturnType<typeof mockCorePrisma>;

// ----- KBS Prisma ------ //

export const mockKbsPrisma = () => ({
  kbsCandidate: {
    findUnique: fn(),
    findMany: fn(),
    create: fn(),
    // `updateMany` is how the EXAM_PENDING transition is written. It was absent
    // here, and no test noticed - because `checkAndTransitionToExamPending`
    // read a null `activeCourseId` from these same mocks and returned before
    // reaching it. The defect was shielding the gap in its own coverage.
    updateMany: fn(),
    update: fn(),
    count: fn(),
  },
  kbsCandidateProgress: {
    findUnique: fn(),
    findFirst: fn(),
    findMany: fn(),
    upsert: fn(),
    count: fn(),
  },
  kbsCourse: {
    findUnique: fn(),
    findMany: fn(),
    create: fn(),
    update: fn(),
    delete: fn(),
  },
  kbsModule: {
    findUnique: fn(),
    findMany: fn(),
    create: fn(),
    update: fn(),
    delete: fn(),
    count: fn(),
  },
  kbsLesson: {
    findUnique: fn(),
    findMany: fn(),
    create: fn(),
    update: fn(),
    delete: fn(),
  },
  kbsQuestion: {
    findUnique: fn(),
    findMany: fn(),
    create: fn(),
    update: fn(),
    delete: fn(),
  },
  kbsAnswer: {
    deleteMany: fn(),
  },
  kbsExam: {
    findUnique: fn(),
    findFirst: fn(),
    findMany: fn(),
    create: fn(),
    update: fn(),
    count: fn(),
  },
  kbsExamQuestion: {
    findUnique: fn(),
    findMany: fn(),
    create: fn(),
    update: fn(),
    delete: fn(),
    count: fn(),
  },
  kbsExamQuestionAnswer: {
    deleteMany: fn(),
  },
  kbsExamAnswer: {
    findUnique: fn(),
    upsert: fn(),
    update: fn(),
  },
  kbsExamAnswerSelection: {
    deleteMany: fn(),
    createMany: fn(),
    update: fn(),
  },
  kbsCertificate: {
    findUnique: fn(),
    findFirst: fn(),
    findMany: fn(),
    create: fn(),
    update: fn(),
    count: fn(),
  },
  kbsSettings: {
    findFirst: fn(),
  },
  $transaction: jest.fn((args: Promise<unknown>[] | ((client: unknown) => Promise<unknown>)) =>
    Array.isArray(args) ? Promise.all(args) : args(mockKbsPrisma()),
  ),
});

export type MockKbsPrisma = ReturnType<typeof mockKbsPrisma>;

// ----- I18nService ------ //

// ----- Lands Prisma (G1 payments) ----- //

/**
 * Deliberately narrow: only what `PaymentsService` touches.
 *
 * `payment` has no `totalReceived` field to mock, because the model has no such
 * column. That absence is the point of G1's ledger, and a mock that invented
 * one would let a test pass against a shape the database cannot hold.
 */
/**
 * Payment channel details, as the real service returns them.
 *
 * Complete on purpose: the real `PaymentChannelsService` throws rather than
 * returning a set with a blank in it, so a mock that could return one would let
 * a test pass against a state the service cannot produce.
 */
export const mockPaymentChannels = () => ({
  get: jest.fn(() =>
    Promise.resolve({
      bankName: 'Test Bank',
      bankAccountName: 'KAMBRIQ SA',
      bankIban: 'CM21 0000 0000 0000 0000 0000 000',
      bankSwift: 'TESTCMCX',
      notaryName: 'Maitre Test',
      notaryPhone: '+237600000001',
      notaryAddress: '1 rue de Test, Douala',
      supportEmail: 'support@example.test',
      supportPhone: '+237600000002',
    }),
  ),
  detailsFor: jest.fn((channel: string) =>
    Promise.resolve(
      // Only the chosen channel's fields, which is the whole point of the real
      // method. A mock that returned everything would let a template leak
      // coordinates and still pass.
      (
        {
          VIR: {
            bankName: 'Test Bank',
            bankAccountName: 'KAMBRIQ SA',
            bankIban: 'CM21 0000 0000 0000 0000 0000 000',
            bankSwift: 'TESTCMCX',
          },
          DEPO: {
            bankName: 'Test Bank',
            bankAccountName: 'KAMBRIQ SA',
            bankIban: 'CM21 0000 0000 0000 0000 0000 000',
          },
          OMO: { orangeMoneyNumber: '+237690000000', orangeMoneyName: 'KAMBRIQ OM' },
          MOMO: { mtnMoneyNumber: '+237670000000', mtnMoneyName: 'KAMBRIQ MTN' },
          ESP: { supportPhone: '+237600000001', supportEmail: 'contact@kambriq.com' },
          NOTA: {
            notaryName: 'Maitre Test',
            notaryPhone: '+237600000002',
            notaryAddress: 'Douala',
          },
        } as Record<string, Record<string, string>>
      )[channel] ?? {},
    ),
  ),
});

export const mockLandsPrisma = () => {
  const client = {
    payment: {
      findUnique: fn(),
      findFirst: fn(),
      findMany: fn(),
      count: fn(),
      create: fn(),
      update: fn(),
    },
    paymentReceipt: {
      create: fn(),
      findMany: fn(),
      /** G7: the receipt a transition names is read back to check it is this payment's. */
      findUnique: fn(),
    },
    paymentTransition: {
      create: fn(),
      findMany: fn(),
    },
    /** G6 - the append-only record that a reminder was sent. */
    paymentReminder: {
      create: fn(),
      findMany: fn(),
      count: fn(),
    },
    landReservation: {
      findUnique: fn(),
      findMany: fn(),
    },
    /**
     * Both call shapes, because the service uses both.
     *
     * The array form batches independent writes; the **callback** form is what
     * G9's creation needs, because the audit row's `paymentId` is only known
     * once the payment row exists. A mock that understood only the array form
     * made every spec in four files fail at once with a shape error, which says
     * nothing about the code under test.
     *
     * The callback is handed `client` itself, so a write inside the transaction
     * lands on the same spy a test asserts against.
     */
    $transaction: jest.fn(
      (arg: unknown): Promise<unknown> =>
        typeof arg === 'function'
          ? Promise.resolve((arg as (tx: unknown) => unknown)(client))
          : Promise.all(arg as Promise<unknown>[]),
    ),
    $queryRaw: fn(),
  };
  return client;
};

export type MockLandsPrisma = ReturnType<typeof mockLandsPrisma>;

export const mockI18n = () => ({
  translate: jest.fn((key: string) => key),
});

// ----- EmailService ------ //

/**
 * The payload shape both send paths take. Declared so a test can read
 * `send.mock.calls[0][0].args` - with `jest.fn(() => ...)` the mock is typed as
 * taking no arguments, and asserting on what was sent becomes a type error
 * rather than an assertion.
 */
type EmailCall = { to: string; template: string; lang: string; args: Record<string, string> };

export const mockEmailService = () => ({
  // Declared by signature rather than by an implementation with unused
  // parameters: the repo lints at --max-warnings=0 and has no
  // argsIgnorePattern, so `_payload` would block the commit.
  send: jest.fn<(payload: EmailCall) => Promise<undefined>>(),
  sendBatch: jest.fn(() => Promise.resolve(undefined)),
  // Returns an outcome, like the real one. A mock that returns `undefined`
  // where the service returns a value lets a test pass against a signature the
  // code no longer has - which is the A11 defect, reproduced in the fixture.
  sendUpdate: jest
    .fn<(payload: EmailCall, prefs?: unknown) => Promise<{ status: 'queued' }>>()
    .mockResolvedValue({ status: 'queued' as const }),
});

// ----- JwtService ------ //

export const mockJwtService = () => ({
  sign: jest.fn(() => 'jwt-access-token'),
  verify: jest.fn(() => ({ sub: 'user-1', email: 'test@test.com' })),
});

// ----- ConfigService ------ //

export const mockConfigService = () => ({
  get: jest.fn((key: string, fallback?: unknown) => {
    const map: Record<string, unknown> = {
      JWT_SECRET: 'test-secret-key',
      JWT_ACCESS_EXPIRATION: '15m',
      JWT_REFRESH_EXPIRATION: '15d',
      FRONTEND_URL: 'http://localhost:3001',
      NODE_ENV: 'test',
    };
    return map[key] ?? fallback;
  }),
});

// ----- BullMQ Queue ------ //

export const mockQueue = () => ({
  add: jest.fn(() => Promise.resolve({ id: 'job-1' })),
  addBulk: jest.fn(() => Promise.resolve([])),
});

// ----- StorageService ------ //

export const mockStorageService = () => ({
  getUploadUrl: jest.fn(() =>
    Promise.resolve({
      uploadUrl: 'https://s3.example.com/upload',
      fileUrl: 'https://s3.example.com/file',
    }),
  ),
  getDownloadUrl: jest.fn(() => Promise.resolve('https://s3.example.com/download')),
  buildKey: jest.fn((...parts: string[]) => parts.join('/')),
});

// ----- Reflector (for guards) ------ //

export const mockReflector = () => ({
  getAllAndOverride: jest.fn(),
});

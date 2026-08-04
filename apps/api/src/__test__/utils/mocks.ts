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
    upsert: fn(),
    update: fn(),
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

export const mockI18n = () => ({
  translate: jest.fn((key: string) => key),
});

// ----- EmailService ------ //

export const mockEmailService = () => ({
  send: jest.fn(() => Promise.resolve(undefined)),
  sendBatch: jest.fn(() => Promise.resolve(undefined)),
  sendUpdate: jest.fn(() => Promise.resolve(undefined)),
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

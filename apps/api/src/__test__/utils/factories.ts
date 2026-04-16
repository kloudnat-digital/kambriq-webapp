/**
 * Test data factories - build realistic entity stubs
 *
 * Usage:
 *  const user = buildUser({ name: 'Alice', ... });
 * const candidate = buildCandidate({ status: 'CERTIFIED', ... });
 */

let userIdCounter = 1;
const id = () => `uuid-${userIdCounter++}`;

// ----- Core Entities ----- //

export const buildUser = (overrides: Record<string, unknown> = {}) => ({
  id: id(),
  email: `user-${userIdCounter}@kambriq.com`,
  passwordHash: '$2b$10$hashdpassword',
  firstName: 'John',
  lastName: 'Doe',
  phone: '+237600000000',
  isActive: true,
  emailVerified: false,
  preferredLanguage: 'fr',
  pendingEmail: null,
  loginAttempts: 0,
  lockedUntil: null,
  deletedAt: null,
  deactivatedBy: null,
  lastLoginAt: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  userRoles: [],
  profile: null,
  ...overrides,
});

export const buildRole = (code = 'CLIENT', overrides: Record<string, unknown> = {}) => ({
  id: id(),
  code,
  name: code.toLowerCase().replace(/_/g, ' '),
  description: `${code} role`,
  createdAt: new Date('2025-01-01'),
  ...overrides,
});

export const buildUserWithRoles = (
  roleCodes: string[] = ['CLIENT'],
  overrides: Record<string, unknown> = {},
) => {
  const user = buildUser(overrides);
  (user as Record<string, unknown>).userRoles = roleCodes.map((code) => ({
    id: id(),
    userId: user.id,
    roleId: id(),
    grantedBy: null,
    createdAt: new Date('2025-01-01'),
    role: { code, name: code.toLowerCase() },
  }));
  return user;
};

export const buildVerificationToken = (overrides: Record<string, unknown> = {}) => ({
  id: id(),
  userId: id(),
  token: 'abc123def456',
  type: 'EMAIL_VERIFICATION',
  expiresAt: new Date(Date.now() + 86_400_000), // +24h
  usedAt: null,
  createdAt: new Date('2025-01-01'),
  user: { preferredLanguage: 'fr' },
  ...overrides,
});

export const buildRefreshToken = (overrides: Record<string, unknown> = {}) => ({
  id: id(),
  userId: id(),
  token: 'hashed-refresh-token',
  expiresAt: new Date(Date.now() + 15 * 86_400_000), // +15d
  revokedAt: null,
  createdAt: new Date('2025-01-01'),
  user: buildUserWithRoles(),
  ...overrides,
});

// ----- Core Entities ----- //

export const buildCandidate = (overrides: Record<string, unknown> = {}) => ({
  id: id(),
  userId: id(),
  sponsorCode: null,
  status: 'CANDIDATE',
  maxAttempts: 3,
  retakeCooldownDays: 7,
  currentCycle: 1,
  enrolledAt: new Date('2025-01-15'),
  certifiedAt: null,
  createdAt: new Date('2025-01-15'),
  updatedAt: new Date('2025-01-15'),
  progress: [],
  certificate: null,
  exams: [],
  ...overrides,
});

export const buildCourse = (overrides: Record<string, unknown> = {}) => ({
  id: id(),
  title: 'Introduction to Land',
  description: 'Learn the basics',
  isPublished: true,
  duration: 120,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  modules: [],
  ...overrides,
});

export const buildModule = (overrides: Record<string, unknown> = {}) => ({
  id: id(),
  courseId: id(),
  title: 'Module 1 - Foundations',
  description: 'Foundation concepts',
  order: 1,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  ...overrides,
});

export const buildLesson = (overrides: Record<string, unknown> = {}) => ({
  id: id(),
  moduleId: id(),
  title: 'Lesson 1',
  contentType: 'VIDEO',
  contentUrl: 'kbs/content/lesson-1.mp4',
  duration: 30,
  order: 1,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  ...overrides,
});

export const buildQuestion = (overrides: Record<string, unknown> = {}) => ({
  id: id(),
  moduleId: id(),
  text: 'What is a TFL?',
  type: 'SINGLE',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  answers: [
    { id: id(), text: 'Titled Freehold Land', isCorrect: true },
    { id: id(), text: 'Total Flat Lease', isCorrect: false },
  ],
  ...overrides,
});

export const buildExam = (overrides: Record<string, unknown> = {}) => ({
  id: id(),
  candidateId: id(),
  cycle: 1,
  attemptNumber: 1,
  passingScore: 75,
  totalQuestions: 20,
  score: null,
  status: 'SCHEDULED',
  durationMinutes: 90,
  scheduledAt: new Date(),
  startedAt: null,
  submittedAt: null,
  cancelReason: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  examAnswers: [],
  ...overrides,
});

export const buildCertificate = (overrides: Record<string, unknown> = {}) => ({
  id: id(),
  candidateId: id(),
  kcaNumber: 'KCA-20250601-AB12',
  issueDate: new Date('2025-06-01'),
  validUntil: new Date('2027-06-01'),
  pdfUrl: null,
  issuedBy: id(),
  revokedAt: null,
  revokedBy: null,
  revokeReason: null,
  createdAt: new Date('2025-06-01'),
  ...overrides,
});

// ----- User Response Shape (UsersService.toUserResponse) ----- //

export const buildUserResponse = (overrides: Record<string, unknown> = {}) => ({
  id: id(),
  email: `user-${userIdCounter}@kambriq.com`,
  firstName: 'John',
  lastName: 'Doe',
  phone: '+237600000000',
  isActive: true,
  emailVerified: false,
  language: 'fr',
  roles: ['CLIENT'],
  createdAt: '2025-01-01T00:00:00.000Z',
  lastLoginAt: null,
  profile: null,
  ...overrides,
});

// ----- Request user (from JWT) ----- //

export const buildRequestUser = (overrides: Record<string, unknown> = {}) => ({
  id: id(),
  email: `user-${userIdCounter}@kambriq.com`,
  roles: ['CLIENT'],
  lang: 'fr',
  ...overrides,
});

// ----- Reset counter (call in beforeEach for deterministic IDs) ----- //

export const resetIdCounter = () => {
  userIdCounter = 0;
};

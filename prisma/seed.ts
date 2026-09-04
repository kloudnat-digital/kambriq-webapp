import {
  MODULE_1_QUIZ,
  MODULE_2_QUIZ,
  MODULE_1_EXAM,
  MODULE_2_EXAM,
  orderAnswers,
  type SeedQuestion,
} from './seed-data/kbs-questions';
/**
 * Kambriq - Database seed script
 *
 * Run via:  npm run db:seed
 * Or:       npx prisma db seed
 *
 * Idempotent - safe to re-run. All entities use hardcoded UUIDs so
 * re-running upserts existing rows instead of creating duplicates.
 *
 * Seeded accounts (password: Test1234! for all):
 *   admin@kambriq.com         ADMIN_GLOBAL
 *   jean.kbs@kambriq.com      ADMIN_KBS
 *   claude.kamnet@kambriq.com ADMIN_KAMNET
 *   pierre.lands@kambriq.com  ADMIN_LANDS
 *   eric.mbou@kambriq.com     AGENT  (AGT-2025-0001, sponsor of others)
 *   sylvie.ngo@kambriq.com    AGENT  (AGT-2025-0002, N1 under Eric)
 *   boris.tcha@kambriq.com    AGENT  (AGT-2025-0003, N1 under Eric)
 *   amina.fall@kambriq.com    AGENT  (AGT-2025-0004, N2 under Sylvie)
 *   paul.fouda@kambriq.com    AGENT  (AGT-2025-0005, N1 under Eric)
 */

/* eslint-disable @nx/enforce-module-boundaries */
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient as CoreClient } from '../libs/common/src/prisma/core-client/client';
import { PrismaClient as KbsClient } from '../libs/common/src/prisma/kbs-client/client';
import {
  PrismaClient as KamnetClient,
  KamnetAgentTier,
  KamnetLeadSource,
  KamnetLeadStatus,
  KamnetCommissionStatus,
} from '../libs/common/src/prisma/kamnet-client/client';
import {
  PrismaClient as LandsClient,
  LandLabelCodes,
  LandStatus,
  LandOwnerType,
  LandReservationStatus,
} from '../libs/common/src/prisma/lands-client/client';
import { RoleCode } from '../libs/common/src/types/roles.enum';
import * as bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// Hardcoded IDs - allows cross-DB references and idempotent re-runs
// ---------------------------------------------------------------------------

const IDS = {
  // Roles (Core)
  ROLE_ADMIN_GLOBAL: '00000000-0000-4000-8000-a00000000001',
  ROLE_CLIENT: '00000000-0000-4000-8000-a00000000002',
  ROLE_CANDIDATE_KBS: '00000000-0000-4000-8000-a00000000003',
  ROLE_KCA_CERTIFIED: '00000000-0000-4000-8000-a00000000004',
  ROLE_AGENT: '00000000-0000-4000-8000-a00000000005',
  ROLE_ADMIN_KBS: '00000000-0000-4000-8000-a00000000006',
  ROLE_ADMIN_KAMNET: '00000000-0000-4000-8000-a00000000007',
  ROLE_ADMIN_LANDS: '00000000-0000-4000-8000-a00000000008',

  // Users (Core)
  USER_ADMIN_GLOBAL: '00000000-0000-4000-8000-b00000000001',
  USER_ADMIN_KBS: '00000000-0000-4000-8000-b00000000002',
  USER_ADMIN_KAMNET: '00000000-0000-4000-8000-b00000000003',
  USER_ADMIN_LANDS: '00000000-0000-4000-8000-b00000000004',
  USER_ERIC: '00000000-0000-4000-8000-b00000000005',
  USER_SYLVIE: '00000000-0000-4000-8000-b00000000006',
  USER_BORIS: '00000000-0000-4000-8000-b00000000007',
  USER_AMINA: '00000000-0000-4000-8000-b00000000008',
  USER_PAUL: '00000000-0000-4000-8000-b00000000009',

  // KBS
  KBS_COURSE: '00000000-0000-4000-8000-c00000000001',
  KBS_MODULE_1: '00000000-0000-4000-8000-c00000000002',
  KBS_MODULE_2: '00000000-0000-4000-8000-c00000000003',
  KBS_CAND_ERIC: '00000000-0000-4000-8000-c00000000011',
  KBS_CAND_SYLVIE: '00000000-0000-4000-8000-c00000000012',
  KBS_CAND_BORIS: '00000000-0000-4000-8000-c00000000013',
  KBS_CAND_AMINA: '00000000-0000-4000-8000-c00000000014',
  KBS_CAND_PAUL: '00000000-0000-4000-8000-c00000000015',
  KBS_CERT_ERIC: '00000000-0000-4000-8000-c00000000021',
  KBS_CERT_SYLVIE: '00000000-0000-4000-8000-c00000000022',
  KBS_CERT_BORIS: '00000000-0000-4000-8000-c00000000023',
  KBS_CERT_AMINA: '00000000-0000-4000-8000-c00000000024',
  KBS_CERT_PAUL: '00000000-0000-4000-8000-c00000000025',

  // Kamnet
  AGENT_ERIC: '00000000-0000-4000-8000-d00000000001',
  AGENT_SYLVIE: '00000000-0000-4000-8000-d00000000002',
  AGENT_BORIS: '00000000-0000-4000-8000-d00000000003',
  AGENT_AMINA: '00000000-0000-4000-8000-d00000000004',
  AGENT_PAUL: '00000000-0000-4000-8000-d00000000005',

  // Lands
  LABEL_TDT: '00000000-0000-4000-8000-e00000000001',
  LABEL_VEFL: '00000000-0000-4000-8000-e00000000002',
  LABEL_VEFIL: '00000000-0000-4000-8000-e00000000003',
  LAND_1: '00000000-0000-4000-8000-e00000000011',
  LAND_2: '00000000-0000-4000-8000-e00000000012',
  LAND_3: '00000000-0000-4000-8000-e00000000013',
  LAND_4: '00000000-0000-4000-8000-e00000000014',
  LAND_5: '00000000-0000-4000-8000-e00000000015',
};

const SEED_DATE = new Date('2025-01-01T00:00:00Z');
const CERT_EXPIRY = new Date('2027-01-01T00:00:00Z'); // 2-year certificate validity
const PASSWORD_HASH = bcrypt.hashSync('Test1234!', 12);

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const corePool = new Pool({ connectionString: process.env['DATABASE_URL_CORE'] });
const kbsPool = new Pool({ connectionString: process.env['DATABASE_URL_KBS'] });
const kamnetPool = new Pool({ connectionString: process.env['DATABASE_URL_KAMNET'] });
const landsPool = new Pool({ connectionString: process.env['DATABASE_URL_LANDS'] });

const core = new CoreClient({ adapter: new PrismaPg(corePool) });
const kbs = new KbsClient({ adapter: new PrismaPg(kbsPool) });
const kamnet = new KamnetClient({ adapter: new PrismaPg(kamnetPool) });
const lands = new LandsClient({ adapter: new PrismaPg(landsPool) });

function getDbName(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.replace('/', '');
    return name || null;
  } catch {
    return null;
  }
}

async function ensureDatabaseExists(dbName: string | null) {
  if (!dbName) return;
  const exists = await corePool.query('select 1 from pg_database where datname = $1', [dbName]);
  if (exists.rowCount === 0) {
    await corePool.query(`create database "${dbName}"`);
    console.log(`  ✓ Created database ${dbName}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function assignRole(userId: string, roleId: string, grantedBy: string) {
  await core.userRole.upsert({
    where: { userId_roleId: { userId, roleId } },
    create: { userId, roleId, grantedBy },
    update: {},
  });
}

// ---------------------------------------------------------------------------
// Core seed
// ---------------------------------------------------------------------------

async function seedCore() {
  console.log('  → Seeding Core (roles, users, profiles)...');

  // Roles
  const roles = [
    {
      id: IDS.ROLE_ADMIN_GLOBAL,
      code: RoleCode.ADMIN_GLOBAL,
      name: 'Global Administrator',
      description: 'Full platform access',
    },
    {
      id: IDS.ROLE_CLIENT,
      code: RoleCode.CLIENT,
      name: 'Client',
      description: 'Portal access for land buyers',
    },
    {
      id: IDS.ROLE_CANDIDATE_KBS,
      code: RoleCode.CANDIDATE_KBS,
      name: 'KBS Candidate',
      description: 'Enrolled in KBS training',
    },
    {
      id: IDS.ROLE_KCA_CERTIFIED,
      code: RoleCode.KCA_CERTIFIED,
      name: 'KCA Certified',
      description: 'Holds a valid KCA certificate',
    },
    {
      id: IDS.ROLE_AGENT,
      code: RoleCode.AGENT,
      name: 'KAMNET Agent',
      description: 'Certified commercial agent',
    },
    {
      id: IDS.ROLE_ADMIN_KBS,
      code: RoleCode.ADMIN_KBS,
      name: 'KBS Administrator',
      description: 'Manages courses, exams and certificates',
    },
    {
      id: IDS.ROLE_ADMIN_KAMNET,
      code: RoleCode.ADMIN_KAMNET,
      name: 'KAMNET Administrator',
      description: 'Manages agents and commissions',
    },
    {
      id: IDS.ROLE_ADMIN_LANDS,
      code: RoleCode.ADMIN_LANDS,
      name: 'LANDS Administrator',
      description: 'Manages land inventory and reservations',
    },
  ];

  for (const { id, ...rest } of roles) {
    await core.role.upsert({ where: { code: rest.code }, create: { id, ...rest }, update: {} });
  }

  // Users
  const users = [
    {
      id: IDS.USER_ADMIN_GLOBAL,
      email: 'admin@kambriq.com',
      firstName: 'Marie',
      lastName: 'Kambriq',
      country: 'CM',
    },
    {
      id: IDS.USER_ADMIN_KBS,
      email: 'jean.kbs@kambriq.com',
      firstName: 'Jean',
      lastName: 'Nkolo',
      country: 'CM',
    },
    {
      id: IDS.USER_ADMIN_KAMNET,
      email: 'claude.kamnet@kambriq.com',
      firstName: 'Claude',
      lastName: 'Nzinga',
      country: 'CM',
    },
    {
      id: IDS.USER_ADMIN_LANDS,
      email: 'pierre.lands@kambriq.com',
      firstName: 'Pierre',
      lastName: 'Essomba',
      country: 'CM',
    },
    {
      id: IDS.USER_ERIC,
      email: 'eric.mbou@kambriq.com',
      firstName: 'Eric',
      lastName: 'Mbou',
      country: 'CM',
    },
    {
      id: IDS.USER_SYLVIE,
      email: 'sylvie.ngo@kambriq.com',
      firstName: 'Sylvie',
      lastName: 'Ngo',
      country: 'CM',
    },
    {
      id: IDS.USER_BORIS,
      email: 'boris.tcha@kambriq.com',
      firstName: 'Boris',
      lastName: 'Tcha',
      country: 'CM',
    },
    {
      id: IDS.USER_AMINA,
      email: 'amina.fall@kambriq.com',
      firstName: 'Amina',
      lastName: 'Fall',
      country: 'CM',
    },
    {
      id: IDS.USER_PAUL,
      email: 'paul.fouda@kambriq.com',
      firstName: 'Paul',
      lastName: 'Fouda',
      country: 'CM',
    },
  ];

  for (const { id, country, ...rest } of users) {
    await core.user.upsert({
      where: { email: rest.email },
      create: {
        id,
        ...rest,
        passwordHash: PASSWORD_HASH,
        emailVerified: true,
        preferredLanguage: 'fr',
      },
      update: {},
    });
    await core.userProfile.upsert({
      where: { userId: id },
      create: { userId: id, country, city: 'Douala' },
      update: {},
    });
  }

  // Role assignments
  const assignments = [
    [IDS.USER_ADMIN_GLOBAL, IDS.ROLE_ADMIN_GLOBAL],
    [IDS.USER_ADMIN_KBS, IDS.ROLE_ADMIN_KBS],
    [IDS.USER_ADMIN_KAMNET, IDS.ROLE_ADMIN_KAMNET],
    [IDS.USER_ADMIN_LANDS, IDS.ROLE_ADMIN_LANDS],
    [IDS.USER_ERIC, IDS.ROLE_KCA_CERTIFIED],
    [IDS.USER_ERIC, IDS.ROLE_AGENT],
    [IDS.USER_SYLVIE, IDS.ROLE_KCA_CERTIFIED],
    [IDS.USER_SYLVIE, IDS.ROLE_AGENT],
    [IDS.USER_BORIS, IDS.ROLE_KCA_CERTIFIED],
    [IDS.USER_BORIS, IDS.ROLE_AGENT],
    [IDS.USER_AMINA, IDS.ROLE_KCA_CERTIFIED],
    [IDS.USER_AMINA, IDS.ROLE_AGENT],
    [IDS.USER_PAUL, IDS.ROLE_KCA_CERTIFIED],
    [IDS.USER_PAUL, IDS.ROLE_AGENT],
  ];

  for (const [userId, roleId] of assignments) {
    await assignRole(userId, roleId, IDS.USER_ADMIN_GLOBAL);
  }

  console.log('  ✓ Core seeded (9 users, 8 roles)');
}

// ---------------------------------------------------------------------------
// KBS seed
// ---------------------------------------------------------------------------

async function seedKbs() {
  console.log('  → Seeding KBS (course, modules, lessons, candidates, certificates)...');

  // Course
  await kbs.kbsCourse.upsert({
    where: { id: IDS.KBS_COURSE },
    create: {
      id: IDS.KBS_COURSE,
      title: 'Formation Commerciale KAMBRIQ (KCA)',
      description:
        "Programme de formation pour les futurs agents certifiés KAMBRIQ. Couvre la présentation de l'offre, les techniques de vente immobilière et la réglementation foncière au Cameroun.",
      language: 'fr',
      isPublished: true,
      duration: 180,
    },
    update: {},
  });

  // Modules
  const modules = [
    {
      id: IDS.KBS_MODULE_1,
      courseId: IDS.KBS_COURSE,
      title: 'Module 1 : Présentation de KAMBRIQ et de son Offre',
      description:
        'Histoire, vision, portefeuille foncier et positionnement de KAMBRIQ sur le marché immobilier camerounais.',
      order: 1,
    },
    {
      id: IDS.KBS_MODULE_2,
      courseId: IDS.KBS_COURSE,
      title: 'Module 2 : Techniques de Vente Immobilière',
      description:
        'Prospection, argumentaire de vente, gestion des objections et closing pour les parcelles KAMBRIQ.',
      order: 2,
    },
  ];

  for (const m of modules) {
    await kbs.kbsModule.upsert({ where: { id: m.id }, create: m, update: {} });
  }

  // Lessons (3 per module)
  const lessons = [
    {
      moduleId: IDS.KBS_MODULE_1,
      title: 'Histoire et Mission de KAMBRIQ',
      contentType: 'video',
      contentUrl: 'kbs/lessons/m1-l1.mp4',
      duration: 15,
      order: 1,
    },
    {
      moduleId: IDS.KBS_MODULE_1,
      title: 'Catalogue des Parcelles et Labels Fonciers',
      contentType: 'pdf',
      contentUrl: 'kbs/lessons/m1-l2.pdf',
      duration: 20,
      order: 2,
    },
    {
      moduleId: IDS.KBS_MODULE_1,
      title: 'Comprendre les Titres Fonciers au Cameroun',
      contentType: 'html',
      contentUrl: 'kbs/lessons/m1-l3.html',
      duration: 25,
      order: 3,
    },
    {
      moduleId: IDS.KBS_MODULE_2,
      title: 'Identifier et Qualifier un Prospect',
      contentType: 'video',
      contentUrl: 'kbs/lessons/m2-l1.mp4',
      duration: 20,
      order: 1,
    },
    {
      moduleId: IDS.KBS_MODULE_2,
      title: 'Argumentaire de Vente et Gestion des Objections',
      contentType: 'pdf',
      contentUrl: 'kbs/lessons/m2-l2.pdf',
      duration: 30,
      order: 2,
    },
    {
      moduleId: IDS.KBS_MODULE_2,
      title: 'Processus de Réservation et Documentation',
      contentType: 'html',
      contentUrl: 'kbs/lessons/m2-l3.html',
      duration: 20,
      order: 3,
    },
  ];

  for (let i = 0; i < lessons.length; i++) {
    const lessonId = `00000000-0000-4000-8000-c0000000003${i + 1}`;
    await kbs.kbsLesson.upsert({
      where: { id: lessonId },
      create: { id: lessonId, ...lessons[i] },
      update: {},
    });
  }

  // Settings (singleton)
  // `activeCourseId` is not decoration. `checkAndTransitionToExamPending` reads
  // it first and returns early when it is null, so a candidate who has passed
  // every module stays IN_TRAINING for ever with nothing logged, and
  // `me/overview` answers `course: null, modulesTotal: 0` to somebody who has
  // just completed six lessons. Both were observed on dev before this line.
  //
  // `update` sets it too: the settings row already exists on any environment
  // seeded before this, and `update: {}` would have left it null there.
  await kbs.kbsSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      examQuestionCount: 20,
      quizQuestionCount: 10,
      quizMaxAttempts: 0,
      activeCourseId: IDS.KBS_COURSE,
    },
    update: { activeCourseId: IDS.KBS_COURSE },
  });

  // -------------------------------------------------------------------------
  // Question pools: quiz (KbsQuestion) and exam (KbsExamQuestion)
  //
  // Sized from the code, not from taste:
  //   - the quiz draw is PER MODULE, sliced to quizQuestionCount (10):
  //     courses.service.ts findQuestionsForQuiz -> findMany({ where: { moduleId } })
  //   - the exam pool check and draw are GLOBAL, sliced to examQuestionCount (20):
  //     exam.service.ts ensureQuestionPoolAvailable -> count() with no where
  //
  // 30 per module gives the quiz a 3x margin and the exam a 3x global margin, so
  // a predicate added later to either findMany has to remove two thirds of the
  // pool before the guards refuse. Content is real, not templated: a tester must
  // be able to spot a wrong grade, which needs one defensibly correct answer and
  // three defensibly wrong ones.
  //
  // No KbsExam rows are seeded on purpose. An exam is candidate state, not
  // content: a pre-seeded one sits in SCHEDULED/IN_PROGRESS and
  // checkEligibilityRules then refuses to schedule another, so it would block
  // the tester rather than help. Seed the pool, not the state.
  // -------------------------------------------------------------------------
  const quizBank: Array<[string, SeedQuestion[]]> = [
    [IDS.KBS_MODULE_1, MODULE_1_QUIZ],
    [IDS.KBS_MODULE_2, MODULE_2_QUIZ],
  ];
  const examBank: Array<[string, SeedQuestion[]]> = [
    [IDS.KBS_MODULE_1, MODULE_1_EXAM],
    [IDS.KBS_MODULE_2, MODULE_2_EXAM],
  ];

  // Deterministic ids so re-running upserts instead of duplicating.
  //
  // The last UUID segment must be exactly 12 hex characters. Prefixes a-e are
  // already taken by the IDS block above (roles a, users b, KBS c, kamnet d,
  // lands e), so these use f with a family digit: f1 quiz question, f2 quiz
  // answer, f3 exam question, f4 exam answer. Reusing an existing prefix would
  // have let an upsert silently overwrite a real row rather than fail.
  const qId = (mod: number, n: number, exam: boolean) =>
    `00000000-0000-4000-8000-f${exam ? '3' : '1'}${mod}${String(n).padStart(9, '0')}`;
  const aId = (mod: number, n: number, a: number, exam: boolean) =>
    `00000000-0000-4000-8000-f${exam ? '4' : '2'}${mod}${String(n).padStart(5, '0')}${String(a).padStart(4, '0')}`;

  let quizQuestions = 0;
  let quizAnswers = 0;
  let examQuestions = 0;
  let examAnswers = 0;
  let globalIndex = 0;

  for (const [modIndex, [moduleId, bank]] of quizBank.entries()) {
    for (const [i, item] of bank.entries()) {
      const id = qId(modIndex + 1, i + 1, false);
      await kbs.kbsQuestion.upsert({
        where: { id },
        create: { id, moduleId, text: item.q, type: 'SINGLE' },
        update: {},
      });
      quizQuestions++;

      for (const [a, answer] of orderAnswers(item, globalIndex).entries()) {
        const answerId = aId(modIndex + 1, i + 1, a + 1, false);
        await kbs.kbsAnswer.upsert({
          where: { id: answerId },
          create: { id: answerId, questionId: id, text: answer.text, isCorrect: answer.isCorrect },
          update: {},
        });
        quizAnswers++;
      }
      globalIndex++;
    }
  }

  for (const [modIndex, [moduleId, bank]] of examBank.entries()) {
    for (const [i, item] of bank.entries()) {
      const id = qId(modIndex + 1, i + 1, true);
      await kbs.kbsExamQuestion.upsert({
        where: { id },
        create: { id, moduleId, text: item.q, type: 'SINGLE' },
        update: {},
      });
      examQuestions++;

      for (const [a, answer] of orderAnswers(item, globalIndex).entries()) {
        const answerId = aId(modIndex + 1, i + 1, a + 1, true);
        await kbs.kbsExamQuestionAnswer.upsert({
          where: { id: answerId },
          create: { id: answerId, questionId: id, text: answer.text, isCorrect: answer.isCorrect },
          update: {},
        });
        examAnswers++;
      }
      globalIndex++;
    }
  }

  console.log(
    `  ✓ Question pools seeded (${quizQuestions} quiz / ${quizAnswers} answers, ` +
      `${examQuestions} exam / ${examAnswers} answers)`,
  );

  // Candidates (5 agents who completed the training)
  const candidates = [
    { id: IDS.KBS_CAND_ERIC, userId: IDS.USER_ERIC },
    { id: IDS.KBS_CAND_SYLVIE, userId: IDS.USER_SYLVIE },
    { id: IDS.KBS_CAND_BORIS, userId: IDS.USER_BORIS },
    { id: IDS.KBS_CAND_AMINA, userId: IDS.USER_AMINA },
    { id: IDS.KBS_CAND_PAUL, userId: IDS.USER_PAUL },
  ];

  for (const c of candidates) {
    await kbs.kbsCandidate.upsert({
      where: { id: c.id },
      create: {
        ...c,
        status: 'CERTIFIED',
        certifiedAt: SEED_DATE,
        enrolledAt: new Date('2024-11-01'),
      },
      update: {},
    });
  }

  // KCA Certificates
  const certs = [
    { id: IDS.KBS_CERT_ERIC, candidateId: IDS.KBS_CAND_ERIC, kcaNumber: 'KCA-20250101-0001' },
    { id: IDS.KBS_CERT_SYLVIE, candidateId: IDS.KBS_CAND_SYLVIE, kcaNumber: 'KCA-20250101-0002' },
    { id: IDS.KBS_CERT_BORIS, candidateId: IDS.KBS_CAND_BORIS, kcaNumber: 'KCA-20250101-0003' },
    { id: IDS.KBS_CERT_AMINA, candidateId: IDS.KBS_CAND_AMINA, kcaNumber: 'KCA-20250101-0004' },
    { id: IDS.KBS_CERT_PAUL, candidateId: IDS.KBS_CAND_PAUL, kcaNumber: 'KCA-20250101-0005' },
  ];

  for (const cert of certs) {
    await kbs.kbsCertificate.upsert({
      where: { id: cert.id },
      create: {
        ...cert,
        issueDate: SEED_DATE,
        validUntil: CERT_EXPIRY,
        issuedBy: IDS.USER_ADMIN_KBS,
      },
      update: {},
    });
  }

  console.log(
    '  ✓ KBS seeded (1 course, 2 modules, 6 lessons, 60 quiz + 60 exam questions, 5 candidates, 5 certificates)',
  );
}

// ---------------------------------------------------------------------------
// Kamnet seed
// ---------------------------------------------------------------------------

async function seedKamnet() {
  console.log('  → Seeding Kamnet (applications, agents, leads, commissions)...');

  // Approved applications
  const applications = [
    { userId: IDS.USER_ERIC, kcaNumber: 'KCA-20250101-0001', sponsorCode: null },
    { userId: IDS.USER_SYLVIE, kcaNumber: 'KCA-20250101-0002', sponsorCode: 'AGT-2025-0001' },
    { userId: IDS.USER_BORIS, kcaNumber: 'KCA-20250101-0003', sponsorCode: 'AGT-2025-0001' },
    { userId: IDS.USER_AMINA, kcaNumber: 'KCA-20250101-0004', sponsorCode: 'AGT-2025-0002' },
    { userId: IDS.USER_PAUL, kcaNumber: 'KCA-20250101-0005', sponsorCode: 'AGT-2025-0001' },
  ];

  for (const app of applications) {
    await kamnet.kamnetApplication.upsert({
      where: { userId: app.userId },
      create: {
        userId: app.userId,
        kcaNumber: app.kcaNumber,
        sponsorCode: app.sponsorCode ?? null,
        status: 'APPROVED',
        reviewedBy: IDS.USER_ADMIN_KAMNET,
        reviewedAt: SEED_DATE,
        motivation:
          "Je souhaite rejoindre le réseau KAMBRIQ pour développer ma carrière dans l'immobilier.",
      },
      update: {},
    });
  }

  // Agents - tree: Eric is root; Sylvie, Boris, Paul are N1; Amina is N2 (under Sylvie)
  // Note: Eric must be created before Sylvie/Boris/Paul reference him as sponsor.
  const agents: Array<{
    id: string;
    userId: string;
    kcaNumber: string;
    agentCode: string;
    sponsorId: string | null;
    salesCount: number;
    tier: KamnetAgentTier;
  }> = [
    {
      id: IDS.AGENT_ERIC,
      userId: IDS.USER_ERIC,
      kcaNumber: 'KCA-20250101-0001',
      agentCode: 'AGT-2025-0001',
      sponsorId: null,
      salesCount: 6,
      tier: KamnetAgentTier.CONFIRMED,
    },
    {
      id: IDS.AGENT_SYLVIE,
      userId: IDS.USER_SYLVIE,
      kcaNumber: 'KCA-20250101-0002',
      agentCode: 'AGT-2025-0002',
      sponsorId: IDS.AGENT_ERIC,
      salesCount: 2,
      tier: KamnetAgentTier.JUNIOR,
    },
    {
      id: IDS.AGENT_BORIS,
      userId: IDS.USER_BORIS,
      kcaNumber: 'KCA-20250101-0003',
      agentCode: 'AGT-2025-0003',
      sponsorId: IDS.AGENT_ERIC,
      salesCount: 1,
      tier: KamnetAgentTier.JUNIOR,
    },
    {
      id: IDS.AGENT_AMINA,
      userId: IDS.USER_AMINA,
      kcaNumber: 'KCA-20250101-0004',
      agentCode: 'AGT-2025-0004',
      sponsorId: IDS.AGENT_SYLVIE,
      salesCount: 0,
      tier: KamnetAgentTier.JUNIOR,
    },
    {
      id: IDS.AGENT_PAUL,
      userId: IDS.USER_PAUL,
      kcaNumber: 'KCA-20250101-0005',
      agentCode: 'AGT-2025-0005',
      sponsorId: IDS.AGENT_ERIC,
      salesCount: 0,
      tier: KamnetAgentTier.JUNIOR,
    },
  ];

  for (const agent of agents) {
    await kamnet.kamnetAgent.upsert({
      where: { id: agent.id },
      create: { ...agent, createdAt: SEED_DATE },
      update: {},
    });
  }

  // Leads (one per agent)
  const leads: Array<{
    agentId: string;
    clientName: string;
    clientEmail: string;
    source: KamnetLeadSource;
    status: KamnetLeadStatus;
    notes: string;
  }> = [
    {
      agentId: IDS.AGENT_ERIC,
      clientName: 'Alphonse Bello',
      clientEmail: 'alphonse.bello@email.com',
      source: KamnetLeadSource.REFERRAL,
      status: KamnetLeadStatus.QUALIFIED,
      notes: 'Intéressé par une parcelle à Douala Akwa',
    },
    {
      agentId: IDS.AGENT_SYLVIE,
      clientName: 'Fatou Diallo',
      clientEmail: 'fatou.diallo@email.com',
      source: KamnetLeadSource.SOCIAL_MEDIA,
      status: KamnetLeadStatus.CONTACTED,
      notes: 'Cherche une parcelle à Yaoundé, budget ~10M XAF',
    },
    {
      agentId: IDS.AGENT_BORIS,
      clientName: "Marc Eto'o",
      clientEmail: 'marc.etoo@email.com',
      source: KamnetLeadSource.EVENT,
      status: KamnetLeadStatus.NEW,
      notes: "Rencontré lors d'un salon immobilier",
    },
    {
      agentId: IDS.AGENT_AMINA,
      clientName: 'Rose Bekale',
      clientEmail: 'rose.bekale@email.com',
      source: KamnetLeadSource.OTHER,
      status: KamnetLeadStatus.NEW,
      notes: 'Référence de Eric Mbou',
    },
    {
      agentId: IDS.AGENT_PAUL,
      clientName: 'Samuel Owona',
      clientEmail: 'samuel.owona@email.com',
      source: KamnetLeadSource.SOCIAL_MEDIA,
      status: KamnetLeadStatus.CONTACTED,
      notes: "Vu l'annonce Instagram, veut visiter Kribi",
    },
  ];

  for (let i = 0; i < leads.length; i++) {
    const leadId = `00000000-0000-4000-8000-d0000000010${i + 1}`;
    await kamnet.kamnetLead.upsert({
      where: { id: leadId },
      create: { id: leadId, ...leads[i], createdAt: new Date(`2025-0${i + 2}-15`) },
      update: {},
    });
  }

  // Commissions (for Eric's 6 sales - seeding 5 for variety)
  const commissions: Array<{
    agentId: string;
    landId: string;
    reservationId: string;
    level: number;
    pv: number;
    tpc: number;
    amount: number;
    status: KamnetCommissionStatus;
  }> = [
    {
      agentId: IDS.AGENT_ERIC,
      landId: IDS.LAND_5,
      reservationId: '00000000-0000-4000-8000-f00000000001',
      level: 0,
      pv: 1.0,
      tpc: 0.05,
      amount: 450000,
      status: KamnetCommissionStatus.PAID,
    },
    {
      agentId: IDS.AGENT_ERIC,
      landId: IDS.LAND_3,
      reservationId: '00000000-0000-4000-8000-f00000000002',
      level: 0,
      pv: 1.0,
      tpc: 0.05,
      amount: 750000,
      status: KamnetCommissionStatus.VALIDATED,
    },
    {
      agentId: IDS.AGENT_SYLVIE,
      landId: IDS.LAND_5,
      reservationId: '00000000-0000-4000-8000-f00000000001',
      level: 1,
      pv: 1.0,
      tpc: 0.02,
      amount: 180000,
      status: KamnetCommissionStatus.PAID,
    },
    {
      agentId: IDS.AGENT_BORIS,
      landId: IDS.LAND_3,
      reservationId: '00000000-0000-4000-8000-f00000000002',
      level: 1,
      pv: 1.0,
      tpc: 0.02,
      amount: 300000,
      status: KamnetCommissionStatus.VALIDATED,
    },
    {
      agentId: IDS.AGENT_ERIC,
      landId: IDS.LAND_1,
      reservationId: '00000000-0000-4000-8000-f00000000003',
      level: 0,
      pv: 1.0,
      tpc: 0.05,
      amount: 400000,
      status: KamnetCommissionStatus.PENDING,
    },
  ];

  for (let i = 0; i < commissions.length; i++) {
    const commId = `00000000-0000-4000-8000-d0000000020${i + 1}`;
    await kamnet.kamnetCommission.upsert({
      where: { id: commId },
      create: { id: commId, ...commissions[i] },
      update: {},
    });
  }

  console.log('  ✓ Kamnet seeded (5 agents, 5 applications, 5 leads, 5 commissions)');
}

// ---------------------------------------------------------------------------
// Lands seed
// ---------------------------------------------------------------------------

async function seedLands() {
  console.log('  → Seeding Lands (labels, parcels, reservation)...');

  // Labels
  const labels: Array<{ id: string; code: LandLabelCodes; name: string; description: string }> = [
    {
      id: IDS.LABEL_TDT,
      code: LandLabelCodes.TFL,
      name: 'Titre Foncier Loti',
      description:
        'Immatriculation faite et lotissement fait : un titre foncier individuel existe déjà. Propriété immédiate à la signature. Niveau de sécurité maximal.',
    },
    {
      id: IDS.LABEL_VEFL,
      code: LandLabelCodes.VEFL,
      name: 'Vente en État Futur de Lotissement',
      description:
        "Immatriculation faite, lotissement en cours. Le titre foncier existe déjà - un titre individuel sera établi à l'issue du lotissement. Propriété une fois le lotissement terminé.",
    },
    {
      id: IDS.LABEL_VEFIL,
      code: LandLabelCodes.VEFIL,
      name: "Vente en État Futur d'Immatriculation et de Lotissement",
      description:
        "Immatriculation en cours, lotissement à suivre. L'acheteur n'est PAS propriétaire à la signature : il doit attendre la fin de l'immatriculation ET du lotissement. Processus le plus long, jalons de vérification supplémentaires.",
    },
  ];

  for (const label of labels) {
    await lands.landLabel.upsert({
      where: { code: label.code },
      create: label,
      update: { name: label.name, description: label.description },
    });
  }

  // Land parcels
  type ParcelSeed = {
    id: string;
    title: string;
    slug: string;
    description: string;
    region: string;
    city: string;
    neighborhood: string;
    sizeM2: number;
    price: number;
    labelId: string;
    status: LandStatus;
    isPublished: boolean;
    isVerified: boolean;
    verifiedAt?: Date;
    titleNumber: string | null;
    pv: number;
    ownerType: LandOwnerType;
  };
  const parcels: ParcelSeed[] = [
    {
      id: IDS.LAND_1,
      title: 'Parcelle Douala Akwa',
      slug: 'parcelle-douala-akwa',
      description:
        'Belle parcelle de 300 m² en plein cœur du quartier Akwa à Douala. Idéale pour construction résidentielle ou commerciale. Accès facile, toutes commodités à proximité.',
      region: 'Littoral',
      city: 'Douala',
      neighborhood: 'Akwa',
      sizeM2: 300,
      price: 8000000,
      labelId: IDS.LABEL_TDT,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: true,
      verifiedAt: SEED_DATE,
      titleNumber: 'TF-CM-LT-2025-001',
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_2,
      title: 'Parcelle Yaoundé Bastos',
      slug: 'parcelle-yaounde-bastos',
      description:
        'Terrain de 450 m² dans le quartier résidentiel de Bastos, Yaoundé. Environnement calme et sécurisé, proche des ambassades et des institutions. Vue dégagée.',
      region: 'Centre',
      city: 'Yaoundé',
      neighborhood: 'Bastos',
      sizeM2: 450,
      price: 12500000,
      labelId: IDS.LABEL_VEFL,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: true,
      verifiedAt: SEED_DATE,
      titleNumber: 'TF-CM-CT-2025-002',
      pv: 1.1,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_3,
      title: 'Parcelle Douala Bonanjo',
      slug: 'parcelle-douala-bonanjo',
      description:
        "Parcelle de 250 m² dans le quartier d'affaires de Bonanjo. Excellent potentiel pour bureau ou immeuble de rapport. Forte valorisation attendue.",
      region: 'Littoral',
      city: 'Douala',
      neighborhood: 'Bonanjo',
      sizeM2: 250,
      price: 15000000,
      labelId: IDS.LABEL_TDT,
      status: LandStatus.RESERVED,
      isPublished: true,
      isVerified: true,
      verifiedAt: SEED_DATE,
      titleNumber: 'TF-CM-LT-2025-003',
      pv: 1.2,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_4,
      title: 'Parcelle Kribi Plage',
      slug: 'parcelle-kribi-plage',
      description:
        'Terrain de 600 m² à 500 m de la plage de Kribi. Cadre exceptionnel pour résidence secondaire ou projet touristique. Accès routier bitumé.',
      region: 'Sud',
      city: 'Kribi',
      neighborhood: 'Zone Balnéaire',
      sizeM2: 600,
      price: 6500000,
      labelId: IDS.LABEL_VEFIL,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: false,
      titleNumber: null,
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_5,
      title: 'Parcelle Buea Town Centre',
      slug: 'parcelle-buea-town-centre',
      description:
        "Parcelle de 350 m² au centre-ville de Buea. Zone en plein développement, proche de l'Université de Buea. Fort potentiel locatif.",
      region: 'Sud-Ouest',
      city: 'Buea',
      neighborhood: 'Town Centre',
      sizeM2: 350,
      price: 9000000,
      labelId: IDS.LABEL_TDT,
      status: LandStatus.SOLD,
      isPublished: true,
      isVerified: true,
      verifiedAt: new Date('2024-12-01'),
      titleNumber: 'TF-CM-SW-2025-004',
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
  ];

  for (const parcel of parcels) {
    await lands.land.upsert({ where: { id: parcel.id }, create: parcel, update: {} });
  }

  // Reservation for LAND_3 (Bonanjo) - CONFIRMED, by Eric for a client
  await lands.landReservation.upsert({
    where: { landId: IDS.LAND_3 },
    create: {
      id: '00000000-0000-4000-8000-e00000000031',
      landId: IDS.LAND_3,
      agentUserId: IDS.USER_ERIC,
      clientName: 'Alphonse Bello',
      clientEmail: 'alphonse.bello@email.com',
      clientPhone: '+237 699 000 001',
      status: LandReservationStatus.CONFIRMED,
      downPaymentAmount: 750000,
      downPaymentConfirmed: true,
      confirmedBy: IDS.USER_ADMIN_LANDS,
      confirmedAt: new Date('2025-02-01'),
    },
    update: {},
  });

  console.log('  ✓ Lands seeded (3 labels, 5 parcels, 1 reservation)');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n🌱 Kambriq seed starting...\n');

  try {
    await ensureDatabaseExists(getDbName(process.env['DATABASE_URL_KBS']));
    await ensureDatabaseExists(getDbName(process.env['DATABASE_URL_KAMNET']));
    await ensureDatabaseExists(getDbName(process.env['DATABASE_URL_LANDS']));

    await seedCore();
    await seedKbs();
    await seedKamnet();
    await seedLands();

    console.log('\n✅ Seed complete.\n');
    console.log('  Accounts (password: Test1234!):');
    console.log('    admin@kambriq.com         → ADMIN_GLOBAL');
    console.log('    jean.kbs@kambriq.com      → ADMIN_KBS');
    console.log('    claude.kamnet@kambriq.com → ADMIN_KAMNET');
    console.log('    pierre.lands@kambriq.com  → ADMIN_LANDS');
    console.log('    eric.mbou@kambriq.com     → AGENT  (AGT-2025-0001)');
    console.log('    sylvie.ngo@kambriq.com    → AGENT  (AGT-2025-0002)');
    console.log('    boris.tcha@kambriq.com    → AGENT  (AGT-2025-0003)');
    console.log('    amina.fall@kambriq.com    → AGENT  (AGT-2025-0004)');
    console.log('    paul.fouda@kambriq.com    → AGENT  (AGT-2025-0005)\n');
  } finally {
    await Promise.all([
      core.$disconnect(),
      kbs.$disconnect(),
      kamnet.$disconnect(),
      lands.$disconnect(),
    ]);
    await Promise.all([corePool.end(), kbsPool.end(), kamnetPool.end(), landsPool.end()]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

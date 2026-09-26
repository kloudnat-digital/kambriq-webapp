import {
  MODULE_1_QUIZ,
  MODULE_2_QUIZ,
  MODULE_1_EXAM,
  MODULE_2_EXAM,
  orderAnswers,
  type SeedQuestion,
} from './seed-data/kbs-questions';
import { restoredParcelStatus } from './seed-data/parcel-status';
import { SEED_ROLES, seedRoleId } from './seed-data/roles';
import { describeKbsSettings, seedKbsSettings } from './kbs-settings-apply';
/**
 * Database seed script.
 * Idempotent execution (UUID-keyed upserts).
 *
 * Execution: `npm run db:seed` or `npx prisma db seed`
 * Global password: Test1234!
 *
 * Accounts:
 * - admin, jean.kbs, claude.kamnet, pierre.lands (Admins)
 * - eric.mbou (Agent root, AGT-2025-0001)
 * - sylvie.ngo, boris.tcha, paul.fouda (Agents, N1)
 * - amina.fall (Agent, N2)
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
import { LessonContentType } from '../libs/common/src/constants/kbs/lesson-content';
import * as bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// Hardcoded IDs - allows cross-DB references and idempotent re-runs
// ---------------------------------------------------------------------------

const IDS = {
  // Roles (Core) - the rows themselves are in seed-data/roles.ts
  ROLE_ADMIN_GLOBAL: seedRoleId(RoleCode.ADMIN_GLOBAL),
  ROLE_CLIENT: seedRoleId(RoleCode.CLIENT),
  ROLE_CANDIDATE_KBS: seedRoleId(RoleCode.CANDIDATE_KBS),
  ROLE_KCA_CERTIFIED: seedRoleId(RoleCode.KCA_CERTIFIED),
  ROLE_AGENT: seedRoleId(RoleCode.AGENT),
  ROLE_ADMIN_KBS: seedRoleId(RoleCode.ADMIN_KBS),
  ROLE_ADMIN_KAMNET: seedRoleId(RoleCode.ADMIN_KAMNET),
  ROLE_ADMIN_LANDS: seedRoleId(RoleCode.ADMIN_LANDS),

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
  // Seed reservations for LAND_3 (RESERVED) and LAND_5 (SOLD) to satisfy foreign key constraints for related KAMNET commissions.
  LAND_RESERVATION_SEEDED: '00000000-0000-4000-8000-e00000000031',
  LAND_RESERVATION_SOLD: '00000000-0000-4000-8000-e00000000032',
  LAND_6: '00000000-0000-4000-8000-e00000000016',
  LAND_7: '00000000-0000-4000-8000-e00000000017',
  LAND_8: '00000000-0000-4000-8000-e00000000018',
  LAND_9: '00000000-0000-4000-8000-e00000000019',
  LAND_10: '00000000-0000-4000-8000-e00000000020',
  LAND_11: '00000000-0000-4000-8000-e00000000021',
  LAND_12: '00000000-0000-4000-8000-e00000000022',
  LAND_13: '00000000-0000-4000-8000-e00000000023',
  LAND_14: '00000000-0000-4000-8000-e00000000024',
  LAND_15: '00000000-0000-4000-8000-e00000000025',
  LAND_16: '00000000-0000-4000-8000-e00000000026',
  LAND_17: '00000000-0000-4000-8000-e00000000027',
  LAND_18: '00000000-0000-4000-8000-e00000000028',
  LAND_19: '00000000-0000-4000-8000-e00000000029',
  LAND_20: '00000000-0000-4000-8000-e00000000030',
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

  // Roles - one row per RoleCode (seed-data/roles.ts, held against the enum by seed-roles.spec.ts)
  for (const { id, ...rest } of SEED_ROLES) {
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

  /**
   * Pre-flight cross-database reference integrity check.
   * Ensures seeded emails strictly map to the exact deterministic IDs required
   * by fixtures across KBS, KAMNET, and Lands databases. Prevents dangling
   * relations resulting from legacy non-deterministic UUID collisions.
   */
  const seededEmails = users.map((u) => u.email);
  const existing = await core.user.findMany({
    where: { email: { in: seededEmails } },
    select: { id: true, email: true },
  });
  const byEmail = new Map(existing.map((u) => [u.email, u.id]));

  const displaced = users.filter((u) => {
    const live = byEmail.get(u.email);
    return live !== undefined && live !== u.id;
  });

  if (displaced.length > 0) {
    throw new Error(
      `Core seed precondition failed: ${displaced.length} seeded account(s) exist under unexpected IDs. ` +
        `Cross-database fixtures would dangle without strictly matched UUIDs:\n` +
        displaced
          .map((u) => `  ${u.email}: expected ${u.id}, found ${byEmail.get(u.email)}`)
          .join('\n') +
        `\nExecute \`pnpm run db:reset\` to clear legacy schema state.`,
    );
  }

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
    // Assign the CLIENT role directly so that agents retain it if their AGENT role is suspended or revoked.
    [IDS.USER_ERIC, IDS.ROLE_CLIENT],
    [IDS.USER_ERIC, IDS.ROLE_KCA_CERTIFIED],
    [IDS.USER_ERIC, IDS.ROLE_AGENT],
    [IDS.USER_SYLVIE, IDS.ROLE_CLIENT],
    [IDS.USER_SYLVIE, IDS.ROLE_KCA_CERTIFIED],
    [IDS.USER_SYLVIE, IDS.ROLE_AGENT],
    [IDS.USER_BORIS, IDS.ROLE_CLIENT],
    [IDS.USER_BORIS, IDS.ROLE_KCA_CERTIFIED],
    [IDS.USER_BORIS, IDS.ROLE_AGENT],
    [IDS.USER_AMINA, IDS.ROLE_CLIENT],
    [IDS.USER_AMINA, IDS.ROLE_KCA_CERTIFIED],
    [IDS.USER_AMINA, IDS.ROLE_AGENT],
    [IDS.USER_PAUL, IDS.ROLE_CLIENT],
    [IDS.USER_PAUL, IDS.ROLE_KCA_CERTIFIED],
    [IDS.USER_PAUL, IDS.ROLE_AGENT],
  ];

  for (const [userId, roleId] of assignments) {
    await assignRole(userId, roleId, IDS.USER_ADMIN_GLOBAL);
  }

  console.log(`  ✓ Core seeded (9 users, ${SEED_ROLES.length} roles)`);
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
      contentType: LessonContentType.VIDEO,
      contentUrl: 'kbs/lessons/m1-l1.mp4',
      duration: 15,
      order: 1,
    },
    {
      moduleId: IDS.KBS_MODULE_1,
      title: 'Catalogue des Parcelles et Labels Fonciers',
      contentType: LessonContentType.PDF,
      contentUrl: 'kbs/lessons/m1-l2.pdf',
      duration: 20,
      order: 2,
    },
    {
      moduleId: IDS.KBS_MODULE_1,
      title: 'Comprendre les Titres Fonciers au Cameroun',
      contentType: LessonContentType.HTML,
      contentUrl: 'kbs/lessons/m1-l3.html',
      duration: 25,
      order: 3,
    },
    {
      moduleId: IDS.KBS_MODULE_2,
      title: 'Identifier et Qualifier un Prospect',
      contentType: LessonContentType.VIDEO,
      contentUrl: 'kbs/lessons/m2-l1.mp4',
      duration: 20,
      order: 1,
    },
    {
      moduleId: IDS.KBS_MODULE_2,
      title: 'Argumentaire de Vente et Gestion des Objections',
      contentType: LessonContentType.PDF,
      contentUrl: 'kbs/lessons/m2-l2.pdf',
      duration: 30,
      order: 2,
    },
    {
      moduleId: IDS.KBS_MODULE_2,
      title: 'Processus de Réservation et Documentation',
      contentType: LessonContentType.HTML,
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
  // We only update the activeCourseId if it is currently null to avoid overwriting runtime administrator configuration.
  const kbsSettings = await seedKbsSettings(kbs.kbsSettings, {
    activeCourseId: IDS.KBS_COURSE,
    examQuestionCount: 20,
    quizQuestionCount: 10,
    quizMaxAttempts: 0,
  });
  console.log(`  ✓ ${describeKbsSettings(kbsSettings)}`);

  // -------------------------------------------------------------------------
  // Question pools: quiz (KbsQuestion) and exam (KbsExamQuestion)
  //
  // Sizing constraints:
  // - Quiz draws are scoped per module, limited by quizQuestionCount (10).
  // - Exam draws are global, limited by examQuestionCount (20).
  // Seed size provides a 3x margin above limits to prevent exhaustion during test iterations.
  //
  // KbsExam state records are intentionally excluded. Seeding in-progress exams
  // violates checkEligibilityRules prerequisites for subsequent scheduling.
  // -------------------------------------------------------------------------
  const quizBank: Array<[string, SeedQuestion[]]> = [
    [IDS.KBS_MODULE_1, MODULE_1_QUIZ],
    [IDS.KBS_MODULE_2, MODULE_2_QUIZ],
  ];
  const examBank: Array<[string, SeedQuestion[]]> = [
    [IDS.KBS_MODULE_1, MODULE_1_EXAM],
    [IDS.KBS_MODULE_2, MODULE_2_EXAM],
  ];

  // Deterministic ID generation for idempotent upserts.
  // Last UUID segment uses prefix 'f' (a-e reserved in IDS map) with a type indicator:
  // f1: quiz question, f2: quiz answer, f3: exam question, f4: exam answer.
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

  /**
   * Seed commissions for direct agents and sponsors.
   * Note: `reservationId` lacks cross-database foreign key enforcement.
   * Referential integrity to Lands database is verified at end of execution.
   */
  const commissions: Array<{
    agentId: string;
    landId: string;
    reservationId: string;
    level: number;
    pv: number;
    tpc: number;
    amount: bigint;
    status: KamnetCommissionStatus;
  }> = [
    {
      agentId: IDS.AGENT_ERIC,
      landId: IDS.LAND_5,
      reservationId: IDS.LAND_RESERVATION_SOLD,
      level: 0,
      pv: 1.0,
      tpc: 0.05,
      amount: 450000n,
      status: KamnetCommissionStatus.PAID,
    },
    {
      agentId: IDS.AGENT_ERIC,
      landId: IDS.LAND_3,
      reservationId: IDS.LAND_RESERVATION_SEEDED,
      level: 0,
      pv: 1.0,
      tpc: 0.05,
      amount: 750000n,
      status: KamnetCommissionStatus.VALIDATED,
    },
    {
      agentId: IDS.AGENT_SYLVIE,
      landId: IDS.LAND_5,
      reservationId: IDS.LAND_RESERVATION_SOLD,
      level: 1,
      pv: 1.0,
      tpc: 0.02,
      amount: 180000n,
      status: KamnetCommissionStatus.PAID,
    },
    {
      agentId: IDS.AGENT_BORIS,
      landId: IDS.LAND_3,
      reservationId: IDS.LAND_RESERVATION_SEEDED,
      level: 1,
      pv: 1.0,
      tpc: 0.02,
      amount: 300000n,
      status: KamnetCommissionStatus.VALIDATED,
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

  console.log('  ✓ Kamnet seeded (5 agents, 5 applications, 5 leads, 4 commissions)');
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
    /** The parcel's total price in XAF (G19); the price per m2 is generated by the database. */
    totalPrice: number;
    labelId: string;
    status: LandStatus;
    isPublished: boolean;
    isVerified: boolean;
    verifiedAt?: Date;
    /**
     * Fictitious, in the Cameroonian shape `TF <number>/<department>` (P24).
     * `WB` (Wouri B) is Visquis's code; `MF` Mfoundi, `FA` Fako, `MI` Mifi and
     * `BE` Bénoué are inferred for Yaoundé, Buea, Bafoussam and Garoua and wait
     * for his correction. No number is a real title.
     */
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
      totalPrice: 8000000,
      labelId: IDS.LABEL_TDT,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: true,
      verifiedAt: SEED_DATE,
      titleNumber: 'TF 1187/WB',
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
      totalPrice: 12500000,
      labelId: IDS.LABEL_VEFL,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: true,
      verifiedAt: SEED_DATE,
      titleNumber: 'TF 2350/MF',
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
      totalPrice: 15000000,
      labelId: IDS.LABEL_TDT,
      status: LandStatus.RESERVED,
      isPublished: true,
      isVerified: true,
      verifiedAt: SEED_DATE,
      titleNumber: 'TF 3462/WB',
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
      totalPrice: 6500000,
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
      totalPrice: 9000000,
      labelId: IDS.LABEL_TDT,
      status: LandStatus.SOLD,
      isPublished: true,
      isVerified: true,
      verifiedAt: new Date('2024-12-01'),
      titleNumber: 'TF 518/FA',
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_6,
      title: 'Parcelle Douala Bonapriso',
      slug: 'parcelle-douala-bonapriso',
      description:
        'Parcelle de 400 m² à Bonapriso, Douala. Terrain viabilisé, accès routier, dossier complet chez KAMBRIQ.',
      region: 'Littoral',
      city: 'Douala',
      neighborhood: 'Bonapriso',
      sizeM2: 400,
      totalPrice: 14000000,
      labelId: IDS.LABEL_TDT,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: true,
      verifiedAt: SEED_DATE,
      titleNumber: 'TF 4803/WB',
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_7,
      title: 'Parcelle Yaoundé Nsimeyong',
      slug: 'parcelle-yaounde-nsimeyong',
      description:
        'Parcelle de 320 m² à Nsimeyong, Yaoundé. Terrain viabilisé, accès routier, dossier complet chez KAMBRIQ.',
      region: 'Centre',
      city: 'Yaoundé',
      neighborhood: 'Nsimeyong',
      sizeM2: 320,
      totalPrice: 7200000,
      labelId: IDS.LABEL_VEFL,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: false,
      titleNumber: null,
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_8,
      title: 'Parcelle Douala Logbessou',
      slug: 'parcelle-douala-logbessou',
      description:
        'Parcelle de 500 m² à Logbessou, Douala. Terrain viabilisé, accès routier, dossier complet chez KAMBRIQ.',
      region: 'Littoral',
      city: 'Douala',
      neighborhood: 'Logbessou',
      sizeM2: 500,
      totalPrice: 6800000,
      labelId: IDS.LABEL_VEFIL,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: false,
      titleNumber: null,
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_9,
      title: 'Parcelle Yaoundé Odza',
      slug: 'parcelle-yaounde-odza',
      description:
        'Parcelle de 380 m² à Odza, Yaoundé. Terrain viabilisé, accès routier, dossier complet chez KAMBRIQ.',
      region: 'Centre',
      city: 'Yaoundé',
      neighborhood: 'Odza',
      sizeM2: 380,
      totalPrice: 6100000,
      labelId: IDS.LABEL_VEFL,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: false,
      titleNumber: null,
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_10,
      title: 'Parcelle Bafoussam Tamdja',
      slug: 'parcelle-bafoussam-tamdja',
      description:
        'Parcelle de 450 m² à Tamdja, Bafoussam. Terrain viabilisé, accès routier, dossier complet chez KAMBRIQ.',
      region: 'Ouest',
      city: 'Bafoussam',
      neighborhood: 'Tamdja',
      sizeM2: 450,
      totalPrice: 4900000,
      labelId: IDS.LABEL_TDT,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: true,
      verifiedAt: SEED_DATE,
      titleNumber: 'TF 912/MI',
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_11,
      title: 'Parcelle Limbé Mile 4',
      slug: 'parcelle-limbe-mile-4',
      description:
        'Parcelle de 520 m² à Mile 4, Limbé. Terrain viabilisé, accès routier, dossier complet chez KAMBRIQ.',
      region: 'Sud-Ouest',
      city: 'Limbé',
      neighborhood: 'Mile 4',
      sizeM2: 520,
      totalPrice: 7600000,
      labelId: IDS.LABEL_VEFIL,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: false,
      titleNumber: null,
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_12,
      title: 'Parcelle Kribi Mpangou',
      slug: 'parcelle-kribi-mpangou',
      description:
        'Parcelle de 700 m² à Mpangou, Kribi. Terrain viabilisé, accès routier, dossier complet chez KAMBRIQ.',
      region: 'Sud',
      city: 'Kribi',
      neighborhood: 'Mpangou',
      sizeM2: 700,
      totalPrice: 8900000,
      labelId: IDS.LABEL_VEFL,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: false,
      titleNumber: null,
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_13,
      title: 'Parcelle Garoua Plateau',
      slug: 'parcelle-garoua-plateau',
      description:
        'Parcelle de 600 m² à Plateau, Garoua. Terrain viabilisé, accès routier, dossier complet chez KAMBRIQ.',
      region: 'Nord',
      city: 'Garoua',
      neighborhood: 'Plateau',
      sizeM2: 600,
      totalPrice: 3800000,
      labelId: IDS.LABEL_TDT,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: true,
      verifiedAt: SEED_DATE,
      titleNumber: 'TF 2764/BE',
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_14,
      title: 'Parcelle Bertoua Nkolbikon',
      slug: 'parcelle-bertoua-nkolbikon',
      description:
        'Parcelle de 480 m² à Nkolbikon, Bertoua. Terrain viabilisé, accès routier, dossier complet chez KAMBRIQ.',
      region: 'Est',
      city: 'Bertoua',
      neighborhood: 'Nkolbikon',
      sizeM2: 480,
      totalPrice: 3400000,
      labelId: IDS.LABEL_VEFIL,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: false,
      titleNumber: null,
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_15,
      title: 'Parcelle Ngaoundéré Dang',
      slug: 'parcelle-ngaoundere-dang',
      description:
        'Parcelle de 550 m² à Dang, Ngaoundéré. Terrain viabilisé, accès routier, dossier complet chez KAMBRIQ.',
      region: 'Adamaoua',
      city: 'Ngaoundéré',
      neighborhood: 'Dang',
      sizeM2: 550,
      totalPrice: 3600000,
      labelId: IDS.LABEL_VEFL,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: false,
      titleNumber: null,
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_16,
      title: 'Parcelle Douala Yassa',
      slug: 'parcelle-douala-yassa',
      description:
        'Parcelle de 420 m² à Yassa, Douala. Terrain viabilisé, accès routier, dossier complet chez KAMBRIQ.',
      region: 'Littoral',
      city: 'Douala',
      neighborhood: 'Yassa',
      sizeM2: 420,
      totalPrice: 5400000,
      labelId: IDS.LABEL_VEFIL,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: false,
      titleNumber: null,
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_17,
      title: 'Parcelle Yaoundé Mfandena',
      slug: 'parcelle-yaounde-mfandena',
      description:
        'Parcelle de 300 m² à Mfandena, Yaoundé. Terrain viabilisé, accès routier, dossier complet chez KAMBRIQ.',
      region: 'Centre',
      city: 'Yaoundé',
      neighborhood: 'Mfandena',
      sizeM2: 300,
      totalPrice: 9800000,
      labelId: IDS.LABEL_TDT,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: true,
      verifiedAt: SEED_DATE,
      titleNumber: 'TF 6075/MF',
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_18,
      title: 'Parcelle Edéa Centre',
      slug: 'parcelle-edea-centre',
      description:
        'Parcelle de 360 m² à Centre, Edéa. Terrain viabilisé, accès routier, dossier complet chez KAMBRIQ.',
      region: 'Littoral',
      city: 'Edéa',
      neighborhood: 'Centre',
      sizeM2: 360,
      totalPrice: 4200000,
      labelId: IDS.LABEL_VEFL,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: false,
      titleNumber: null,
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_19,
      title: 'Parcelle Buea Molyko',
      slug: 'parcelle-buea-molyko',
      description:
        'Parcelle de 340 m² à Molyko, Buea. Terrain viabilisé, accès routier, dossier complet chez KAMBRIQ.',
      region: 'Sud-Ouest',
      city: 'Buea',
      neighborhood: 'Molyko',
      sizeM2: 340,
      totalPrice: 7100000,
      labelId: IDS.LABEL_VEFL,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: false,
      titleNumber: null,
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
    {
      id: IDS.LAND_20,
      title: 'Parcelle Maroua Domayo',
      slug: 'parcelle-maroua-domayo',
      description:
        'Parcelle de 580 m² à Domayo, Maroua. Terrain viabilisé, accès routier, dossier complet chez KAMBRIQ.',
      region: 'Extrême-Nord',
      city: 'Maroua',
      neighborhood: 'Domayo',
      sizeM2: 580,
      totalPrice: 2900000,
      labelId: IDS.LABEL_VEFIL,
      status: LandStatus.AVAILABLE,
      isPublished: true,
      isVerified: false,
      titleNumber: null,
      pv: 1.0,
      ownerType: LandOwnerType.KAMBRIQ,
    },
  ];

  /**
   * Idempotent is not restorative, and the difference is a Monday problem.
   *
   * `update: {}` meant a re-run changed nothing about an existing parcel. A
   * tester reserving parcels moves them AVAILABLE -> RESERVED -> SOLD, and no
   * amount of re-seeding gave them back: five parcels, five reservations, and
   * the sixth run looks like a broken platform rather than an exhausted fixture.
   * The seed said "5 parcels seeded" every time while the pool it described was
   * empty — a success message over a state it had not restored.
   *
   * A seeded fixture must be returned to its seeded state by a re-run. So the
   * update clause sets the fields a journey mutates, and the reservations a
   * journey created against seeded parcels are removed first — otherwise the
   * unique `landId` still ties the parcel to somebody's test run.
   *
   * Only rows the seed owns are touched: reservations on seeded parcel ids,
   * excluding the seeded reservation itself. A tester's parcels, if they ever
   * create any, are none of the seed's business.
   */
  const seededParcelIds = parcels.map((p) => p.id);

  /**
   * A reservation that carries a payment is left alone, and said so.
   *
   * G1 made `Payment.reservationId` a foreign key and made the ledger and the
   * audit trail append-only in the database - `PaymentReceipt` and
   * `PaymentTransition` have BEFORE DELETE triggers that refuse. So a
   * reservation with money against it cannot be deleted, by anybody, including
   * this seed. `deleteMany` on it fails with a bare
   * `ForeignKeyConstraintViolation` and takes the whole seed down after Core,
   * KBS and Kamnet have already been written.
   *
   * That is not a bug in the triggers. **Money that arrived is not test data**,
   * and a reset that could erase a receipt would be a reset that can erase
   * evidence. The seed's job is to restore fixtures, and this row has stopped
   * being one.
   *
   * So it is skipped, by name, out loud. Silently leaving it would be the
   * mechanism that reports success by saying nothing; failing on it would make
   * one local payment block every future seed run.
   */
  /**
   * Both seeded reservations are excluded from the clear, not just the first.
   *
   * A seeded reservation left in the set is deleted and recreated on every
   * run, and is reported as an anomaly once it carries a payment.
   */
  const seededReservationIds = [IDS.LAND_RESERVATION_SEEDED, IDS.LAND_RESERVATION_SOLD];

  const reservationsToClear = await lands.landReservation.findMany({
    where: {
      landId: { in: seededParcelIds },
      id: { notIn: seededReservationIds },
    },
    select: {
      id: true,
      landId: true,
      status: true,
      payments: { select: { reference: true } },
    },
  });

  const withMoney = reservationsToClear.filter((r) => r.payments.length > 0);
  const clearable = reservationsToClear.filter((r) => r.payments.length === 0);

  /**
   * A31 - a kept reservation still holds its parcel.
   *
   * The rows above are kept, not deleted, so whatever they held they still
   * hold. This used to print "Those parcels keep their current status" and then
   * reset every parcel to its seeded status regardless: on dev on 14 September
   * that listed eight parcels AVAILABLE under a PENDING reservation, and journeys
   * 4 and 5 met a 409 on every push from 08:22 UTC - the listing said free and
   * the reservation service, which checks for an active reservation, said taken.
   *
   * So each parcel is written through `restoredParcelStatus`: its seeded status
   * only when no kept reservation holds it, otherwise the status the API itself
   * gives a parcel under that reservation.
   */
  const keptOn = new Map<string, LandReservationStatus[]>();
  for (const r of withMoney) keptOn.set(r.landId, [...(keptOn.get(r.landId) ?? []), r.status]);

  if (withMoney.length > 0) {
    console.log(
      `  ! ${withMoney.length} reservation(s) kept: they carry payments, and a payment's ` +
        `ledger cannot be deleted (append-only, by design).`,
    );
    for (const r of withMoney) {
      const refs = r.payments.map((p) => p.reference ?? '(no reference)').join(', ');
      console.log(
        `    - reservation ${r.id} (${r.status}) on parcel ${r.landId} - payments: ${refs}`,
      );
    }
    console.log(
      `    A parcel one of them still holds stays RESERVED or SOLD, as the API left it, and is ` +
        `not listed AVAILABLE. To free it, the payment has to be dealt with deliberately first.`,
    );
  }

  await lands.landReservation.deleteMany({
    where: { id: { in: clearable.map((r) => r.id) } },
  });

  for (const parcel of parcels) {
    await lands.land.upsert({
      where: { id: parcel.id },
      create: parcel,
      // The mutable surface of a parcel, reset. `status` is what a journey
      // changes; the rest are here because a half-restored fixture is worse than
      // an unrestored one - it looks correct. Status only where nothing the seed
      // kept still holds the parcel (A31).
      update: {
        status: restoredParcelStatus(parcel.status, keptOn.get(parcel.id) ?? []),
        isPublished: parcel.isPublished,
        totalPrice: parcel.totalPrice,
        labelId: parcel.labelId,
        // P24: the titles were rewritten from an invented format; without this
        // line dev would keep showing the old ones, because `create` runs once.
        titleNumber: parcel.titleNumber,
      },
    });
  }

  // Reservation for LAND_3 (Bonanjo) - CONFIRMED, by Eric for a client
  // Keyed on the reservation's own id, not `landId`.
  //
  // `LandReservation.landId` has no unique constraint - a parcel can carry
  // several reservations over its life. `upsert({ where: { landId } })` was
  // therefore never valid, and Postgres says so plainly:
  // "no unique or exclusion constraint matching the ON CONFLICT specification".
  // It passed silently while `update` was `{}`, because Prisma took a
  // find-then-write path; giving the update real fields made it emit
  // `INSERT ... ON CONFLICT` and the latent mismatch surfaced at once.
  await lands.landReservation.upsert({
    where: { id: IDS.LAND_RESERVATION_SEEDED },
    create: {
      id: IDS.LAND_RESERVATION_SEEDED,
      landId: IDS.LAND_3,
      agentUserId: IDS.USER_ERIC,
      clientName: 'Alphonse Bello',
      clientEmail: 'alphonse.bello@email.com',
      clientPhone: '+237 699 000 001',
      status: LandReservationStatus.CONFIRMED,
      downPaymentAmount: 750000n,
      downPaymentConfirmed: true,
      confirmedBy: IDS.USER_ADMIN_LANDS,
      confirmedAt: new Date('2025-02-01'),
    },
    update: {
      status: LandReservationStatus.CONFIRMED,
      downPaymentConfirmed: true,
    },
  });

  /**
   * Reservation for LAND_5 (Buea Town Centre) - the sale that made it SOLD.
   *
   * Two KAMNET commissions reference it. LAND_5 is seeded SOLD, so a completed
   * reservation on it matches the parcel's status and changes no AVAILABLE
   * count. It carries no payment, so it is excluded from the clear by id
   * rather than kept by the payment rule.
   */
  await lands.landReservation.upsert({
    where: { id: IDS.LAND_RESERVATION_SOLD },
    create: {
      id: IDS.LAND_RESERVATION_SOLD,
      landId: IDS.LAND_5,
      agentUserId: IDS.USER_ERIC,
      clientName: 'Mireille Ngo Bassong',
      clientEmail: 'mireille.ngobassong@email.com',
      clientPhone: '+237 699 000 002',
      status: LandReservationStatus.CONFIRMED,
      downPaymentAmount: 450000n,
      downPaymentConfirmed: true,
      confirmedBy: IDS.USER_ADMIN_LANDS,
      confirmedAt: new Date('2025-01-20'),
    },
    update: {
      status: LandReservationStatus.CONFIRMED,
      downPaymentConfirmed: true,
    },
  });

  /**
   * The seed checks its own postcondition instead of announcing one.
   *
   * The first version of the restorative fix printed nothing for lands and
   * exited non-zero, because `landReservation.upsert` keyed on a non-unique
   * column. The exhaustion proof still *looked* right — parcels had been
   * restored before the failure, so the counts moved as expected — and it was
   * read as passing. The success line never printed and its absence was not
   * noticed.
   *
   * So the last thing this function does is read back what it claims. A seed
   * that says "18 available" has now counted them.
   */
  const expectedAvailable = parcels.filter(
    (p) => restoredParcelStatus(p.status, keptOn.get(p.id) ?? []) === LandStatus.AVAILABLE,
  ).length;
  const actualAvailable = await lands.land.count({ where: { status: LandStatus.AVAILABLE } });

  if (actualAvailable !== expectedAvailable) {
    throw new Error(
      `Lands seed postcondition failed: expected ${expectedAvailable} AVAILABLE parcels, found ${actualAvailable}. ` +
        `The fixtures were not restored.`,
    );
  }

  /**
   * A31 - the property, not only the count.
   *
   * The count above passed on dev on 14 September with eight of its eighteen
   * AVAILABLE parcels unreservable: a count says how many rows carry a word, not
   * whether the word is true. What a journey - or an agent - relies on is that an
   * AVAILABLE parcel can be reserved, and the reservation service refuses any
   * parcel with a reservation that is not CANCELLED. So that is what is checked.
   */
  const falselyFree = await lands.land.findMany({
    where: {
      id: { in: seededParcelIds },
      status: LandStatus.AVAILABLE,
      reservations: { some: { status: { not: LandReservationStatus.CANCELLED } } },
    },
    select: { id: true },
  });

  if (falselyFree.length > 0) {
    throw new Error(
      `Lands seed postcondition failed: ${falselyFree.length} seeded parcel(s) are listed ` +
        `AVAILABLE while a reservation holds them, so reserving them answers 409: ` +
        `${falselyFree.map((l) => l.id).join(', ')}.`,
    );
  }

  console.log(
    `  ✓ Lands seeded (3 labels, ${parcels.length} parcels, ${actualAvailable} available, ` +
      `${seededReservationIds.length} reservations)`,
  );
}

// ---------------------------------------------------------------------------
// Cross-module postconditions
// ---------------------------------------------------------------------------

/**
 * Every commission names a reservation that exists.
 *
 * KAMNET and LANDS are separate databases, so `KamnetCommission.reservationId`
 * is a reference by convention: no foreign key refuses a dangling value and no
 * read path dereferences it.
 *
 * It runs after both modules rather than inside `seedKamnet`, because the
 * reservations it checks are written by `seedLands`. It throws: a seed that
 * warns about a broken reference and exits 0 reports success for work it did
 * not do.
 */
async function assertCommissionsNameRealReservations() {
  const commissions = await kamnet.kamnetCommission.findMany({
    select: { id: true, reservationId: true, agentId: true },
  });
  if (commissions.length === 0) return;

  const referenced = [...new Set(commissions.map((c) => c.reservationId))];
  const found = await lands.landReservation.findMany({
    where: { id: { in: referenced } },
    select: { id: true },
  });
  const live = new Set(found.map((r) => r.id));

  const dangling = commissions.filter((c) => !live.has(c.reservationId));
  if (dangling.length > 0) {
    throw new Error(
      `Seed postcondition failed: ${dangling.length} commission(s) name a reservation that does ` +
        `not exist, so they record sales that never happened: ` +
        `${dangling.map((c) => `${c.id} -> ${c.reservationId}`).join(', ')}.`,
    );
  }

  console.log(
    `  ✓ ${commissions.length} commission(s) resolve to ${live.size} real reservation(s).`,
  );
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

    await assertCommissionsNameRealReservations();

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

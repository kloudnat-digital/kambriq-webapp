-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "KbsCourse" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "slug" TEXT,
    "language" TEXT DEFAULT 'fr',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbsCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbsModule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbsModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbsLesson" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentUrl" TEXT,
    "content" TEXT,
    "duration" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbsLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbsLessonCompletion" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KbsLessonCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbsQuestion" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbsQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbsAnswer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbsAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbsExamQuestion" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbsExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbsExamQuestionAnswer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbsExamQuestionAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbsCandidate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sponsorCode" TEXT,
    "cvUrl" TEXT,
    "engagementAcceptedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "retakeCooldownDays" INTEGER NOT NULL DEFAULT 7,
    "currentCycle" INTEGER NOT NULL DEFAULT 1,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "certifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbsCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbsCandidateProgress" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "score" INTEGER,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbsCandidateProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbsExam" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "score" INTEGER,
    "passingScore" INTEGER NOT NULL DEFAULT 75,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "cycle" INTEGER NOT NULL DEFAULT 1,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbsExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbsExamAnswer" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "questionCorrect" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KbsExamAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbsExamAnswerSelection" (
    "id" TEXT NOT NULL,
    "examAnswerId" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "wasCorrect" BOOLEAN,

    CONSTRAINT "KbsExamAnswerSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbsSettings" (
    "id" SERIAL NOT NULL,
    "activeCourseId" TEXT,
    "examQuestionCount" INTEGER NOT NULL DEFAULT 20,
    "quizQuestionCount" INTEGER NOT NULL DEFAULT 10,
    "quizMaxAttempts" INTEGER NOT NULL DEFAULT 5,
    "quizCooldownMinutes" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbsSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbsCertificate" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "kcaNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "pdfUrl" TEXT,
    "issuedBy" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbsCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KbsCourse_title_key" ON "KbsCourse"("title");

-- CreateIndex
CREATE UNIQUE INDEX "KbsModule_courseId_order_key" ON "KbsModule"("courseId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "KbsLesson_moduleId_order_key" ON "KbsLesson"("moduleId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "KbsLessonCompletion_candidateId_lessonId_key" ON "KbsLessonCompletion"("candidateId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "KbsCandidate_userId_key" ON "KbsCandidate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KbsCandidateProgress_candidateId_moduleId_key" ON "KbsCandidateProgress"("candidateId", "moduleId");

-- CreateIndex
CREATE INDEX "KbsExam_candidateId_cycle_idx" ON "KbsExam"("candidateId", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "KbsExamAnswer_examId_questionId_key" ON "KbsExamAnswer"("examId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "KbsExamAnswerSelection_examAnswerId_answerId_key" ON "KbsExamAnswerSelection"("examAnswerId", "answerId");

-- CreateIndex
CREATE UNIQUE INDEX "KbsCertificate_candidateId_key" ON "KbsCertificate"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "KbsCertificate_kcaNumber_key" ON "KbsCertificate"("kcaNumber");

-- AddForeignKey
ALTER TABLE "KbsModule" ADD CONSTRAINT "KbsModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "KbsCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbsLesson" ADD CONSTRAINT "KbsLesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "KbsModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbsLessonCompletion" ADD CONSTRAINT "KbsLessonCompletion_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "KbsCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbsLessonCompletion" ADD CONSTRAINT "KbsLessonCompletion_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "KbsLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbsQuestion" ADD CONSTRAINT "KbsQuestion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "KbsModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbsAnswer" ADD CONSTRAINT "KbsAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "KbsQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbsExamQuestion" ADD CONSTRAINT "KbsExamQuestion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "KbsModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbsExamQuestionAnswer" ADD CONSTRAINT "KbsExamQuestionAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "KbsExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbsCandidateProgress" ADD CONSTRAINT "KbsCandidateProgress_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "KbsCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbsCandidateProgress" ADD CONSTRAINT "KbsCandidateProgress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "KbsModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbsExam" ADD CONSTRAINT "KbsExam_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "KbsCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbsExamAnswer" ADD CONSTRAINT "KbsExamAnswer_examId_fkey" FOREIGN KEY ("examId") REFERENCES "KbsExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbsExamAnswer" ADD CONSTRAINT "KbsExamAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "KbsExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbsExamAnswerSelection" ADD CONSTRAINT "KbsExamAnswerSelection_examAnswerId_fkey" FOREIGN KEY ("examAnswerId") REFERENCES "KbsExamAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbsExamAnswerSelection" ADD CONSTRAINT "KbsExamAnswerSelection_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "KbsExamQuestionAnswer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbsCertificate" ADD CONSTRAINT "KbsCertificate_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "KbsCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;


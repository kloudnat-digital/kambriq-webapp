-- CreateTable
CREATE TABLE "KbsLessonMedia" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbsLessonMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KbsLessonMedia_lessonId_idx" ON "KbsLessonMedia"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "KbsLessonMedia_lessonId_position_key" ON "KbsLessonMedia"("lessonId", "position");

-- AddForeignKey
ALTER TABLE "KbsLessonMedia" ADD CONSTRAINT "KbsLessonMedia_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "KbsLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

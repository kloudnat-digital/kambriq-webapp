-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "KamnetAgentTier" AS ENUM ('JUNIOR', 'CONFIRMED', 'MANAGER');

-- CreateEnum
CREATE TYPE "KamnetApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KamnetCommissionStatus" AS ENUM ('PENDING', 'VALIDATED', 'PAID');

-- CreateEnum
CREATE TYPE "KamnetLeadSource" AS ENUM ('SOCIAL_MEDIA', 'REFERRAL', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "KamnetLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "KamnetReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "KamnetAgent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kcaNumber" TEXT NOT NULL,
    "agentCode" TEXT NOT NULL,
    "bio" TEXT,
    "tier" "KamnetAgentTier" NOT NULL DEFAULT 'JUNIOR',
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "sponsorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "suspendedAt" TIMESTAMP(3),
    "suspendedBy" TEXT,

    CONSTRAINT "KamnetAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KamnetApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kcaNumber" TEXT NOT NULL,
    "sponsorCode" TEXT,
    "motivation" TEXT,
    "status" "KamnetApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KamnetApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KamnetCommission" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "landId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "pv" DOUBLE PRECISION NOT NULL,
    "tpc" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "KamnetCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KamnetCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KamnetLead" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "source" "KamnetLeadSource",
    "notes" TEXT,
    "status" "KamnetLeadStatus" NOT NULL DEFAULT 'NEW',
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "KamnetLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KamnetAgent_userId_key" ON "KamnetAgent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KamnetAgent_agentCode_key" ON "KamnetAgent"("agentCode");

-- CreateIndex
CREATE INDEX "KamnetAgent_tier_idx" ON "KamnetAgent"("tier");

-- CreateIndex
CREATE INDEX "KamnetAgent_sponsorId_idx" ON "KamnetAgent"("sponsorId");

-- CreateIndex
CREATE INDEX "KamnetApplication_status_idx" ON "KamnetApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "KamnetApplication_userId_key" ON "KamnetApplication"("userId");

-- CreateIndex
CREATE INDEX "KamnetCommission_agentId_idx" ON "KamnetCommission"("agentId");

-- CreateIndex
CREATE INDEX "KamnetCommission_status_idx" ON "KamnetCommission"("status");

-- CreateIndex
CREATE INDEX "KamnetLead_agentId_idx" ON "KamnetLead"("agentId");

-- CreateIndex
CREATE INDEX "KamnetLead_status_idx" ON "KamnetLead"("status");

-- AddForeignKey
ALTER TABLE "KamnetAgent" ADD CONSTRAINT "KamnetAgent_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "KamnetAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KamnetCommission" ADD CONSTRAINT "KamnetCommission_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "KamnetAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KamnetLead" ADD CONSTRAINT "KamnetLead_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "KamnetAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


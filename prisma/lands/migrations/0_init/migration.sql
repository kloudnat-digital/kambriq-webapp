-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LandLabelCodes" AS ENUM ('TFL', 'VEFL', 'VEFIL');

-- CreateEnum
CREATE TYPE "LandStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LandOwnerType" AS ENUM ('PARTNER', 'KAMBRIQ');

-- CreateEnum
CREATE TYPE "LandMediaType" AS ENUM ('IMAGE', 'VIDEO', 'MAP');

-- CreateEnum
CREATE TYPE "LandDocumentType" AS ENUM ('TITLE_DEED', 'SURVEY', 'PERMIT', 'RECEIPT', 'OTHER');

-- CreateEnum
CREATE TYPE "LandReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LandClientDocumentType" AS ENUM ('ID_CARD', 'PROOF_OF_ADDRESS', 'OTHER');

-- CreateTable
CREATE TABLE "LandLabel" (
    "id" TEXT NOT NULL,
    "code" "LandLabelCodes" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Land" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "city" TEXT,
    "neighborhood" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "sizeM2" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "labelId" TEXT NOT NULL,
    "status" "LandStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "pv" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "ownerType" "LandOwnerType" NOT NULL DEFAULT 'KAMBRIQ',
    "partnerId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verificationRef" TEXT,
    "titleNumber" TEXT,
    "surfaceTitle" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Land_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandMedia" (
    "id" TEXT NOT NULL,
    "landId" TEXT NOT NULL,
    "type" "LandMediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandDocument" (
    "id" TEXT NOT NULL,
    "landId" TEXT NOT NULL,
    "type" "LandDocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandClientDocument" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "type" "LandClientDocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "rejectionReason" TEXT,

    CONSTRAINT "LandClientDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandReservation" (
    "id" TEXT NOT NULL,
    "landId" TEXT NOT NULL,
    "agentUserId" TEXT NOT NULL,
    "clientUserId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "clientPhone" TEXT,
    "status" "LandReservationStatus" NOT NULL DEFAULT 'PENDING',
    "downPaymentAmount" DOUBLE PRECISION,
    "downPaymentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "documentsReceivedAt" TIMESTAMP(3),
    "documentsReceivedBy" TEXT,
    "remainingPaymentConfirmedAt" TIMESTAMP(3),
    "remainingPaymentConfirmedBy" TEXT,
    "dossierStartedAt" TIMESTAMP(3),
    "dossierStartedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandPriceHistory" (
    "id" TEXT NOT NULL,
    "landId" TEXT NOT NULL,
    "previousPrice" DOUBLE PRECISION NOT NULL,
    "newPrice" DOUBLE PRECISION NOT NULL,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LandLabel_code_key" ON "LandLabel"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Land_slug_key" ON "Land"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Land_titleNumber_key" ON "Land"("titleNumber");

-- CreateIndex
CREATE INDEX "Land_status_idx" ON "Land"("status");

-- CreateIndex
CREATE INDEX "Land_region_idx" ON "Land"("region");

-- CreateIndex
CREATE INDEX "Land_labelId_idx" ON "Land"("labelId");

-- CreateIndex
CREATE INDEX "Land_price_idx" ON "Land"("price");

-- CreateIndex
CREATE INDEX "LandMedia_landId_idx" ON "LandMedia"("landId");

-- CreateIndex
CREATE INDEX "LandDocument_landId_idx" ON "LandDocument"("landId");

-- CreateIndex
CREATE INDEX "LandClientDocument_reservationId_type_idx" ON "LandClientDocument"("reservationId", "type");

-- CreateIndex
CREATE INDEX "LandClientDocument_reservationId_idx" ON "LandClientDocument"("reservationId");

-- CreateIndex
CREATE INDEX "LandReservation_agentUserId_idx" ON "LandReservation"("agentUserId");

-- CreateIndex
CREATE INDEX "LandReservation_status_idx" ON "LandReservation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LandReservation_landId_key" ON "LandReservation"("landId") WHERE ("status" != 'CANCELLED');

-- CreateIndex
CREATE INDEX "LandPriceHistory_landId_idx" ON "LandPriceHistory"("landId");

-- AddForeignKey
ALTER TABLE "Land" ADD CONSTRAINT "Land_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "LandLabel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandMedia" ADD CONSTRAINT "LandMedia_landId_fkey" FOREIGN KEY ("landId") REFERENCES "Land"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandDocument" ADD CONSTRAINT "LandDocument_landId_fkey" FOREIGN KEY ("landId") REFERENCES "Land"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandClientDocument" ADD CONSTRAINT "LandClientDocument_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "LandReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandReservation" ADD CONSTRAINT "LandReservation_landId_fkey" FOREIGN KEY ("landId") REFERENCES "Land"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandPriceHistory" ADD CONSTRAINT "LandPriceHistory_landId_fkey" FOREIGN KEY ("landId") REFERENCES "Land"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


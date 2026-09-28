-- C24 - bounces and complaints SES reports for messages the API sent.
--
-- One row per recipient per SES feedback id, so a redelivered SNS notification
-- is stored once. userId is set when the address belongs to an account.

-- CreateEnum
CREATE TYPE "EmailDeliveryEventKind" AS ENUM ('BOUNCE', 'COMPLAINT');

-- CreateTable
CREATE TABLE "EmailDeliveryEvent" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "kind" "EmailDeliveryEventKind" NOT NULL,
    "type" TEXT,
    "subType" TEXT,
    "sesMessageId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "EmailDeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailDeliveryEvent_userId_occurredAt_idx" ON "EmailDeliveryEvent"("userId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDeliveryEvent_feedbackId_email_key" ON "EmailDeliveryEvent"("feedbackId", "email");

-- AddForeignKey
ALTER TABLE "EmailDeliveryEvent" ADD CONSTRAINT "EmailDeliveryEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


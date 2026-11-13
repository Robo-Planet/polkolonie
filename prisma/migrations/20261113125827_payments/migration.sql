-- CreateEnum
CREATE TYPE "ChargeKind" AS ENUM ('ZALICZKA', 'DOPLATA', 'CALOSC');

-- CreateEnum
CREATE TYPE "BankSource" AS ENUM ('ALERT', 'CSV', 'MANUAL');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('UNMATCHED', 'PARTIAL', 'MATCHED');

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" "ChargeKind" NOT NULL,
    "amountGrosze" INTEGER NOT NULL,
    "paidGrosze" INTEGER NOT NULL DEFAULT 0,
    "dueDate" DATE NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "source" "BankSource" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "bookedAt" TIMESTAMP(3) NOT NULL,
    "amountGrosze" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "recipientAccount" TEXT NOT NULL,
    "messageId" TEXT,
    "matchStatus" "MatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "applicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amountGrosze" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Charge_applicationId_kind_key" ON "Charge"("applicationId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_dedupeKey_key" ON "BankTransaction"("dedupeKey");

-- CreateIndex
CREATE INDEX "BankTransaction_matchStatus_idx" ON "BankTransaction"("matchStatus");

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "BankTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

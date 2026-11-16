-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "summaryAckAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Signature" ADD COLUMN     "kartaSha256" TEXT;


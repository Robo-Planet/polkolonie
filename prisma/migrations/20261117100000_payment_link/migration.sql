-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "paymentLinkTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Application_paymentLinkTokenHash_key" ON "Application"("paymentLinkTokenHash");


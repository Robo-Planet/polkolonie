-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "contractSignatureSha256" TEXT,
ADD COLUMN     "contractSignedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SignCode" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "codeConfirmedAt" TIMESTAMP(3),
    "pdfSha256" TEXT NOT NULL,
    "signatureImageEnc" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignCode_applicationId_createdAt_idx" ON "SignCode"("applicationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Signature_applicationId_key" ON "Signature"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_applicationId_kind_key" ON "Document"("applicationId", "kind");

-- AddForeignKey
ALTER TABLE "SignCode" ADD CONSTRAINT "SignCode_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


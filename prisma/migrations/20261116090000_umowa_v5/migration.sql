-- AlterTable
ALTER TABLE "Application" DROP COLUMN "birthDate",
ADD COLUMN     "contractTemplateSha256" TEXT,
ADD COLUMN     "contractTemplateVersion" INTEGER,
ADD COLUMN     "parentPeselEnc" TEXT;

-- AlterTable
ALTER TABLE "Organizer" ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "regon" TEXT,
ADD COLUMN     "representative" TEXT;


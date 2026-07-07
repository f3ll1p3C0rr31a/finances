CREATE TYPE "PixKeyType" AS ENUM ('PHONE', 'CPF', 'CNPJ', 'EMAIL', 'RANDOM');
CREATE TYPE "Currency" AS ENUM ('BRL', 'USD');

ALTER TABLE "PixKey"
ADD COLUMN "keyType" "PixKeyType",
ADD COLUMN "destinationBankName" TEXT,
ADD COLUMN "destinationBankCode" TEXT;

ALTER TABLE "ExpenseEntry"
ADD COLUMN "externalLink" TEXT,
ADD COLUMN "attachmentFileName" TEXT,
ADD COLUMN "attachmentPath" TEXT,
ADD COLUMN "attachmentUploadedAt" TIMESTAMP(3);

ALTER TABLE "Subscription"
ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'BRL',
ADD COLUMN "originalAmount" DECIMAL(12,2),
ADD COLUMN "exchangeRate" DECIMAL(12,4);

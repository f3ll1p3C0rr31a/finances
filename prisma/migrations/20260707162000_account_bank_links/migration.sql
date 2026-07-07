ALTER TABLE "Account"
ADD COLUMN "bankName" TEXT,
ADD COLUMN "bankCode" TEXT,
ADD COLUMN "agency" TEXT,
ADD COLUMN "accountNumber" TEXT,
ADD COLUMN "accountDigit" TEXT,
ADD COLUMN "accountType" TEXT,
ADD COLUMN "holderName" TEXT;

ALTER TABLE "Card" ADD COLUMN "accountId" TEXT;
ALTER TABLE "PixKey" ADD COLUMN "accountId" TEXT;

CREATE INDEX "Card_accountId_idx" ON "Card"("accountId");
CREATE INDEX "PixKey_accountId_idx" ON "PixKey"("accountId");

ALTER TABLE "Card"
ADD CONSTRAINT "Card_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PixKey"
ADD CONSTRAINT "PixKey_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

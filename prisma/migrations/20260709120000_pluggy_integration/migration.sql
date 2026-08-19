CREATE TYPE "PluggyAccountType" AS ENUM ('BANK', 'CREDIT');
CREATE TYPE "PluggyImportTarget" AS ENUM ('EXPENSE', 'INCOME', 'CARD_PURCHASE');

CREATE TABLE "PluggyConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "connectorId" INTEGER NOT NULL,
    "connectorName" TEXT NOT NULL,
    "connectorImageUrl" TEXT,
    "status" TEXT NOT NULL,
    "executionStatus" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluggyConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PluggyConnection_itemId_key" ON "PluggyConnection"("itemId");
CREATE INDEX "PluggyConnection_userId_idx" ON "PluggyConnection"("userId");

CREATE TABLE "PluggyAccountLink" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "pluggyAccountId" TEXT NOT NULL,
    "type" "PluggyAccountType" NOT NULL,
    "name" TEXT NOT NULL,
    "numberLast4" TEXT,
    "accountId" TEXT,
    "cardId" TEXT,
    "includeInBalance" BOOLEAN NOT NULL DEFAULT true,
    "lastBalance" DECIMAL(12,2),
    "lastBalanceAt" TIMESTAMP(3),
    "transactionsSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PluggyAccountLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PluggyAccountLink_pluggyAccountId_key" ON "PluggyAccountLink"("pluggyAccountId");
CREATE UNIQUE INDEX "PluggyAccountLink_accountId_key" ON "PluggyAccountLink"("accountId");
CREATE UNIQUE INDEX "PluggyAccountLink_cardId_key" ON "PluggyAccountLink"("cardId");
CREATE INDEX "PluggyAccountLink_connectionId_idx" ON "PluggyAccountLink"("connectionId");

CREATE TABLE "PluggyImportedTransaction" (
    "id" TEXT NOT NULL,
    "accountLinkId" TEXT NOT NULL,
    "pluggyTransactionId" TEXT NOT NULL,
    "targetType" "PluggyImportTarget" NOT NULL,
    "targetId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "transactionDate" DATE NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PluggyImportedTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PluggyImportedTransaction_pluggyTransactionId_key" ON "PluggyImportedTransaction"("pluggyTransactionId");
CREATE INDEX "PluggyImportedTransaction_accountLinkId_idx" ON "PluggyImportedTransaction"("accountLinkId");
CREATE INDEX "PluggyImportedTransaction_targetId_idx" ON "PluggyImportedTransaction"("targetId");

ALTER TABLE "PluggyConnection" ADD CONSTRAINT "PluggyConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PluggyAccountLink" ADD CONSTRAINT "PluggyAccountLink_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "PluggyConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PluggyAccountLink" ADD CONSTRAINT "PluggyAccountLink_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PluggyAccountLink" ADD CONSTRAINT "PluggyAccountLink_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PluggyImportedTransaction" ADD CONSTRAINT "PluggyImportedTransaction_accountLinkId_fkey" FOREIGN KEY ("accountLinkId") REFERENCES "PluggyAccountLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

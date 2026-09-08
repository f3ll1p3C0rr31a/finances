-- A one-off debt split into a fixed number of monthly payments. Every
-- installment is materialized as its own ExpenseEntry up front, the same
-- way a CardPurchase materializes CardInstallment rows.
CREATE TABLE "ExpenseInstallmentPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "startMonth" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseInstallmentPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExpenseInstallmentPlan_userId_idx" ON "ExpenseInstallmentPlan"("userId");

ALTER TABLE "ExpenseInstallmentPlan" ADD CONSTRAINT "ExpenseInstallmentPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExpenseEntry"
ADD COLUMN "boletoNumber" TEXT,
ADD COLUMN "installmentPlanId" TEXT,
ADD COLUMN "installmentNo" INTEGER;

CREATE INDEX "ExpenseEntry_installmentPlanId_idx" ON "ExpenseEntry"("installmentPlanId");

ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_installmentPlanId_fkey" FOREIGN KEY ("installmentPlanId") REFERENCES "ExpenseInstallmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

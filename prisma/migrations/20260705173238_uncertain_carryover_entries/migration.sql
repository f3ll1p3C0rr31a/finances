-- AlterTable
ALTER TABLE "ExpenseEntry" ADD COLUMN     "uncertain" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "IncomeEntry" ADD COLUMN     "uncertain" BOOLEAN NOT NULL DEFAULT false;

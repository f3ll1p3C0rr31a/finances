-- CreateEnum
CREATE TYPE "DueDayType" AS ENUM ('CALENDAR_DAY', 'BUSINESS_DAY');

-- AlterTable
ALTER TABLE "ExpenseEntry" ADD COLUMN     "dueDayType" "DueDayType" NOT NULL DEFAULT 'CALENDAR_DAY',
ADD COLUMN     "dueDayValue" INTEGER;

-- AlterTable
ALTER TABLE "ExpenseTemplate" ADD COLUMN     "dueDayType" "DueDayType" NOT NULL DEFAULT 'CALENDAR_DAY';

-- AlterTable
ALTER TABLE "IncomeEntry" ADD COLUMN     "dueDayType" "DueDayType" NOT NULL DEFAULT 'CALENDAR_DAY',
ADD COLUMN     "dueDayValue" INTEGER;

-- AlterTable
ALTER TABLE "IncomeTemplate" ADD COLUMN     "dueDayType" "DueDayType" NOT NULL DEFAULT 'CALENDAR_DAY';

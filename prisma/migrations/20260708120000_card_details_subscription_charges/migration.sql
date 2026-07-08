ALTER TABLE "Card"
ADD COLUMN "cardNumber" TEXT,
ADD COLUMN "cvv" TEXT,
ADD COLUMN "expiryMonth" INTEGER,
ADD COLUMN "expiryYear" INTEGER;

ALTER TABLE "Subscription"
ADD COLUMN "chargeDay" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "logoDomain" TEXT,
ADD COLUMN "cancelledAt" DATE;

-- The old month-based cancellation ("cancelling in X still bills X")
-- maps to a date-based cutoff at the last day of that month.
UPDATE "Subscription"
SET "cancelledAt" = ("cancelledMonth" + INTERVAL '1 month' - INTERVAL '1 day')::date
WHERE "cancelledMonth" IS NOT NULL;

ALTER TABLE "Subscription" DROP COLUMN "cancelledMonth";

CREATE TABLE "SubscriptionCharge" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "chargeDate" DATE NOT NULL,
    "month" DATE NOT NULL,
    "billingMonth" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionCharge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionCharge_subscriptionId_month_key" ON "SubscriptionCharge"("subscriptionId", "month");

CREATE INDEX "SubscriptionCharge_billingMonth_idx" ON "SubscriptionCharge"("billingMonth");

ALTER TABLE "SubscriptionCharge" ADD CONSTRAINT "SubscriptionCharge_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Card" ADD COLUMN "paymentDay" INTEGER;

ALTER TABLE "CardPurchase" ADD COLUMN "billingMonth" DATE;

UPDATE "CardPurchase"
SET "billingMonth" = date_trunc('month', "purchaseDate")::date
WHERE "billingMonth" IS NULL;

CREATE INDEX "CardPurchase_cardId_billingMonth_idx" ON "CardPurchase"("cardId", "billingMonth");

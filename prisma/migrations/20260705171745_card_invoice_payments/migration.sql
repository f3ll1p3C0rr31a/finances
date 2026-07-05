-- CreateTable
CREATE TABLE "CardInvoicePayment" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "paidAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardInvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardInvoicePayment_month_idx" ON "CardInvoicePayment"("month");

-- CreateIndex
CREATE UNIQUE INDEX "CardInvoicePayment_cardId_month_key" ON "CardInvoicePayment"("cardId", "month");

-- AddForeignKey
ALTER TABLE "CardInvoicePayment" ADD CONSTRAINT "CardInvoicePayment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

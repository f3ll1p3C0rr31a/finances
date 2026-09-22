-- Mês em que um lançamento recorrente foi excluído só naquele mês. Sem esse
-- registro, ensureTemplateEntries() recriaria a ocorrência no carregamento
-- seguinte e a exclusão pareceria não ter funcionado.
CREATE TABLE "IncomeTemplateSkip" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomeTemplateSkip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpenseTemplateSkip" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseTemplateSkip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IncomeTemplateSkip_templateId_month_key" ON "IncomeTemplateSkip"("templateId", "month");

CREATE UNIQUE INDEX "ExpenseTemplateSkip_templateId_month_key" ON "ExpenseTemplateSkip"("templateId", "month");

ALTER TABLE "IncomeTemplateSkip" ADD CONSTRAINT "IncomeTemplateSkip_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "IncomeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExpenseTemplateSkip" ADD CONSTRAINT "ExpenseTemplateSkip_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ExpenseTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

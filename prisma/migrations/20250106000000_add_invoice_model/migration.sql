-- CreateEnum: InvoiceType
CREATE TYPE "InvoiceType" AS ENUM ('ACOMPTE', 'FINAL');

-- CreateTable: Invoice
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL DEFAULT 'FINAL',
    "amountTTC" DECIMAL(18,2) NOT NULL,
    "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0.27,
    "invoiceUrl" TEXT,
    "invoiceNumber" TEXT,
    "opportunityId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Payment - Add invoiceId
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;

-- AddForeignKey: Invoice -> Opportunity
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_opportunityId_fkey" 
    FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Payment -> Invoice
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" 
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") 
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: Invoice.opportunityId
CREATE INDEX IF NOT EXISTS "Invoice_opportunityId_idx" ON "Invoice"("opportunityId");

-- CreateIndex: Payment.invoiceId
CREATE INDEX IF NOT EXISTS "Payment_invoiceId_idx" ON "Payment"("invoiceId");

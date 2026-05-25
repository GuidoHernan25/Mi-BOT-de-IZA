-- CreateTable
CREATE TABLE "SheetMovement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stockItemId" TEXT,
    "direction" "ScanDirection" NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "eventName" TEXT,
    "barcode" TEXT NOT NULL,
    "detectedType" TEXT,
    "validation" TEXT,
    "sourceSheet" TEXT NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SheetMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SheetMovement_organizationId_barcode_idx" ON "SheetMovement"("organizationId", "barcode");

-- CreateIndex
CREATE INDEX "SheetMovement_organizationId_eventName_idx" ON "SheetMovement"("organizationId", "eventName");

-- CreateIndex
CREATE UNIQUE INDEX "SheetMovement_organizationId_sourceSheet_sourceRow_key" ON "SheetMovement"("organizationId", "sourceSheet", "sourceRow");

-- AddForeignKey
ALTER TABLE "SheetMovement" ADD CONSTRAINT "SheetMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetMovement" ADD CONSTRAINT "SheetMovement_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

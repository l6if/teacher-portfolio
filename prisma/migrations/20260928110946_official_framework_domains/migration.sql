-- AlterTable
ALTER TABLE "Achievement" ADD COLUMN     "criterionId" TEXT,
ADD COLUMN     "domainId" TEXT,
ADD COLUMN     "subCriterionId" TEXT;

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "officialCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
    "schoolId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Criterion" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "officialCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Criterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubCriterion" (
    "id" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "officialCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Domain_officialCode_key" ON "Domain"("officialCode");

-- CreateIndex
CREATE INDEX "Domain_isOfficial_sortOrder_idx" ON "Domain"("isOfficial", "sortOrder");

-- CreateIndex
CREATE INDEX "Domain_scope_schoolId_idx" ON "Domain"("scope", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Criterion_officialCode_key" ON "Criterion"("officialCode");

-- CreateIndex
CREATE INDEX "Criterion_domainId_sortOrder_idx" ON "Criterion"("domainId", "sortOrder");

-- CreateIndex
CREATE INDEX "Criterion_isOfficial_idx" ON "Criterion"("isOfficial");

-- CreateIndex
CREATE UNIQUE INDEX "SubCriterion_officialCode_key" ON "SubCriterion"("officialCode");

-- CreateIndex
CREATE INDEX "SubCriterion_criterionId_sortOrder_idx" ON "SubCriterion"("criterionId", "sortOrder");

-- CreateIndex
CREATE INDEX "SubCriterion_isOfficial_idx" ON "SubCriterion"("isOfficial");

-- AddForeignKey
ALTER TABLE "Criterion" ADD CONSTRAINT "Criterion_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubCriterion" ADD CONSTRAINT "SubCriterion_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "Criterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "Criterion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_subCriterionId_fkey" FOREIGN KEY ("subCriterionId") REFERENCES "SubCriterion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

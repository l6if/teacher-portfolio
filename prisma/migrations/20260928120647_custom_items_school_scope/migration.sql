-- AlterTable
ALTER TABLE "Criterion" ADD COLUMN     "schoolId" TEXT;

-- AlterTable
ALTER TABLE "SubCriterion" ADD COLUMN     "schoolId" TEXT;

-- CreateIndex
CREATE INDEX "Criterion_schoolId_idx" ON "Criterion"("schoolId");

-- CreateIndex
CREATE INDEX "SubCriterion_schoolId_idx" ON "SubCriterion"("schoolId");

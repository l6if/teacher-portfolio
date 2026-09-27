-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TEACHER',
    "school" TEXT,
    "subject" TEXT,
    "qualification" TEXT,
    "experienceYears" INTEGER,
    "stage" TEXT,
    "classes" TEXT,
    "licenseNumber" TEXT,
    "duties" TEXT,
    "photoUrl" TEXT,
    "educationAdmin" TEXT,
    "educationOffice" TEXT,
    "principalName" TEXT,
    "weeklyLoad" INTEGER,
    "schedule" TEXT,
    "committees" TEXT,
    "extraDuties" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "indicator" TEXT,
    "targetValue" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "scope" TEXT NOT NULL DEFAULT 'YEAR',
    "userId" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "field" TEXT,
    "date" TIMESTAMP(3),
    "description" TEXT,
    "goalText" TEXT,
    "execution" TEXT,
    "beneficiaries" TEXT,
    "results" TEXT,
    "impact" TEXT,
    "notes" TEXT,
    "problem" TEXT,
    "actions" TEXT,
    "durationText" TEXT,
    "provider" TEXT,
    "hours" DOUBLE PRECISION,
    "studentsCount" INTEGER,
    "beneficiariesCount" INTEGER,
    "preScore" DOUBLE PRECISION,
    "postScore" DOUBLE PRECISION,
    "keywords" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "goalId" TEXT,
    "userId" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "url" TEXT,
    "keywords" TEXT,
    "storagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceLink" (
    "id" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "achievementId" TEXT,
    "goalId" TEXT,

    CONSTRAINT "EvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reflection" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL DEFAULT 'TERM1',
    "success" TEXT,
    "practice" TEXT,
    "develop" TEXT,
    "nextTerm" TEXT,
    "userId" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reflection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevPlan" (
    "id" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "action" TEXT,
    "period" TEXT,
    "indicator" TEXT,
    "result" TEXT,
    "userId" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "AcademicYear_userId_idx" ON "AcademicYear"("userId");

-- CreateIndex
CREATE INDEX "AcademicYear_userId_archived_idx" ON "AcademicYear"("userId", "archived");

-- CreateIndex
CREATE INDEX "Goal_userId_yearId_idx" ON "Goal"("userId", "yearId");

-- CreateIndex
CREATE INDEX "Achievement_userId_yearId_idx" ON "Achievement"("userId", "yearId");

-- CreateIndex
CREATE INDEX "Achievement_yearId_type_idx" ON "Achievement"("yearId", "type");

-- CreateIndex
CREATE INDEX "Achievement_goalId_idx" ON "Achievement"("goalId");

-- CreateIndex
CREATE INDEX "Achievement_status_idx" ON "Achievement"("status");

-- CreateIndex
CREATE INDEX "Attachment_userId_yearId_idx" ON "Attachment"("userId", "yearId");

-- CreateIndex
CREATE INDEX "EvidenceLink_achievementId_idx" ON "EvidenceLink"("achievementId");

-- CreateIndex
CREATE INDEX "EvidenceLink_goalId_idx" ON "EvidenceLink"("goalId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceLink_attachmentId_achievementId_key" ON "EvidenceLink"("attachmentId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceLink_attachmentId_goalId_key" ON "EvidenceLink"("attachmentId", "goalId");

-- CreateIndex
CREATE INDEX "Reflection_userId_yearId_idx" ON "Reflection"("userId", "yearId");

-- CreateIndex
CREATE UNIQUE INDEX "Reflection_userId_yearId_term_key" ON "Reflection"("userId", "yearId", "term");

-- CreateIndex
CREATE INDEX "DevPlan_userId_yearId_idx" ON "DevPlan"("userId", "yearId");

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reflection" ADD CONSTRAINT "Reflection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reflection" ADD CONSTRAINT "Reflection_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevPlan" ADD CONSTRAINT "DevPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevPlan" ADD CONSTRAINT "DevPlan_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;


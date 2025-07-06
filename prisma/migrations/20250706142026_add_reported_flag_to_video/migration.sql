-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "reported" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reportedAt" TIMESTAMP(3),
ADD COLUMN     "reportedBy" TEXT;

-- CreateIndex
CREATE INDEX "Video_reported_createdAt_idx" ON "Video"("reported", "createdAt");

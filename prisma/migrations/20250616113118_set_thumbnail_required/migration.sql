/*
  Warnings:

  - Made the column `thumbnailPath` on table `Video` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Video" ALTER COLUMN "thumbnailPath" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Video_userId_createdAt_idx" ON "Video"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Video_status_createdAt_idx" ON "Video"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VideoEvent_eventId_addedAt_idx" ON "VideoEvent"("eventId", "addedAt");

/*
  Warnings:

  - You are about to drop the column `eventId` on the `Video` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[storagePath]` on the table `Video` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Video" DROP CONSTRAINT "Video_eventId_fkey";

-- AlterTable
ALTER TABLE "Video" DROP COLUMN "eventId";

-- CreateTable
CREATE TABLE "VideoEvent" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoEvent_videoId_idx" ON "VideoEvent"("videoId");

-- CreateIndex
CREATE INDEX "VideoEvent_eventId_idx" ON "VideoEvent"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoEvent_videoId_eventId_key" ON "VideoEvent"("videoId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Video_storagePath_key" ON "Video"("storagePath");

-- AddForeignKey
ALTER TABLE "VideoEvent" ADD CONSTRAINT "VideoEvent_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoEvent" ADD CONSTRAINT "VideoEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

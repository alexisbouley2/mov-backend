/*
  Warnings:

  - You are about to drop the column `photoStoragePath` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `photoThumbnailPath` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `photoStoragePath` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `photoThumbnailPath` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `storagePath` on the `Video` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[coverImagePath]` on the table `Event` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[coverThumbnailPath]` on the table `Event` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[profileImagePath]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[profileThumbnailPath]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[videoPath]` on the table `Video` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[thumbnailPath]` on the table `Video` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `videoPath` to the `Video` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Video_storagePath_key";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "photoStoragePath",
DROP COLUMN "photoThumbnailPath",
ADD COLUMN     "coverImagePath" TEXT,
ADD COLUMN     "coverThumbnailPath" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "photoStoragePath",
DROP COLUMN "photoThumbnailPath",
ADD COLUMN     "profileImagePath" TEXT,
ADD COLUMN     "profileThumbnailPath" TEXT;

-- AlterTable
ALTER TABLE "Video" DROP COLUMN "storagePath",
ADD COLUMN     "videoPath" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Event_coverImagePath_key" ON "Event"("coverImagePath");

-- CreateIndex
CREATE UNIQUE INDEX "Event_coverThumbnailPath_key" ON "Event"("coverThumbnailPath");

-- CreateIndex
CREATE UNIQUE INDEX "User_profileImagePath_key" ON "User"("profileImagePath");

-- CreateIndex
CREATE UNIQUE INDEX "User_profileThumbnailPath_key" ON "User"("profileThumbnailPath");

-- CreateIndex
CREATE UNIQUE INDEX "Video_videoPath_key" ON "Video"("videoPath");

-- CreateIndex
CREATE UNIQUE INDEX "Video_thumbnailPath_key" ON "Video"("thumbnailPath");

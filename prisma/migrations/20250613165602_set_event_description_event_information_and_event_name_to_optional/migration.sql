/*
  Warnings:

  - You are about to drop the column `description` on the `Event` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Event" DROP COLUMN "description",
ADD COLUMN     "information" TEXT,
ALTER COLUMN "name" DROP NOT NULL;

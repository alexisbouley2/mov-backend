/*
  Warnings:

  - You are about to drop the column `used` on the `EventInvite` table. All the data in the column will be lost.
  - You are about to drop the column `usedAt` on the `EventInvite` table. All the data in the column will be lost.
  - You are about to drop the column `usedBy` on the `EventInvite` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "EventInvite_used_idx";

-- AlterTable
ALTER TABLE "EventInvite" DROP COLUMN "used",
DROP COLUMN "usedAt",
DROP COLUMN "usedBy";

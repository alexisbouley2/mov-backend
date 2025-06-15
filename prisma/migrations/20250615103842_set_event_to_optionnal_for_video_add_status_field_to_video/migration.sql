-- DropForeignKey
ALTER TABLE "Video" DROP CONSTRAINT "Video_eventId_fkey";

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending',
ALTER COLUMN "eventId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

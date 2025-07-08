-- AlterTable
ALTER TABLE "EventParticipant" ADD COLUMN     "confirmed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "EventParticipant_eventId_confirmed_idx" ON "EventParticipant"("eventId", "confirmed");

-- CreateTable
CREATE TABLE "EventInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "usedBy" TEXT,

    CONSTRAINT "EventInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventInvite_token_key" ON "EventInvite"("token");

-- CreateIndex
CREATE INDEX "EventInvite_eventId_idx" ON "EventInvite"("eventId");

-- CreateIndex
CREATE INDEX "EventInvite_token_idx" ON "EventInvite"("token");

-- CreateIndex
CREATE INDEX "EventInvite_expiresAt_idx" ON "EventInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "EventInvite_used_idx" ON "EventInvite"("used");

-- AddForeignKey
ALTER TABLE "EventInvite" ADD CONSTRAINT "EventInvite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

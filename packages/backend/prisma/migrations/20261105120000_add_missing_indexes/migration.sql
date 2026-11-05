-- CreateIndex
CREATE INDEX "challenge_participants_userId_idx" ON "challenge_participants"("userId");

-- CreateIndex
CREATE INDEX "challenges_endedAt_endDate_idx" ON "challenges"("endedAt", "endDate");

-- CreateIndex
CREATE INDEX "habits_userId_isActive_idx" ON "habits"("userId", "isActive");

-- CreateIndex
CREATE INDEX "kudos_userId_idx" ON "kudos"("userId");


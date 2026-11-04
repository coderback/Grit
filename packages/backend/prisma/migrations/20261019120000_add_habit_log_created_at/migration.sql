-- AlterTable
ALTER TABLE "habit_logs" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing check-ins have no recorded time, so use the day they were for
UPDATE "habit_logs" SET "createdAt" = "loggedAt";

-- CreateIndex
CREATE INDEX "habit_logs_userId_createdAt_idx" ON "habit_logs"("userId", "createdAt");

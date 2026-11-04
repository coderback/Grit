-- AlterTable
ALTER TABLE "challenges" ADD COLUMN     "endedAt" TIMESTAMP(3),
ALTER COLUMN "type" SET DEFAULT 'active_minutes';


-- Existing challenges were all step challenges
UPDATE "challenges" SET "type" = 'steps' WHERE "type" = 'group_steps';

-- Challenges that already finished shouldn't send results now
UPDATE "challenges" SET "endedAt" = "endDate" WHERE "endDate" <= CURRENT_TIMESTAMP AND "endedAt" IS NULL;

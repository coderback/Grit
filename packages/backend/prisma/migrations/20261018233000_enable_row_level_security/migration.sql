-- All data access goes through the NestJS API, which connects as the table
-- owner and is not affected by row level security. Enabling RLS with no
-- policies blocks direct reads and writes through Supabase's Data API with
-- the public anon key that ships inside the mobile app.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "follows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "food_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kudos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "habits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "habit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "challenge_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_messages" ENABLE ROW LEVEL SECURITY;
-- Prisma's shadow database (used by `prisma migrate dev`) has no migrations
-- table, so only touch it where it exists
DO $$
BEGIN
  IF to_regclass('"_prisma_migrations"') IS NOT NULL THEN
    ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

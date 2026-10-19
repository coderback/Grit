-- CreateTable
CREATE TABLE "workout_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "daysPerWeek" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "days" JSONB NOT NULL,
    "generationDay" TEXT NOT NULL,
    "generationsToday" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workout_plans_userId_key" ON "workout_plans"("userId");

-- AddForeignKey
ALTER TABLE "workout_plans" ADD CONSTRAINT "workout_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same as every other table: only the API (as table owner) may read or write it
ALTER TABLE "workout_plans" ENABLE ROW LEVEL SECURITY;

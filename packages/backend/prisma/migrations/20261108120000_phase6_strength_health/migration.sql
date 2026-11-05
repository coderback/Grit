-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN     "avgHeartRate" INTEGER,
ADD COLUMN     "calorieMethod" TEXT,
ADD COLUMN     "distanceM" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "consentCycleData" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "workout_plans" ADD COLUMN     "nextSession" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "workout_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "activityLogId" TEXT NOT NULL,
    "planSession" INTEGER,
    "title" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "setCount" INTEGER NOT NULL DEFAULT 0,
    "volumeKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sets" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "weightKg" DOUBLE PRECISION,
    "durationSec" INTEGER,
    "rpe" DOUBLE PRECISION,
    "warmup" BOOLEAN NOT NULL DEFAULT false,
    "supersetId" TEXT,
    "pr" TEXT,

    CONSTRAINT "workout_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_metrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "metric" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '',
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "device" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workout_sessions_activityLogId_key" ON "workout_sessions"("activityLogId");

-- CreateIndex
CREATE INDEX "workout_sessions_userId_startedAt_idx" ON "workout_sessions"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "workout_sessions_userId_clientId_key" ON "workout_sessions"("userId", "clientId");

-- CreateIndex
CREATE INDEX "workout_sets_sessionId_idx" ON "workout_sets"("sessionId");

-- CreateIndex
CREATE INDEX "workout_sets_userId_exerciseId_idx" ON "workout_sets"("userId", "exerciseId");

-- CreateIndex
CREATE INDEX "health_metrics_userId_metric_day_idx" ON "health_metrics"("userId", "metric", "day");

-- CreateIndex
CREATE UNIQUE INDEX "health_metrics_userId_day_metric_type_key" ON "health_metrics"("userId", "day", "metric", "type");

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_activityLogId_fkey" FOREIGN KEY ("activityLogId") REFERENCES "activity_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_metrics" ADD CONSTRAINT "health_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same as every other table: only the API (as table owner) may read or write it
ALTER TABLE "workout_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workout_sets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "health_metrics" ENABLE ROW LEVEL SECURITY;

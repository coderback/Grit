-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN     "externalId" TEXT;

-- CreateTable
CREATE TABLE "health_days" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "steps" INTEGER,
    "sleepMinutes" INTEGER,
    "source" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_days_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "health_days_userId_day_key" ON "health_days"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "activity_logs_userId_externalId_key" ON "activity_logs"("userId", "externalId");

-- AddForeignKey
ALTER TABLE "health_days" ADD CONSTRAINT "health_days_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same as every other table: only the API (as table owner) may read or write it
ALTER TABLE "health_days" ENABLE ROW LEVEL SECURITY;

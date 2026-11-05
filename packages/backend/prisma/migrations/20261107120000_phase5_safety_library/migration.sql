-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN     "intensity" TEXT;

-- AlterTable
ALTER TABLE "food_logs" ADD COLUMN     "alcoholG" DOUBLE PRECISION,
ADD COLUMN     "caffeineMg" DOUBLE PRECISION,
ADD COLUMN     "corrected" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "aiConsentAt" TIMESTAMP(3),
ADD COLUMN     "consentFoodData" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentHealthTraining" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentOffSharing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentWorkoutTraining" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "edScreen" TEXT;

-- CreateTable
CREATE TABLE "search_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "position" INTEGER,
    "pickedName" TEXT,
    "country" TEXT,
    "lang" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "primary" TEXT[],
    "secondary" TEXT[],
    "equipment" TEXT[],
    "mechanics" TEXT,
    "level" TEXT,
    "category" TEXT,
    "pattern" TEXT,
    "stresses" TEXT[],
    "instructions" TEXT,
    "imageUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'free-exercise-db',

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_events_createdAt_idx" ON "search_events"("createdAt");

-- CreateIndex
CREATE INDEX "exercises_name_idx" ON "exercises"("name");

-- AddForeignKey
ALTER TABLE "search_events" ADD CONSTRAINT "search_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same as every other table: only the API (as table owner) may read or write it
ALTER TABLE "search_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exercises" ENABLE ROW LEVEL SECURITY;

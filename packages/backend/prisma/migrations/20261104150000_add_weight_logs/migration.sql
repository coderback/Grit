-- CreateTable
CREATE TABLE "weight_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weight_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weight_logs_userId_day_key" ON "weight_logs"("userId", "day");

-- AddForeignKey
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Start everyone's history with the weight already on their profile
INSERT INTO "weight_logs" ("id", "userId", "weightKg", "day", "updatedAt")
SELECT 'wl_' || "id", "id", "weightKg", date_trunc('day', "updatedAt"), CURRENT_TIMESTAMP
FROM "users"
WHERE "weightKg" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Same as every other table: only the API (as table owner) may read or write it
ALTER TABLE "weight_logs" ENABLE ROW LEVEL SECURITY;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "aiParseCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiParseDay" TEXT;

-- CreateTable
CREATE TABLE "food_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kcalPer100g" DOUBLE PRECISION NOT NULL,
    "proteinPer100g" DOUBLE PRECISION NOT NULL,
    "carbsPer100g" DOUBLE PRECISION NOT NULL,
    "fatPer100g" DOUBLE PRECISION NOT NULL,
    "usualGrams" DOUBLE PRECISION NOT NULL,
    "uses" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "food_memories_userId_key_key" ON "food_memories"("userId", "key");

-- AddForeignKey
ALTER TABLE "food_memories" ADD CONSTRAINT "food_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same as every other table: only the API (as table owner) may read or write it
ALTER TABLE "food_memories" ENABLE ROW LEVEL SECURITY;

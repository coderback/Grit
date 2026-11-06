-- Phase 7: GRIT's own food database. Search uses trigram indexes, from the
-- pg_trgm extension, kept in the "extensions" schema as Supabase recommends.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- AlterTable
ALTER TABLE "favorite_foods" ADD COLUMN     "foodId" TEXT,
ADD COLUMN     "grams" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "food_logs" ADD COLUMN     "foodId" TEXT,
ADD COLUMN     "grams" DOUBLE PRECISION,
ADD COLUMN     "nutrients" JSONB;

-- AlterTable
ALTER TABLE "food_memories" ADD COLUMN     "foodId" TEXT;

-- AlterTable
ALTER TABLE "search_events" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'search',
ADD COLUMN     "pickedId" TEXT,
ADD COLUMN     "resultCount" INTEGER;

-- CreateTable
CREATE TABLE "foods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "kind" TEXT NOT NULL,
    "category" TEXT,
    "ingredients" TEXT,
    "countries" TEXT[],
    "quality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "imageUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "foods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_barcodes" (
    "code" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,

    CONSTRAINT "food_barcodes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "food_servings" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,
    "typical" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "food_servings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_nutrients" (
    "foodId" TEXT NOT NULL,
    "nutrient" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "basis" TEXT NOT NULL,
    "low" DOUBLE PRECISION,
    "high" DOUBLE PRECISION,

    CONSTRAINT "food_nutrients_pkey" PRIMARY KEY ("foodId","nutrient")
);

-- CreateTable
CREATE TABLE "food_names" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lang" TEXT NOT NULL,

    CONSTRAINT "food_names_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_sources" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "foods_searchText_idx" ON "foods" USING GIN ("searchText" extensions.gin_trgm_ops);

-- CreateIndex
CREATE INDEX "food_barcodes_foodId_idx" ON "food_barcodes"("foodId");

-- CreateIndex
CREATE UNIQUE INDEX "food_servings_foodId_label_key" ON "food_servings"("foodId", "label");

-- CreateIndex
CREATE INDEX "food_names_name_idx" ON "food_names"("name");

-- CreateIndex
CREATE UNIQUE INDEX "food_names_foodId_lang_name_key" ON "food_names"("foodId", "lang", "name");

-- CreateIndex
CREATE INDEX "food_sources_foodId_idx" ON "food_sources"("foodId");

-- CreateIndex
CREATE UNIQUE INDEX "food_sources_source_externalId_key" ON "food_sources"("source", "externalId");

-- CreateIndex
CREATE INDEX "food_logs_foodId_idx" ON "food_logs"("foodId");

-- AddForeignKey
ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "foods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_foods" ADD CONSTRAINT "favorite_foods_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "foods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_memories" ADD CONSTRAINT "food_memories_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "foods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_barcodes" ADD CONSTRAINT "food_barcodes_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "foods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_servings" ADD CONSTRAINT "food_servings_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "foods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_nutrients" ADD CONSTRAINT "food_nutrients_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "foods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_names" ADD CONSTRAINT "food_names_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "foods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_sources" ADD CONSTRAINT "food_sources_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "foods"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same as every other table: only the API (as table owner) may read or write it
ALTER TABLE "foods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "food_barcodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "food_servings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "food_nutrients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "food_names" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "food_sources" ENABLE ROW LEVEL SECURITY;

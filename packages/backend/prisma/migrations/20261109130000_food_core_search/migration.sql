-- Search over millions of products stays fast by always searching a core
-- set in full (generic foods, dishes, and products GRIT users have logged
-- or scanned) and only sampling the rest.

-- AlterTable
ALTER TABLE "foods" ADD COLUMN     "coreText" TEXT;

-- The core so far: everything that isn't a branded product, and any
-- product someone has logged
UPDATE "foods" SET "coreText" = "searchText" WHERE "kind" <> 'branded' OR "popularity" > 0;

-- CreateIndex
CREATE INDEX "foods_coreText_idx" ON "foods" USING GIN ("coreText" extensions.gin_trgm_ops);

-- CreateTable
CREATE TABLE "favorite_foods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "barcode" TEXT,
    "calories" DOUBLE PRECISION NOT NULL,
    "proteinG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbsG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fatG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "servingQty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "servingUnit" TEXT NOT NULL DEFAULT 'serving',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_foods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "favorite_foods_userId_key_key" ON "favorite_foods"("userId", "key");

-- AddForeignKey
ALTER TABLE "favorite_foods" ADD CONSTRAINT "favorite_foods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same as every other table: only the API (as table owner) may read or write it
ALTER TABLE "favorite_foods" ENABLE ROW LEVEL SECURITY;

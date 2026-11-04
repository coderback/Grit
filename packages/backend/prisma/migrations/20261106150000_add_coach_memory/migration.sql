-- CreateTable
CREATE TABLE "coach_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_memories_userId_createdAt_idx" ON "coach_memories"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "coach_memories" ADD CONSTRAINT "coach_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same as every other table: only the API (as table owner) may read or write it
ALTER TABLE "coach_memories" ENABLE ROW LEVEL SECURITY;

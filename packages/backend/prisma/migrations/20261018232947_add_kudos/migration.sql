-- CreateTable
CREATE TABLE "kudos" (
    "id" TEXT NOT NULL,
    "activityLogId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kudos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kudos_activityLogId_userId_key" ON "kudos"("activityLogId", "userId");

-- AddForeignKey
ALTER TABLE "kudos" ADD CONSTRAINT "kudos_activityLogId_fkey" FOREIGN KEY ("activityLogId") REFERENCES "activity_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kudos" ADD CONSTRAINT "kudos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

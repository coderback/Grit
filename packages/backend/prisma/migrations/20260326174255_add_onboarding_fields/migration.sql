-- AlterTable
ALTER TABLE "users" ADD COLUMN     "activityLevel" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "heightCm" DOUBLE PRECISION;

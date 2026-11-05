-- Push tokens moved to push_devices in Phase 2. Apply this only once every
-- running server is on Phase 3 or later: Phase 2 servers still read the column.
-- AlterTable
ALTER TABLE "users" DROP COLUMN "pushToken";


-- DET v2: additive changes only (safe to run on the live database).
-- Run once in the Supabase SQL editor, or use: npx prisma db push

DO $$ BEGIN
  CREATE TYPE "WorkSection" AS ENUM ('SYSTEMS_ENGINEERING', 'AUTOMATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "GovSimpleStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "section"   "WorkSection"     NOT NULL DEFAULT 'SYSTEMS_ENGINEERING';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "ownerName" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "govStatus" "GovSimpleStatus" NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "govNote"   TEXT;
CREATE INDEX IF NOT EXISTS "orders_section_idx" ON "orders"("section");

ALTER TABLE "order_descriptions" ADD COLUMN IF NOT EXISTS "nextSteps" TEXT;

-- Systems register (projects marked as systems)
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "isSystem"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "systemType"   TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "systemStatus" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "includeInKpi" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "link"         TEXT;

-- Order of the rows in the tracker Excel (lists follow the sheet's order)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "sheetOrder" INTEGER;
CREATE INDEX IF NOT EXISTS "orders_sheetOrder_idx" ON "orders"("sheetOrder");

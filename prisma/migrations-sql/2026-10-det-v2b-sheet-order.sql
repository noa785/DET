-- DET v2 update: keep orders in the Excel row order. Additive, safe to run more than once.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "sheetOrder" INTEGER;
CREATE INDEX IF NOT EXISTS "orders_sheetOrder_idx" ON "orders"("sheetOrder");

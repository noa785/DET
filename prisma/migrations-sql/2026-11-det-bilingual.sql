-- DET bilingual: Arabic fields next to the English ones. Additive only; safe to run more than once.
-- Run this in Supabase > SQL Editor BEFORE publishing the bilingual version of the website.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "govNoteAr" TEXT;
ALTER TABLE "det_governance_items" ADD COLUMN IF NOT EXISTS "titleAr" TEXT;
ALTER TABLE "det_governance_items" ADD COLUMN IF NOT EXISTS "notesAr" TEXT;
SELECT 'orders.govNoteAr' AS added, count(*) FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'govNoteAr'
UNION ALL SELECT 'det_governance_items.titleAr', count(*) FROM information_schema.columns WHERE table_name = 'det_governance_items' AND column_name = 'titleAr'
UNION ALL SELECT 'det_governance_items.notesAr', count(*) FROM information_schema.columns WHERE table_name = 'det_governance_items' AND column_name = 'notesAr';

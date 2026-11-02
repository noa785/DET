-- DET v3: projects per section, and the governance register. Additive only; safe to run more than once.

-- 1. Each project belongs to a work section. Existing projects are Systems Engineering projects.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "section" "WorkSection";
UPDATE "projects" SET "section" = 'SYSTEMS_ENGINEERING' WHERE "section" IS NULL;

-- 2. Governance register: one row per governance item, for a project or for an ELI unit.
CREATE TABLE IF NOT EXISTS "det_governance_items" (
  "id"           TEXT PRIMARY KEY,
  "code"         TEXT NOT NULL UNIQUE,
  "scope"        TEXT NOT NULL,
  "projectId"    TEXT REFERENCES "projects"("id"),
  "unitId"       TEXT REFERENCES "units"("id"),
  "title"        TEXT NOT NULL,
  "type"         TEXT NOT NULL DEFAULT 'OTHER',
  "status"       TEXT NOT NULL DEFAULT 'PLANNED',
  "ownerName"    TEXT,
  "dueDate"      TIMESTAMP(3),
  "lastReview"   TIMESTAMP(3),
  "nextReview"   TIMESTAMP(3),
  "evidenceLink" TEXT,
  "notes"        TEXT,
  "isDeleted"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "det_governance_items_scope_idx"     ON "det_governance_items"("scope");
CREATE INDEX IF NOT EXISTS "det_governance_items_unitId_idx"    ON "det_governance_items"("unitId");
CREATE INDEX IF NOT EXISTS "det_governance_items_projectId_idx" ON "det_governance_items"("projectId");

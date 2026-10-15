-- The committee was renamed: DGCC (Digital Governance & Compliance Committee) is now
-- DTC (Digital Transformation Committee). Moves everything under DGCC to DTC and hides DGCC.
-- Order IDs such as DGCC-T-501 stay as they are. Safe to run more than once.
UPDATE "orders"   SET "unitId" = (SELECT id FROM "units" WHERE code = 'DTC') WHERE "unitId" = (SELECT id FROM "units" WHERE code = 'DGCC');
UPDATE "projects" SET "unitId" = (SELECT id FROM "units" WHERE code = 'DTC') WHERE "unitId" = (SELECT id FROM "units" WHERE code = 'DGCC');
UPDATE "users"    SET "unitId" = (SELECT id FROM "units" WHERE code = 'DTC') WHERE "unitId" = (SELECT id FROM "units" WHERE code = 'DGCC');
UPDATE "units"    SET "isActive" = false WHERE code = 'DGCC';

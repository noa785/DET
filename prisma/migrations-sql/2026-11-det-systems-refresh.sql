-- DET systems: links and summaries updated from the project history (Nov 2026). Safe to run more than once.
-- Run in Supabase > SQL Editor.
BEGIN;
UPDATE "projects" SET "link" = 'https://eli-det.vercel.app', "description" = 'Tracks all digital transformation orders by section, with progress, governance status, two-way Google Sheets sync, Arabic and English, and a one-page KPI report for leadership.' WHERE "isSystem" = true AND "name" = 'Digital Enterprise Tracker';
UPDATE "projects" SET "link" = 'https://elischedule.vercel.app', "description" = 'Pairs each teacher with one observer for a single observation per term, with cross-shift coverage and a fair load across observers; reads the live teaching schedule and publishes only after approval.' WHERE "isSystem" = true AND "name" = 'Observation Distribution System';
UPDATE "projects" SET "link" = 'https://pes-eli.vercel.app', "description" = 'Evaluates faculty performance with the approved v2.0 rubric across the full evaluation cycle, with role-based access, bilingual exports, daily and weekly backups, and admin and coordinator guides.' WHERE "isSystem" = true AND "name" = 'Performance Evaluation System';
UPDATE "projects" SET "link" = 'https://elischedule.vercel.app', "description" = 'Builds term schedules in phases: base schedule, faculty assignment and coverage changes, using the Scheduling Unit rules; the members-only teaching schedule portal shows the published schedule.' WHERE "isSystem" = true AND "name" = 'Academic Scheduling System';
UPDATE "projects" SET "link" = 'https://eli-cts.vercel.app', "description" = 'Tracks weekly curriculum delivery against the pacing guide, with university email sign-in, coordinator team views and an admin KPI dashboard for accreditation; shared for review before rollout.', "systemStatus" = 'PILOT' WHERE "isSystem" = true AND "name" = 'Curriculum Tracking System';
UPDATE "projects" SET "link" = 'https://eli-platform-prototype.vercel.app' WHERE "isSystem" = true AND "name" = 'ELI Platform';
COMMIT;
SELECT "name", "systemStatus", "link" FROM "projects" WHERE "isSystem" = true ORDER BY "name";

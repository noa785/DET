# DET v2: setup steps

DGCC Enterprise Tracker, new interface (October 2026).

## What changed

- **Welcome and sign-in:** new welcome screen, DET diamond logo, PNU logo in the top corner, and email and password sign-in through Supabase, as before.
- **Sidebar:** three sections only.
  1. **Systems Engineering:** All Orders, Grid Editor, Add Order.
  2. **Automation:** All Orders, Grid Editor, Add Order.
  3. **Performance KPIs:** Completion, On time, Governance, one card per section, Needs attention, and two PDF reports. **Summary report** (one page): the KPI (automation of administrative and academic systems) with its actual value, target and formula, and the systems behind it. **Detailed report**: the same KPI with the gap and the yearly targets, the systems with their orders, the work indicators per section, and the orders that need attention.
- **Orders:** each order has four simple states (Not started, In progress, Stuck, Done). It also has description points, an optional narrative, and its own governance field (Not required, Waiting review, Approved) owned by its section.
- **Systems and the strategic indicator:** the KPIs page and the PDF report show every system with its type, status and a short summary. They also show the strategic indicator for automation of administrative and academic systems (Goal 4: 2027 50%, 2028 70%, 2029 85%, 2030 95% or more). The rate is the number of live systems divided by the systems counted in the indicator.
- **Old pages:** the earlier pages (governance, reports, admin and others) are still in the code but no longer appear in the menu. The old menu is kept in `src/components/layout/AppShell.legacy.tsx`.

## 1. Database (one time)

The changes only add columns; nothing is removed. Use either option:

- **Option A:** in the Supabase SQL editor, run `prisma/migrations-sql/2026-10-det-v2.sql`.
- **Option B:** from the project folder, run `npx prisma db push`.

## 2. Install

```bash
npm install
```

This adds `jspdf` and `jspdf-autotable` for the PDF report.

## 3. Load the Excel data

The workbook is at `data/DGCC_Enterprise_Tracker.xlsx`.

Check it first. This writes nothing to the database:

```bash
npm run db:import -- --file data/DGCC_Enterprise_Tracker.xlsx --dry-run
```

Then import:

```bash
npm run db:import -- --file data/DGCC_Enterprise_Tracker.xlsx
```

What the import does:

- **Placement:** all orders go to **Systems Engineering**. Automation starts empty.
- **Descriptions:** each order gets its own description from the sheet `الوصف`: narrative, bullet points, risks and next steps.
- **Matching:** orders are matched by Order ID, so you can run the import again after updating the Excel file.
- **Governance:** a governance status already set in the system is never overwritten.
- **Orders added in the system** (codes SE-0001, AU-0001, ...) are never changed by the import.
- **Re-running the import** updates the Excel orders with the values in the file, so run it again only when the Excel file is the newer source.
- **Removed orders:** add `--hide-missing` to hide Excel orders that were removed from the file (hidden, not deleted).
- **Skipped rows:** rows whose Order ID starts with `PRJ-` are older project-level write-ups and are skipped. Every order already has its own description.

## 3b. Systems register

`data/DET_Systems_Register.xlsx` lists the systems: code, name, type (Administrative or Academic), unit, status (Live, Pilot, In development, Planned), summary, link, the words used to link orders to the system, and whether it counts in the indicator.

It was prefilled from the tracker data. **Please review the status and summary of each system before the first import.** The import reads it automatically. You can also point to another file with `--systems path/to/file.xlsx`.

## 4. Run or deploy

- **Locally:** `npm run dev`, then open http://localhost:3000. The app opens on the welcome screen, and after sign-in it goes to Performance KPIs.
- **Live:** deploy to Vercel as usual. Keep your existing `.env` values. The `.env` file is not included in this package.

## New files

```
src/lib/det/shared.ts          sections, states, governance labels, helpers
src/lib/det/server.ts          loading orders, new order codes (SE-0001, AU-0001)
src/lib/det/report.ts          PDF reports, summary and detailed (IBM Plex font)
src/components/det/ui.tsx      icons, DET logo, rings, bullet editor, governance box
src/components/det/OrderDrawer.tsx
src/app/(protected)/kpis/      Performance KPIs page
src/app/(protected)/work/[section]/        All Orders, grid/, new/
src/app/api/work/orders/       create and update API
src/styles/det.css             all styles (scoped to .det-app and .det-login)
scripts/tracker-parse.ts       Excel reader
scripts/import-tracker.ts      Excel to database import (orders and systems register)
data/DET_Systems_Register.xlsx systems register (review before importing)
public/brand/                  PNU logo, DET logo, report header
public/fonts/                  IBM Plex Sans for the PDF report
```

# DGCC PES — نظام تتبع العمل المؤسسي ✅ كامل Batches 1–5 — Project & Enterprise System

Institutional multi-user system for the Digital Governance & Compliance Committee.

## Stack
- **Next.js 14** (App Router) + TypeScript
- **Supabase** (Auth + PostgreSQL + Storage)
- **Prisma** ORM
- **Tailwind CSS**
- **Zod** validation

---

## Local Setup

### 1. Prerequisites
- Node.js 18+
- A Supabase project (free tier works)

### 2. Install
```bash
cd pes
npm install
```

### 3. Environment
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

### 4. Database
```bash
# Generate Prisma client
npm run db:generate

# Push schema to Supabase (creates all tables)
npm run db:push

# Seed master data (units, lookups, demo users)
npm run db:seed
```

### 5. Supabase Auth Users
Create users manually in Supabase Dashboard → Authentication → Users:
- `admin@dgcc.edu.sa` / `Admin123!`
- `manager@dgcc.edu.sa` / `Manager123!`
- `viewer@dgcc.edu.sa` / `Viewer123!`

Then get each user's UUID and update the `supabase_id` column in the `users` table.

### 6. Run
```bash
npm run dev
# Open http://localhost:3000
```

---

## Project Structure
```
src/
├── app/                        # Next.js App Router
│   ├── auth/login/             # Login page + form
│   ├── dashboard/              # Main dashboard
│   ├── orders/                 # Core tracker
│   ├── governance/             # Governance registry
│   ├── gov-tasks/              # Governance tasks
│   ├── changes/                # Change control
│   ├── weekly-briefs/          # Weekly briefs
│   ├── audit-log/              # Audit log viewer
│   ├── admin/                  # Admin (units, users, lookups)
│   └── api/                    # API route handlers
├── components/
│   ├── ui/                     # Base UI primitives
│   ├── layout/                 # Sidebar, topbar, shell
│   ├── tables/                 # DataGrid, SpreadsheetGrid
│   ├── forms/                  # OrderForm, GovItemForm, etc.
│   └── charts/                 # Dashboard charts
├── lib/
│   ├── supabase/               # Server + browser clients
│   ├── prisma/                 # Prisma singleton
│   ├── auth/                   # Session, requireAuth, can()
│   ├── business-logic/         # RAG, planned%, rollup, reschedule
│   ├── audit/                  # Audit logger
│   └── validation/             # Zod schemas
├── types/                      # All TypeScript types + RBAC
└── middleware.ts                # Route protection
prisma/
└── schema.prisma               # Full DB schema
scripts/
└── seed.ts                     # Master data seed
```

---

## Batches (Delivery Plan)
- ✅ **Batch 1** — Foundation (this batch): package.json, schema, auth, RBAC, middleware, types, seed, login
- 🔲 **Batch 2** — App shell (sidebar, topbar, layout, protected route wrapper)
- 🔲 **Batch 3** — Orders API + DataGrid + CRUD
- 🔲 **Batch 4** — Governance module (items + tasks)
- 🔲 **Batch 5** — Change control + audit log viewer
- 🔲 **Batch 6** — Weekly Briefs module
- 🔲 **Batch 7** — Dashboard + analytics
- 🔲 **Batch 8** — Spreadsheet grid editor
- 🔲 **Batch 9** — Excel import/export
- 🔲 **Batch 10** — Admin (units, users, lookups)

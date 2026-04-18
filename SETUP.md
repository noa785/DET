# DGCC PES — Setup & Deployment Guide
## Version: Batch 3 complete

---

## ⚡ Quick Start (Local)

### 1. Prerequisites
```
node >= 18.17   (check: node --version)
npm  >= 9       (check: npm --version)
```

### 2. Install dependencies
```bash
npm install
```

### 3. Create Supabase project
- Go to https://supabase.com → New Project
- Choose region: ap-southeast-1 (closest to KSA/Gulf)
- Save Database Password

### 4. Configure .env.local
```bash
cp .env.example .env.local
# Then fill in the values (see .env.example for instructions)
```

Required values:
```
NEXT_PUBLIC_SUPABASE_URL        → Supabase → Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   → Supabase → Settings → API → anon key
SUPABASE_SERVICE_ROLE_KEY       → Supabase → Settings → API → service_role key
DATABASE_URL                    → Supabase → Settings → Database → URI (pooled, port 6543)
DIRECT_URL                      → Supabase → Settings → Database → URI (direct, port 5432)
NEXTAUTH_SECRET                 → Run: openssl rand -base64 32
NEXTAUTH_URL                    → http://localhost:3000 (or production URL)
SEED_ADMIN_EMAIL                → admin@dgcc.edu.sa
SEED_ADMIN_PASSWORD             → Admin@DGCC2025!
```

### 5. Push DB schema
```bash
npm run db:generate   # generates Prisma client
npm run db:push       # pushes schema to Supabase
```

### 6. Create Auth users in Supabase
Supabase Dashboard → Authentication → Users → Invite User:
- admin@dgcc.edu.sa
- manager@dgcc.edu.sa
- viewer@dgcc.edu.sa

### 7. Seed master data
```bash
npm run db:seed
```

Then update supabaseId in Supabase SQL Editor:
```sql
UPDATE users SET "supabaseId" = '<UUID-FROM-AUTH>'
WHERE email = 'admin@dgcc.edu.sa';
```

### 8. Run
```bash
npm run dev
# → http://localhost:3000
```

Login: admin@dgcc.edu.sa / Admin@DGCC2025!

---

## 🚀 Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or connect GitHub repo at vercel.com → Import Project.

Add all .env.local variables in Vercel → Project → Settings → Environment Variables.
Change NEXTAUTH_URL to your production URL.

After deploy, update Supabase → Auth → URL Config:
- Site URL: https://your-project.vercel.app
- Redirect URLs: https://your-project.vercel.app/auth/callback

---

## ✅ What works (Batch 1-3)

| Feature | Status |
|---------|--------|
| Auth (Supabase) | ✅ |
| RBAC (7 roles) | ✅ |
| Route protection | ✅ |
| Dashboard | ✅ |
| Orders list | ✅ |
| Order detail (5 tabs) | ✅ |
| Order Description (governance) | ✅ |
| Update Log | ✅ |
| Grid Editor (Excel-like) | ✅ |
| Inline editing (dbl-click/F2) | ✅ |
| Keyboard nav (Tab/Arrow/Esc) | ✅ |
| Optimistic updates + auto-save | ✅ |
| Batch API (/api/orders/batch) | ✅ |
| Audit logging | ✅ |
| 49 units seeded | ✅ |

## 🔲 Remaining batches

| Batch | Feature |
|-------|---------|
| 4 | New Order Form + Edit Form |
| 5 | Governance Module (items + tasks) |
| 6 | Change Control + Audit Log viewer |
| 7 | Weekly Briefs |
| 8 | Analytics/Charts |
| 9 | Import/Export Excel |
| 10 | Admin (units, users, lookups) |

---

## Commands
```bash
npm run dev           # Dev server
npm run build         # Production build
npm run db:generate   # Regen Prisma client
npm run db:push       # Push schema (dev)
npm run db:migrate    # Create migration (prod)
npm run db:seed       # Seed data
npm run db:studio     # Visual DB browser
```

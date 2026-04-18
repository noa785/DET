# DGCC PES — دليل التشغيل والنشر الكامل
## Vercel + Supabase — من الصفر إلى رابط ويب في 30 دقيقة

---

## المتطلبات المسبقة

- حساب GitHub: https://github.com
- حساب Supabase (مجاني): https://supabase.com
- حساب Vercel (مجاني): https://vercel.com
- Node.js 18+ مثبت على جهازك: https://nodejs.org

---

## الخطوة 1 — إعداد Supabase

### 1.1 إنشاء المشروع
1. اذهب إلى https://app.supabase.com
2. اضغط **New project**
3. اختر اسم: `dgcc-pes`
4. اختر كلمة مرور قوية للـ database (احفظها)
5. اختر region: **Middle East (Bahrain)** أو أقرب منطقة
6. اضغط **Create new project** — انتظر ~2 دقيقة

### 1.2 جمع بيانات الاتصال
من **Project Settings → API**:
```
NEXT_PUBLIC_SUPABASE_URL = https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJ...
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJ...  (⚠️ سري — لا تشاركه)
```

من **Project Settings → Database → Connection string (URI)**:
اختر **Transaction pooler** واحفظ الرابط:
```
DATABASE_URL = postgresql://postgres.xxxx:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

اختر **Session pooler** واحفظ الرابط:
```
DIRECT_URL = postgresql://postgres.xxxx:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

### 1.3 تفعيل Email Auth
من **Authentication → Providers → Email**:
- Enable Email provider: ✅
- Confirm email: ❌ (عطّله للبداية)

---

## الخطوة 2 — تجهيز المشروع محلياً

```bash
# استنسخ المشروع أو حمّل الملفات
cd dgcc-pes

# ثبّت الـ packages
npm install

# انسخ ملف البيئة
cp .env.example .env.local
```

### 2.1 تعبئة .env.local
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJ...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...

DATABASE_URL=postgresql://postgres.xxxx:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.xxxx:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres

NEXTAUTH_SECRET=اكتب-هنا-32-حرف-عشوائي-على-الأقل
NEXTAUTH_URL=http://localhost:3000
```

لتوليد NEXTAUTH_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## الخطوة 3 — إعداد قاعدة البيانات

```bash
# توليد Prisma Client
npm run db:generate

# رفع الـ schema إلى Supabase (ينشئ الجداول)
npm run db:push

# تحقق من نجاح العملية — يجب أن ترى جميع الجداول
npx prisma studio
```

إذا نجح db:push، ستظهر هذه الجداول في Supabase:
- orders, units, projects, users
- governance_items, governance_tasks, change_requests
- weekly_briefs, update_logs, order_descriptions
- audit_logs, lookup_values, sequences

---

## الخطوة 4 — إنشاء مستخدمي Demo في Supabase

### 4.1 إنشاء المستخدمين في Supabase Auth
اذهب إلى **Authentication → Users → Add user** وأنشئ:

| Email | Password | Role |
|-------|----------|------|
| admin@dgcc.edu.sa | Admin@1234! | SUPER_ADMIN |
| manager@dgcc.edu.sa | Manager@1234! | UNIT_MANAGER |
| viewer@dgcc.edu.sa | Viewer@1234! | VIEWER |

### 4.2 تشغيل seed البيانات
```bash
# بعد إنشاء المستخدمين في Supabase Auth
npm run db:seed
```

**ملاحظة مهمة:** الـ seed ينشئ:
- 49 وحدة (unit) من DGCC
- تسلسلات الأكواد (ORD-0001, GOV-0001, ...)
- بيانات lookup
- 2 مشروع تجريبي
- 3 مستخدمين demo

### 4.3 ربط Supabase ID بالمستخدمين
بعد تشغيل الـ seed، افتح **Supabase → Authentication → Users** واحفظ الـ UUID لكل مستخدم، ثم في **SQL Editor** نفّذ:

```sql
UPDATE users SET "supabaseId" = 'UUID-الخاص-بـ-admin' WHERE email = 'admin@dgcc.edu.sa';
UPDATE users SET "supabaseId" = 'UUID-الخاص-بـ-manager' WHERE email = 'manager@dgcc.edu.sa';
UPDATE users SET "supabaseId" = 'UUID-الخاص-بـ-viewer' WHERE email = 'viewer@dgcc.edu.sa';
```

---

## الخطوة 5 — تشغيل محلياً

```bash
npm run dev
```

افتح: http://localhost:3000

سيتوجه تلقائياً إلى http://localhost:3000/auth/login

**بيانات الدخول:**
- Admin: admin@dgcc.edu.sa / Admin@1234!
- Manager: manager@dgcc.edu.sa / Manager@1234!
- Viewer: viewer@dgcc.edu.sa / Viewer@1234!

---

## الخطوة 6 — النشر على Vercel

### 6.1 رفع المشروع على GitHub
```bash
git init
git add .
git commit -m "Initial commit — DGCC PES"
git branch -M main
git remote add origin https://github.com/USERNAME/dgcc-pes.git
git push -u origin main
```

### 6.2 ربط Vercel
1. اذهب إلى https://vercel.com/new
2. اختر المشروع من GitHub
3. Framework: **Next.js** (يُكتشف تلقائياً)
4. لا تضغط Deploy بعد — اذهب إلى **Environment Variables** أولاً

### 6.3 إضافة متغيرات البيئة في Vercel
أضف كل هذه المتغيرات:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
DIRECT_URL
NEXTAUTH_SECRET
NEXTAUTH_URL  →  https://YOUR-PROJECT.vercel.app
```

### 6.4 النشر
اضغط **Deploy** — سيستغرق ~3 دقائق.

### 6.5 تحديث Supabase
في **Supabase → Authentication → URL Configuration**:
```
Site URL: https://YOUR-PROJECT.vercel.app
Redirect URLs: https://YOUR-PROJECT.vercel.app/auth/callback
```

---

## الخطوة 7 — التحقق من أن كل شيء يعمل

بعد النشر، تحقق من:

✅ https://YOUR-PROJECT.vercel.app → يعيد توجيهك لصفحة تسجيل الدخول  
✅ تسجيل الدخول بـ admin@dgcc.edu.sa  
✅ ظهور Dashboard مع إحصاءات  
✅ صفحة Orders تعرض قائمة  
✅ إنشاء Order جديد من زر "+ New Order"  

---

## الأوامر المهمة

```bash
# تشغيل محلي
npm run dev

# بناء للإنتاج (للاختبار)
npm run build
npm start

# قاعدة البيانات
npm run db:generate   # توليد Prisma Client
npm run db:push       # رفع schema إلى Supabase
npm run db:migrate    # migration رسمية (للإنتاج)
npm run db:seed       # بيانات أولية
npx prisma studio     # واجهة مرئية لقاعدة البيانات
```

---

## هيكل المشروع

```
dgcc-pes/
├── prisma/
│   └── schema.prisma          ← تعريف قاعدة البيانات الكاملة
├── scripts/
│   └── seed.ts                ← بيانات أولية (units, sequences, demo users)
├── src/
│   ├── app/
│   │   ├── (protected)/       ← جميع الصفحات المحمية
│   │   │   ├── dashboard/     ← لوحة المتابعة
│   │   │   ├── orders/        ← قائمة + تفاصيل + Grid + New/Edit
│   │   │   ├── governance/    ← سجل الحوكمة
│   │   │   ├── gov-tasks/     ← مهام الحوكمة
│   │   │   └── changes/       ← طلبات التغيير
│   │   ├── api/               ← REST API routes
│   │   │   ├── orders/        ← CRUD + description + update-logs
│   │   │   └── governance/    ← CRUD للحوكمة
│   │   └── auth/login/        ← صفحة تسجيل الدخول
│   ├── components/
│   │   ├── layout/AppShell.tsx  ← Sidebar + Topbar
│   │   ├── forms/              ← نماذج الإدخال
│   │   └── ui/                 ← مكونات UI مشتركة
│   ├── lib/
│   │   ├── auth/session.ts     ← نظام الصلاحيات RBAC
│   │   ├── audit/logger.ts     ← سجل التدقيق
│   │   ├── business-logic/     ← RAG, planned%, rollup
│   │   └── supabase/           ← Server + Browser clients
│   ├── middleware.ts           ← حماية Routes
│   └── types/index.ts         ← TypeScript types + RBAC
└── DEPLOYMENT.md              ← هذا الدليل
```

---

## الـ Batches المكتملة والقادمة

| Batch | الوصف | الحالة |
|-------|-------|--------|
| 1 | Foundation: Auth, Schema, RBAC, Seed, Login | ✅ مكتمل |
| 2 | App Shell, Orders List, Order Detail (5 Tabs) | ✅ مكتمل |
| 3 | Grid Editor (Excel-like inline editing) | ✅ مكتمل |
| 4 | New Order + Edit Order Forms | ✅ مكتمل |
| 5 | Governance Module (Items + Tasks) | 🔲 قادم |
| 6 | Change Control + Audit Log Viewer | 🔲 قادم |
| 7 | Weekly Briefs | 🔲 قادم |
| 8 | Analytics + Charts | 🔲 قادم |
| 9 | Excel Import / Export | 🔲 قادم |
| 10 | Admin Panel (Units, Users, Lookups) | 🔲 قادم |

---

## حل المشاكل الشائعة

### مشكلة: `Can't reach database server`
- تحقق من DATABASE_URL في .env.local
- تحقق من أن IP غير محجوب في Supabase → Settings → Database → Network

### مشكلة: `Invalid JWT` عند تسجيل الدخول
- تحقق من NEXT_PUBLIC_SUPABASE_ANON_KEY
- تأكد من تطابق الـ URL

### مشكلة: المستخدم يسجل دخول لكن يُعاد توجيهه لـ login
- تأكد من تشغيل db:seed
- تأكد من تحديث supabaseId في جدول users

### مشكلة: `P2021 Table not found`
- شغّل `npm run db:push` مرة أخرى

---

## الأمان في الإنتاج

1. **عطّل** Confirm email في Supabase → تفعيله في الإنتاج الفعلي
2. **أضف** Row Level Security (RLS) في Supabase للحماية الإضافية
3. **احفظ** SUPABASE_SERVICE_ROLE_KEY بسرية تامة
4. **فعّل** 2FA على حسابات Supabase و Vercel

---

## الدعم والتطوير

للإضافات والتعديلات المستقبلية:
- حقول جديدة → أضف في `prisma/schema.prisma` ثم `db:push`
- وضع جديد → أضف في enum بالـ schema
- تقرير جديد → أضف في `src/app/(protected)/analytics/`
- إشعارات → أضف webhook في Supabase

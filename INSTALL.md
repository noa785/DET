# 📦 المرحلة 4 — دليل التثبيت

## الملفات المطلوب نسخها

```
المصدر → الوجهة
─────────────────────────────────────────────────────────────────
lib/rules-engine.ts            → src/lib/business-logic/rules-engine.ts
api/notifications/route.ts     → src/app/api/notifications/route.ts
components/NotificationBell.tsx → src/components/NotificationBell.tsx
```

---

## الخطوة 1: تحديث Prisma Schema

افتح `prisma/schema.prisma` وأضف في **نهاية الملف**:

```prisma
model Notification {
  id         String   @id @default(cuid())
  type       String
  title      String
  message    String
  severity   String   @default("info")
  isRead     Boolean  @default(false)
  entityType String?
  entityId   String?
  entityCode String?
  userId     String?
  user       User?    @relation("UserNotifications", fields: [userId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
  readAt     DateTime?

  @@index([userId, isRead])
  @@index([createdAt])
  @@map("notifications")
}
```

ثم أضف هذا السطر داخل `model User` (مع العلاقات الأخرى):

```prisma
notifications  Notification[] @relation("UserNotifications")
```

---

## الخطوة 2: تشغيل Migration

```powershell
npx prisma migrate dev --name phase4-notifications
npx prisma generate
```

---

## الخطوة 3: نسخ الملفات

```powershell
# Rules Engine
Copy-Item "C:\Users\Nora\Downloads\rules-engine.ts" -Destination "C:\DET\DET-ready\DET\src\lib\business-logic\rules-engine.ts" -Force

# Notifications API
New-Item -ItemType Directory -Force -Path "C:\DET\DET-ready\DET\src\app\api\notifications"
Copy-Item "C:\Users\Nora\Downloads\route.ts" -Destination "C:\DET\DET-ready\DET\src\app\api\notifications\route.ts" -Force

# Notification Bell Component
Copy-Item "C:\Users\Nora\Downloads\NotificationBell.tsx" -Destination "C:\DET\DET-ready\DET\src\components\NotificationBell.tsx" -Force
```

---

## الخطوة 4: إضافة الجرس في AppShell.tsx

افتح `src/components/layout/AppShell.tsx`

**أولاً** أضف الـ import في أعلى الملف:

```tsx
import NotificationBell from '@/components/NotificationBell';
```

**ثانياً** ابحث عن شريط البحث أو الـ topbar header واضف الجرس بجانبه. ابحث عن شيء مثل `Search orders` أو `+ New Order` وأضف قبله:

```tsx
<NotificationBell />
```

---

## الخطوة 5: إضافة Reports Center في Sidebar

في نفس الملف `AppShell.tsx`، في قسم `Reports` أضف:

```tsx
{ href: '/reports', icon: '📋', label: 'Reports Center' },
```

---

## الخطوة 6: تشغيل

```powershell
Remove-Item -Recurse -Force "C:\DET\DET-ready\DET\.next"
npm run dev
```

---

## كيف تشتغل المرحلة 4

### التأخر التلقائي
- لما تضغط ⚡ **Scan** في الجرس، النظام يفحص كل الطلبات
- أي طلب `dueDate` فات ومو `COMPLETED/CANCELLED/DELAYED` → يتحول تلقائياً لـ **DELAYED**
- يتنشأ تنبيه لصاحب الطلب

### تحذيرات الحوكمة
- أي GovernanceItem عنده `nextReviewDate` فات → تنبيه "Review Overdue"
- أي GovernanceItem عنده `nextReviewDate` خلال 14 يوم → تنبيه "Review Soon"

### التنبيهات
- الجرس يظهر عدد التنبيهات غير المقروءة
- يحدّث تلقائياً كل 60 ثانية
- تقدر تضغط على التنبيه وتروح للطلب مباشرة
- "Mark all read" يقرأ كل التنبيهات
- ⚡ Scan يشغّل الفحص يدوياً (للأدمن فقط)

---

## ملخص المرحلة 4

| الميزة | الحالة |
|---|---|
| تأخر تلقائي (DELAYED) | ✅ |
| تنبيه طلبات قريبة التسليم (7 أيام) | ✅ |
| تحذير مراجعات حوكمة متأخرة | ✅ |
| تحذير مراجعات حوكمة قريبة (14 يوم) | ✅ |
| جرس تنبيهات في Header | ✅ |
| منع تكرار التنبيهات (24 ساعة) | ✅ |
| Mark as read / Mark all | ✅ |
| روابط مباشرة للطلب/الحوكمة | ✅ |
| Notification model في Prisma | ✅ |

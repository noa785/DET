// src/lib/i18n/ar/sync.ts
// One agreed wording where the page groups chose differently, plus labels the Google Sheets use.
export const AR_SYNC: Record<string, string> = {
  'Digital Enterprise Tracker': 'متتبع الأعمال الرقمي',
  '{n} orders': '{n} طلبات',
  '{n} order': 'طلب واحد',
  'Live': 'مفعّل',
  'No unit': 'بدون وحدة',
  'Risk': 'المخاطر',
  'Created': 'تاريخ الإنشاء',
  'Completion': 'نسبة الإنجاز',
  'Due': 'تاريخ الاستحقاق',
  'Arabic': 'عربي',
  'Please write the governance item (in English or Arabic).': 'اكتبي بند الحوكمة (بالعربي أو بالإنجليزي).',
  'Please write the governance item (in English or Arabic)': 'اكتبي بند الحوكمة (بالعربي أو بالإنجليزي)',
  'Governance note (Arabic)': 'ملاحظة الحوكمة (عربي)',
  'Governance item (Arabic)': 'بند الحوكمة (عربي)',
  'Notes (Arabic)': 'ملاحظات (عربي)',
  'Data Governance (Arabic)': 'حوكمة البيانات (عربي)',
};

/** Short labels for the Google Sheet drop-downs ("Project / مشروع"). */
export const AR_SHEET: Record<string, string> = {
  'Project': 'مشروع', 'Unit': 'وحدة',
  'Planned': 'مخطط', 'In review': 'قيد المراجعة', 'Approved': 'معتمد', 'Needs update': 'يحتاج تحديث',
  'Not required': 'غير مطلوب', 'Waiting review': 'بانتظار المراجعة',
  'Policy': 'سياسة', 'Procedure': 'إجراء', 'Standard': 'معيار', 'Review': 'مراجعة',
  'Compliance check': 'فحص امتثال', 'Risk': 'مخاطر', 'Other': 'أخرى',
};

// src/lib/i18n/ar/data.ts
// Arabic names for data stored in English in the database: projects and systems, their summaries, and units.
// Shown when the page is in Arabic; the stored English values do not change.
export const AR_DATA: Record<string, string> = {
  // Projects and systems
  'Digital Enterprise Tracker': 'متتبع الأعمال الرقمي',
  'Observation Distribution System': 'نظام توزيع الملاحظات الصفية',
  'Performance Evaluation System': 'نظام تقييم الأداء',
  'Academic Scheduling System': 'نظام الجداول الدراسية',
  'ELI Scheduling System': 'نظام الجداول الدراسية',
  "Employees' Identifier": 'نظام تعريف المنسوبات',
  'ELI Platform': 'منصة معهد اللغة الإنجليزية',
  'PNU Smart Lingua': 'منصة PNU Smart Lingua',
  'Curriculum System (visual concept)': 'نظام المناهج (نموذج تصوري)',
  'Curriculum Tracking System': 'نظام متابعة المناهج',
  'ELI Website': 'الموقع الإلكتروني للمعهد',
  'Test Operating System': 'نظام تشغيل الاختبارات',
  'PNU Institutional Hosting': 'الاستضافة المؤسسية في الجامعة',
  'DGCC Institutional Systems': 'الأنظمة المؤسسية للجنة',
  'Systems Readiness Validation': 'التحقق من جاهزية الأنظمة',
  'AI Conference Contribution': 'المشاركة في مؤتمر الذكاء الاصطناعي',
  'CMA Enhancement': 'تطوير نظام CMA',

  // System summaries
  'Tracks all digital transformation orders by section, with progress, governance status and a one-page KPI report for leadership.':
    'يتابع جميع طلبات التحول الرقمي حسب القسم، مع نسبة الإنجاز وحالة الحوكمة وتقرير لمؤشرات الأداء في صفحة واحدة للقيادة.',
  'Distributes classroom observation duties across weeks and observers using priority rules, with a leadership dashboard of results.':
    'يوزّع مهام الملاحظة الصفية على الأسابيع والملاحِظات وفق قواعد الأولوية، مع لوحة متابعة للقيادة تعرض النتائج.',
  'Evaluates faculty performance across the full evaluation cycle, with role-based access, bilingual exports and backup and restore.':
    'يقيّم أداء عضوات هيئة التدريس عبر دورة التقييم كاملة، مع صلاحيات وصول حسب الدور، وتصدير بلغتين، ونسخ احتياطي واستعادة.',
  'Builds term schedules in phases: base schedule, faculty assignment and coverage changes, using the Scheduling Unit rules.':
    'يبني الجداول الفصلية على مراحل: الجدول الأساسي، ثم إسناد عضوات هيئة التدريس، ثم تعديلات التغطية، وفق قواعد وحدة الجداول الدراسية.',
  'Standardizes staff identification and gives a fast name lookup that fills official employee data, in a PC version and an online version.':
    'يوحّد بيانات تعريف المنسوبات، ويتيح بحثًا سريعًا بالاسم يعبّئ البيانات الرسمية للموظفة، بنسخة للحاسب ونسخة إلكترونية.',
  'Central hub that brings the ELI systems together in one bilingual entry point; institutional hosting and security steps are in progress.':
    'منصة مركزية تجمع أنظمة المعهد في مدخل واحد بلغتين، وإجراءات الاستضافة المؤسسية والأمن قيد التنفيذ.',
  'English learning platform for PNU students; architecture, business requirements and the outsourcing terms are prepared.':
    'منصة لتعلّم اللغة الإنجليزية لطالبات الجامعة، وقد أُعدّت البنية التقنية ومتطلبات العمل وشروط الإسناد الخارجي.',
  'Interactive visual concept for the curriculum team, refined with the team as the basis for the curriculum system.':
    'نموذج تصوري تفاعلي لفريق المناهج، طُوِّر بالتعاون مع الفريق ليكون أساسًا لنظام المناهج.',
  'Tracks weekly curriculum delivery against the pacing guide with an evidence gate; architecture and initial plan are ready.':
    'يتابع تنفيذ المنهج أسبوعيًا مقارنةً بالخطة الزمنية مع اشتراط إرفاق الدليل، والبنية التقنية والخطة الأولية جاهزتان.',
  'New ELI website; the bilingual proposal, specification workbook and design review are prepared.':
    'الموقع الإلكتروني الجديد للمعهد، وقد أُعدّ المقترح بلغتين وملف المواصفات ومراجعة التصميم.',
  'Supports test administration operations; data collection and first data preparation are done.':
    'يدعم عمليات إدارة الاختبارات، وقد اكتمل جمع البيانات وتهيئتها الأولية.',

  // Units
  'Digital Transformation Committee': 'لجنة التحول الرقمي',
  'Digital Governance & Compliance Committee': 'لجنة الحوكمة الرقمية والامتثال',
  'Assessment Unit': 'وحدة التقويم',
  'Test Administration Unit': 'وحدة إدارة الاختبارات',
  'Marketing Unit': 'وحدة التسويق',
  'English Language and Professional Development Center': 'مركز اللغة الإنجليزية والتطوير المهني',
  'Institute Council': 'مجلس المعهد',
  'Student Council': 'المجلس الطلابي',
  'Advisory Board': 'المجلس الاستشاري',
  "Dean's Office": 'مكتب العميدة',
  'Administrative Communications Unit': 'وحدة الاتصالات الإدارية',
  'Human Resources Unit': 'وحدة الموارد البشرية',
  'Administrative and Financial Affairs Unit': 'وحدة الشؤون الإدارية والمالية',
  'Administrative Efficiency Department': 'إدارة الكفاءة الإدارية',
  'Accounting': 'المحاسبة',
  'Building Administration': 'إدارة المبنى',
  'Supervision and follow-up': 'الإشراف والمتابعة',
  'Custodian': 'أمين العهدة',
  'Vice Dean of Academic Affairs': 'وكالة المعهد للشؤون الأكاديمية',
  'E-Learning Department': 'إدارة التعلم الإلكتروني',
  'Teaching and Learning Quality Department': 'إدارة جودة التعليم والتعلم',
  'Laboratory and Learning Resources Department': 'إدارة المعامل ومصادر التعلم',
  'English Language and Professional Development Department': 'إدارة اللغة الإنجليزية والتطوير المهني',
  'English Language Courses Unit': 'وحدة دورات اللغة الإنجليزية',
  'Curriculum Unit': 'وحدة المناهج',
  'Curriculum and Digitalization Unit': 'وحدة المناهج والتحول الرقمي',
  'Classroom Observation and Feedback Unit': 'وحدة الملاحظة الصفية والتغذية الراجعة',
  'Assessment and Evaluation Unit': 'وحدة القياس والتقويم',
  'Quality Assurance Unit': 'وحدة ضمان الجودة',
  'Registration and Scheduling Unit': 'وحدة التسجيل والجداول',
  'Academic Support Unit': 'وحدة الدعم الأكاديمي',
  'Writing Center': 'مركز الكتابة',
  'Speaking Center': 'مركز المحادثة',
  'Academic and E-Records Unit': 'وحدة السجلات الأكاديمية والإلكترونية',
  'Enrichment Centre': 'مركز الإثراء',
  'Business Development Unit': 'وحدة تطوير الأعمال',
  'Internal Communication Unit': 'وحدة التواصل الداخلي',
  'Public Relations Unit': 'وحدة العلاقات العامة',
  'Media Unit': 'وحدة الإعلام',
  'Community Responsibility Unit': 'وحدة المسؤولية المجتمعية',
  'Data and Performance Measurement Unit': 'وحدة البيانات وقياس الأداء',
  'Student Services Department': 'إدارة خدمات الطالبات',
  'CELTA Center': 'مركز CELTA',
  'On Boarding': 'التهيئة',
  'Research and Innovation Unit': 'وحدة البحث والابتكار',
  'Postgraduate Programs Department': 'إدارة برامج الدراسات العليا',
  'Project Management Office': 'مكتب إدارة المشاريع',
  'Vice Dean of Research, Innovation and Business': 'وكالة المعهد للبحث والابتكار والأعمال',
  'Scheduling Unit': 'وحدة الجداول الدراسية',
  'Educational Affairs Unit': 'وحدة الشؤون التعليمية',
  'English Language Institute': 'معهد اللغة الإنجليزية',
};

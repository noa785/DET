// scripts/seed.ts
// Run: npm run db:seed
// Seeds: sequences, units (49), projects, lookup values, demo users

import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

const UNITS = [
  { code: 'DGCC', name: 'Digital Governance & Compliance Committee', unitIndex: 1,  colorHex: '#589DC0' },
  { code: 'AU',   name: 'Assessment Unit',                            unitIndex: 2,  colorHex: '#5BA0C1' },
  { code: 'TAU',  name: 'Test Administration Unit',                   unitIndex: 3,  colorHex: '#559BBF' },
  { code: 'MU',   name: 'Marketing Unit',                             unitIndex: 4,  colorHex: '#529ABE' },
  { code: 'PDU',  name: 'English Language and Professional Development Center', unitIndex: 5, colorHex: '#589DC4' },
  { code: 'IC',   name: 'Institute Council',                          unitIndex: 6,  colorHex: null },
  { code: 'SC',   name: 'Student Council',                            unitIndex: 7,  colorHex: null },
  { code: 'AB',   name: 'Advisory Board',                             unitIndex: 8,  colorHex: null },
  { code: 'DO',   name: "Dean's Office",                              unitIndex: 9,  colorHex: null },
  { code: 'ADMCOMM', name: 'Administrative Communications Unit',      unitIndex: 10, colorHex: null },
  { code: 'HR',   name: 'Human Resources Unit',                       unitIndex: 11, colorHex: null },
  { code: 'AFA',  name: 'Administrative and Financial Affairs Unit',  unitIndex: 12, colorHex: null },
  { code: 'AED',  name: 'Administrative Efficiency Department',       unitIndex: 13, colorHex: null },
  { code: 'ACC',  name: 'Accounting',                                 unitIndex: 14, colorHex: null },
  { code: 'BLDG', name: 'Building Administration',                    unitIndex: 15, colorHex: null },
  { code: 'SUP',  name: 'Supervision and follow-up',                  unitIndex: 16, colorHex: null },
  { code: 'CUST', name: 'Custodian',                                  unitIndex: 17, colorHex: null },
  { code: 'VDAA', name: 'Vice Dean of Academic Affairs',              unitIndex: 18, colorHex: '#FFCC93' },
  { code: 'ELD',  name: 'E-Learning Department',                      unitIndex: 19, colorHex: null },
  { code: 'TLQ',  name: 'Teaching and Learning Quality Department',   unitIndex: 20, colorHex: null },
  { code: 'LLRD', name: 'Laboratory and Learning Resources Department', unitIndex: 21, colorHex: null },
  { code: 'ELPD', name: 'English Language and Professional Development Department', unitIndex: 22, colorHex: null },
  { code: 'ELU',  name: 'English Language Courses Unit',              unitIndex: 23, colorHex: null },
  { code: 'CURR', name: 'Curriculum Unit',                            unitIndex: 24, colorHex: null },
  { code: 'CURDIG', name: 'Curriculum and Digitalization Unit',       unitIndex: 25, colorHex: null },
  { code: 'OBS',  name: 'Classroom Observation and Feedback Unit',    unitIndex: 26, colorHex: null },
  { code: 'AEVAL', name: 'Assessment and Evaluation Unit',            unitIndex: 27, colorHex: null },
  { code: 'QA',   name: 'Quality Assurance Unit',                     unitIndex: 28, colorHex: null },
  { code: 'RSU',  name: 'Registration and Scheduling Unit',           unitIndex: 29, colorHex: null },
  { code: 'ASU',  name: 'Academic Support Unit',                      unitIndex: 30, colorHex: null },
  { code: 'WC',   name: 'Writing Center',                             unitIndex: 31, colorHex: null },
  { code: 'SPEAK', name: 'Speaking Center',                           unitIndex: 32, colorHex: null },
  { code: 'AERU', name: 'Academic and E-Records Unit',                unitIndex: 33, colorHex: null },
  { code: 'ENRICH', name: 'Enrichment Centre',                        unitIndex: 34, colorHex: null },
  { code: 'BIZDEV', name: 'Business Development Unit',                unitIndex: 35, colorHex: null },
  { code: 'INTCOMM', name: 'Internal Communication Unit',             unitIndex: 36, colorHex: null },
  { code: 'PR',   name: 'Public Relations Unit',                      unitIndex: 37, colorHex: null },
  { code: 'MEDIA', name: 'Media Unit',                                unitIndex: 38, colorHex: null },
  { code: 'CRU',  name: 'Community Responsibility Unit',              unitIndex: 39, colorHex: null },
  { code: 'DPMU', name: 'Data and Performance Measurement Unit',      unitIndex: 40, colorHex: null },
  { code: 'SSD',  name: 'Student Services Department',                unitIndex: 41, colorHex: null },
  { code: 'CELTA', name: 'CELTA Center',                              unitIndex: 42, colorHex: null },
  { code: 'ONBRD', name: 'On Boarding',                               unitIndex: 43, colorHex: null },
  { code: 'RIN',  name: 'Research and Innovation Unit',               unitIndex: 44, colorHex: null },
  { code: 'PPD',  name: 'Postgraduate Programs Department',           unitIndex: 45, colorHex: null },
  { code: 'PMO',  name: 'Project Management Office',                  unitIndex: 46, colorHex: null },
  { code: 'VDRIB', name: 'Vice Dean of Research, Innovation and Business', unitIndex: 47, colorHex: null },
  { code: 'SU',   name: 'Scheduling Unit',                            unitIndex: 48, colorHex: null },
  // EAD has no index — referential integrity fix from Excel prototype
  { code: 'EAD',  name: 'Educational Affairs Unit',                   unitIndex: null, colorHex: null },
  // ELI — missing from original Units sheet (prototype gap fix)
  { code: 'ELI',  name: 'English Language Institute',                 unitIndex: null, colorHex: null },
];

const LOOKUP_VALUES = [
  // orderType
  ...['Program','Project','Deliverable','Task','Subtask'].map((v,i) => ({ category:'orderType', value:v.toUpperCase().replace(/ /g,'_'), label:v, sortOrder:i, isSystem:true })),
  // status
  ...['Not Started','In Progress','Under Review','Blocked','On Hold','Done','Cancelled'].map((v,i) => ({ category:'status', value:v.toUpperCase().replace(/ /g,'_'), label:v, sortOrder:i, isSystem:true })),
  // priority
  ...['Low','Medium','High','Critical'].map((v,i) => ({ category:'priority', value:v.toUpperCase(), label:v, sortOrder:i, isSystem:true })),
  // phase
  ...['Initiation','Planning','Execution','Monitoring','Closure'].map((v,i) => ({ category:'phase', value:v.toUpperCase(), label:v, sortOrder:i, isSystem:true })),
  // rag
  ...['Red','Amber','Green','Blue','Grey'].map((v,i) => ({ category:'rag', value:v.toUpperCase(), label:v, sortOrder:i, isSystem:true })),
  // govItemType
  ...['Policy','Procedure','Standard','Guideline','Committee Decision','Control','Compliance Requirement','Update Item'].map((v,i) => ({ category:'govItemType', value:v.toUpperCase().replace(/ /g,'_'), label:v, sortOrder:i, isSystem:true })),
];

async function main() {
  console.log('🌱 Seeding DGCC PES database…');

  // --- Sequences ---
  await prisma.sequence.createMany({
    data: [
      { id: 'order',    prefix: 'ORD', padding: 4, current: 52 },
      { id: 'gov_item', prefix: 'GOV', padding: 4, current: 1 },
      { id: 'gov_task', prefix: 'GT',  padding: 4, current: 1 },
      { id: 'change',   prefix: 'CHG', padding: 4, current: 1 },
      { id: 'brief',      prefix: 'WB',  padding: 4, current: 1 },
      { id: 'update_log', prefix: 'UL',  padding: 4, current: 1 },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Sequences');

  // --- Units ---
  for (const unit of UNITS) {
    await prisma.unit.upsert({
      where: { code: unit.code },
      update: {},
      create: unit,
    });
  }
  console.log(`✅ ${UNITS.length} Units`);

  // --- Lookup values ---
  for (const lv of LOOKUP_VALUES) {
    await prisma.lookupValue.upsert({
      where: { category_value: { category: lv.category, value: lv.value } },
      update: {},
      create: lv,
    });
  }
  console.log(`✅ ${LOOKUP_VALUES.length} Lookup values`);

  // --- Projects (from Excel — using unit codes) ---
  const dgccUnit = await prisma.unit.findUnique({ where: { code: 'DGCC' } });
  const eliUnit  = await prisma.unit.findUnique({ where: { code: 'ELI' } });

  await prisma.project.upsert({
    where: { code: 'P-1001' },
    update: {},
    create: {
      code: 'P-1001',
      name: 'ELI Scheduling System',
      unitId: eliUnit?.id,
      phase: 'PLANNING',
      startDate: new Date('2025-09-01'),
      endDate:   new Date('2026-06-30'),
      sponsor: 'Nora Nasser',
    },
  });
  await prisma.project.upsert({
    where: { code: 'P-2002' },
    update: {},
    create: {
      code: 'P-2002',
      name: 'DGCC Enterprise Tracker',
      unitId: dgccUnit?.id,
      phase: 'EXECUTION',
      startDate: new Date('2025-09-01'),
      endDate:   new Date('2026-03-31'),
      sponsor: 'Nora Nasser',
    },
  });
  console.log('✅ Projects');

  // --- Demo Users (passwords set separately via Supabase Auth) ---
  // In production: create users via Supabase dashboard → they get supabaseId
  // Then update this table with their supabaseId
  // For local dev: use the seed to create placeholder records
  const usersToSeed = [
    // ── Tech Admin ──────────────────────────────────────────────
    // Full access: everything (create, edit, delete, import/export, admin)
    { email: 'nora@dgcc.edu.sa',    name: 'Nora',    initials: 'NO', role: 'TECH_ADMIN' as Role,    unitCode: 'DGCC' },

    // ── Admin 1 — Read + Import/Export ──────────────────────────
    // Can view all, import, export — no write on orders/governance
    { email: 'eman@dgcc.edu.sa',    name: 'Eman',    initials: 'EM', role: 'IMPORT_VIEWER' as Role, unitCode: 'DGCC' },

    // ── Admin 2 — Read + Import/Export ──────────────────────────
    { email: 'abeer@dgcc.edu.sa',   name: 'Abeer',   initials: 'AB', role: 'IMPORT_VIEWER' as Role, unitCode: 'DGCC' },

    // ── Admin 3 — Editor ────────────────────────────────────────
    // Can create and edit orders, view all sections
    { email: 'fatimah@dgcc.edu.sa', name: 'Fatimah', initials: 'FA', role: 'EDITOR' as Role,  unitCode: 'DGCC' },

    // ── Admin 4 — Governance Editor + Viewer elsewhere ──────────
    // Write on governance section, viewer on all other sections, can download Excel
    { email: 'bushra@dgcc.edu.sa',  name: 'Bushra',  initials: 'BU', role: 'GOV_EDITOR' as Role,   unitCode: 'DGCC' },
    { email: 'malak@dgcc.edu.sa',   name: 'Malak',   initials: 'MA', role: 'GOV_EDITOR' as Role,   unitCode: 'DGCC' },
    { email: 'alanoud@dgcc.edu.sa', name: 'Alanoud', initials: 'AL', role: 'GOV_EDITOR' as Role,   unitCode: 'DGCC' },

    // ── Legacy accounts (kept for continuity) ───────────────────
    { email: 'admin@dgcc.edu.sa',   name: 'System Admin', initials: 'SA', role: 'SUPER_ADMIN' as Role, unitCode: 'DGCC' },
    { email: 'viewer@dgcc.edu.sa',  name: 'Viewer',       initials: 'VW', role: 'VIEWER' as Role,      unitCode: undefined },
  ];

  for (const u of usersToSeed) {
    const unit = u.unitCode
      ? await prisma.unit.findUnique({ where: { code: u.unitCode } })
      : null;
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        initials: u.initials,
        role: u.role,
        unitId: unit?.id ?? null,
        isActive: true,
      },
    });
  }
  console.log('✅ Demo users');

  console.log('\n🎉 Seed complete. Next: create Supabase Auth users and update supabaseId in users table.');
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());

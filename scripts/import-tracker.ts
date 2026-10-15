// scripts/import-tracker.ts
// Loads the Digital Enterprise Tracker Excel workbook into the database.
//
//   npm run db:import -- --file "data/DGCC_Enterprise_Tracker.xlsx" --dry-run   (check only, writes nothing)
//   npm run db:import -- --file "data/DGCC_Enterprise_Tracker.xlsx"             (import)
//   Add --systems "data/DET_Systems_Register.xlsx" to use another systems register (this one is the default).
//
// What it does
//   - Units and projects are created or updated by code.
//   - Every order is created or updated by its Order ID, and placed in Systems Engineering.
//   - Each order's description (narrative, bullet points, risks, next steps) is filled in.
//   - Orders added in the system are never changed by the import.
//   - Add --hide-missing to hide Excel orders that were removed from the file (soft delete, reversible).
//   - Governance status already set in the system is never overwritten.

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { existsSync } from 'fs';
import { parseTracker, parseSystems, systemFor } from './tracker-parse';

// Run up to 10 database calls at the same time (the import is otherwise slow over a remote connection).
const CONCURRENCY = 10;
function withPool(url?: string) {
  if (!url) return undefined;
  const u = url.replace(/([?&])connection_limit=\d+/, '$1').replace(/[?&]$/, '');
  return u + (u.includes('?') ? '&' : '?') + `connection_limit=${CONCURRENCY}`;
}
const dbUrl = withPool(process.env.DATABASE_URL);
const prisma = dbUrl ? new PrismaClient({ datasources: { db: { url: dbUrl } } }) : new PrismaClient();

/** Run fn over items, CONCURRENCY at a time, printing progress. */
async function eachLimited<T>(label: string, items: T[], fn: (x: T) => Promise<unknown>) {
  let i = 0, done = 0;
  const worker = async () => {
    while (i < items.length) {
      const x = items[i++];
      await fn(x);
      done++;
      if (done % 50 === 0 || done === items.length) process.stdout.write(`\r  ${label}: ${done} of ${items.length}   `);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  if (items.length) process.stdout.write('\n');
}
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

const FILE = opt('--file') ?? 'data/DGCC_Enterprise_Tracker.xlsx';
const SYSTEMS_FILE = opt('--systems') ?? 'data/DET_Systems_Register.xlsx';
const DRY = flag('--dry-run');
const HIDE_MISSING = flag('--hide-missing');
const d = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null);

async function main() {
  const t = parseTracker(FILE);
  const systems = existsSync(SYSTEMS_FILE) ? parseSystems(SYSTEMS_FILE) : [];
  const systemOf = new Map(t.orders.map(o => [o.orderCode, systemFor(o, systems)]));
  const withDesc = t.orders.filter(o => o.narrative || o.points.length).length;
  console.log(`File: ${FILE}`);
  console.log(`  ${t.orders.length} orders, ${withDesc} with a description, ${t.units.length} units, ${t.projects.length} projects`);
  console.log(`  ${t.skippedDescriptions.length} project-level descriptions (PRJ-...) skipped`);
  console.log(`Systems register: ${systems.length ? SYSTEMS_FILE : 'not found'}`);
  for (const s of systems) console.log(`  ${s.code.padEnd(5)} ${s.status.padEnd(15)} ${[...systemOf.values()].filter(v => v === s.code).length} orders  ${s.name}`);

  if (DRY) {
    writeFileSync('tracker-preview.json', JSON.stringify({ ...t, systems, systemOf: Object.fromEntries(systemOf) }, null, 1));
    console.log('Dry run: nothing written to the database. Preview saved to tracker-preview.json');
    return;
  }

  // 1. Units
  await eachLimited('Units', t.units, u => prisma.unit.upsert({
    where: { code: u.code },
    update: { name: u.name, unitIndex: u.unitIndex, colorHex: u.colorHex },
    create: { code: u.code, name: u.name, unitIndex: u.unitIndex, colorHex: u.colorHex },
  }));
  const unitId = new Map((await prisma.unit.findMany({ select: { id: true, code: true } })).map(u => [u.code, u.id]));

  // 2. Projects
  await eachLimited('Projects', t.projects, p => prisma.project.upsert({
    where: { code: p.code },
    update: { name: p.name, unitId: p.unitCode ? unitId.get(p.unitCode) ?? null : null },
    create: { code: p.code, name: p.name, unitId: p.unitCode ? unitId.get(p.unitCode) ?? null : null },
  }));
  // 2b. Systems register: create or update each system as a project marked isSystem
  await eachLimited('Systems', systems, s => {
    const data = {
      name: s.name, unitId: s.unitCode ? unitId.get(s.unitCode) ?? null : null, description: s.summary,
      isSystem: true, systemType: s.type, systemStatus: s.status, includeInKpi: s.includeInKpi, link: s.link,
    };
    return prisma.project.upsert({ where: { code: s.code }, update: data, create: { code: s.code, ...data } });
  });
  if (systems.length) {
    await prisma.project.updateMany({ where: { isSystem: true, code: { notIn: systems.map(s => s.code) } }, data: { isSystem: false } });
  }
  const projectId = new Map((await prisma.project.findMany({ select: { id: true, code: true } })).map(p => [p.code, p.id]));

  // 3. Orders + descriptions (one call per order: the description is saved together with the order)
  const existingIds = new Map((await prisma.order.findMany({ select: { id: true, orderCode: true } })).map(x => [x.orderCode, x.id]));
  let created = 0, updated = 0;
  await eachLimited('Orders', t.orders, async o => {
    const data = {
      type: o.type,
      name: o.name,
      unitId: o.unitCode ? unitId.get(o.unitCode) ?? null : null,
      projectId: (() => { const code = systemOf.get(o.orderCode) ?? o.projectCode; return code ? projectId.get(code) ?? null : null; })(),
      ownerName: o.ownerName,
      priority: o.priority,
      status: o.status,
      startDate: d(o.startDate),
      dueDate: d(o.dueDate),
      percentComplete: o.percentComplete,
      rescheduleCount: o.rescheduleCount,
      dependencies: o.dependencies,
      links: o.links,
      notes: o.notes,
      section: 'SYSTEMS_ENGINEERING' as const,
      sheetOrder: o.sheetOrder,
      isDeleted: false,
      deletedAt: null,
    };
    const descData = {
      narrativeSummary: o.narrative,
      bulletSummary: o.points.length ? o.points.join('\n') : null,
      risks: o.risks,
      nextSteps: o.nextSteps,
    };
    const id = existingIds.get(o.orderCode);
    if (id) {
      await prisma.order.update({ where: { id }, data: { ...data, description: { upsert: { create: descData, update: descData } } } });
      updated++;
    } else {
      // Governance starts as "Not required" only for new orders; an existing governance status is never overwritten.
      const saved = await prisma.order.create({ data: { orderCode: o.orderCode, govStatus: 'NOT_REQUIRED', ...data, description: { create: descData } }, select: { id: true } });
      existingIds.set(o.orderCode, saved.id);
      created++;
    }
  });

  // 4. Parent links (second pass, once every order exists)
  await eachLimited('Parent links', t.orders, o => prisma.order.update({
    where: { id: existingIds.get(o.orderCode)! },
    data: { parentId: o.parentCode ? existingIds.get(o.parentCode) ?? null : null },
  }));

  // 5. Optional: hide Excel orders that were removed from the file.
  //    Orders created in the system (codes SE-0001, AU-0001, ...) are never touched.
  let hidden = 0;
  if (HIDE_MISSING) {
    const keep = t.orders.map(o => o.orderCode);
    const res = await prisma.order.updateMany({
      where: {
        orderCode: { notIn: keep }, isDeleted: false,
        NOT: [{ orderCode: { startsWith: 'SE-' } }, { orderCode: { startsWith: 'AU-' } }],
      },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    hidden = res.count;
  }

  // 6. Record the import in the Admin Log
  await prisma.auditLog.create({ data: {
    action: 'IMPORT', module: 'det-import', userName: 'Excel import',
    notes: `Excel import from ${FILE.split(/[\\/]/).pop()}: ${created} created, ${updated} updated${HIDE_MISSING ? `, ${hidden} hidden` : ''}`,
  } }).catch(() => null);

  console.log(`Done: ${created} created, ${updated} updated${HIDE_MISSING ? `, ${hidden} hidden (removed from the file)` : ''}.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

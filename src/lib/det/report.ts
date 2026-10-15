'use client';
// src/lib/det/report.ts
// Official KPI reports, in two versions:
//   summary  (one page, as agreed with the committee chair): the strategic KPI and the systems behind it.
//   detailed (for the committee): the same KPI with gap, yearly targets and reading, the systems with their
//            orders, the work indicators per section, and the orders that need attention.
// Built in the browser with jsPDF; the header image lives in /public/brand/report-header.png.

import { AUTOMATION_TARGETS, BUCKETS, GOV, SECTION_LIST, SYSTEM_STATUS, automationRate, fdate, isLate, nextTarget, pct, type DetOrder, type DetSystem } from './shared';

export type ReportKind = 'summary' | 'detailed';

async function fontBase64(url: string): Promise<string> {
  const buf = await (await fetch(url)).arrayBuffer();
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function downloadKpiReport(orders: DetOrder[], systems: DetSystem[], generatedBy: string, kind: ReportKind = 'summary') {
  const detailed = kind === 'detailed';
  const preparedBy = generatedBy;
  const [{ jsPDF }, autoTableMod, head] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadImage('/brand/report-header.png'),
  ]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  // IBM Plex Sans, the same font as the system (falls back to Helvetica if it cannot load)
  let F = 'helvetica';
  try {
    const [reg, bold] = await Promise.all([fontBase64('/fonts/IBMPlexSans-Regular.ttf'), fontBase64('/fonts/IBMPlexSans-SemiBold.ttf')]);
    doc.addFileToVFS('IBMPlexSans-Regular.ttf', reg); doc.addFont('IBMPlexSans-Regular.ttf', 'Plex', 'normal');
    doc.addFileToVFS('IBMPlexSans-SemiBold.ttf', bold); doc.addFont('IBMPlexSans-SemiBold.ttf', 'Plex', 'bold');
    F = 'Plex';
  } catch { /* keep Helvetica */ }
  const W = 210, M = 15, CW = W - 2 * M;
  const TEAL: [number, number, number] = [21, 139, 135], DARK: [number, number, number] = [18, 48, 45];
  const MUTED: [number, number, number] = [120, 140, 138], GOLD: [number, number, number] = [201, 162, 78];
  const now = new Date();
  const greg = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  let hijri = '';
  try { hijri = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(now).replace(/[^\x20-\x7E]/g, "'"); } catch { /* not supported */ }
  const p2 = (n: number) => String(n).padStart(2, '0');
  const ref = `DET-${detailed ? 'RPD' : 'RPT'}-${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}-${p2(now.getHours())}${p2(now.getMinutes())}`;
  const rgb = (hex: string): [number, number, number] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // Header: logo and names, double rule
  const HW = 124, HH = HW * head.naturalHeight / head.naturalWidth;
  doc.addImage(head, 'PNG', (W - HW) / 2, 8, HW, HH, 'header', 'FAST');
  let y = 8 + HH + 3;
  doc.setDrawColor(...TEAL); doc.setLineWidth(0.8); doc.line(M, y, W - M, y);
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.3); doc.line(M, y + 1.3, W - M, y + 1.3);
  y += 8;

  // Reference block
  doc.setFontSize(9);
  ([['Reference No.', ref], ['Date', `${greg}${hijri ? '  |  ' + hijri : ''}`],
    ['Subject', detailed ? 'Detailed KPI report: automation of administrative and academic systems' : 'Annual KPI report: automation of administrative and academic systems'], ['Attachments', 'None']] as const)
    .forEach(([k, v]) => {
      doc.setFont(F, 'bold'); doc.setTextColor(...DARK); doc.text(`${k}:`, M, y);
      doc.setFont(F, 'normal'); doc.text(v, M + 30, y); y += 4.7;
    });
  y += 4;

  const h2 = (t: string) => {
    doc.setFont(F, 'bold'); doc.setFontSize(12.5); doc.setTextColor(...TEAL); doc.text(t, M, y); y += 2.5;
    doc.setDrawColor(225, 233, 231); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 5;
  };
  const tableStyle = {
    theme: 'grid' as const, rowPageBreak: 'avoid' as const, margin: { left: M, right: M, top: 18, bottom: 18 },
    styles: { font: F, fontSize: 8.6, cellPadding: 1.9, textColor: DARK, lineColor: [225, 233, 231] as [number, number, number], lineWidth: 0.2, valign: 'middle' as const },
    headStyles: { fillColor: [10, 69, 66] as [number, number, number], textColor: 255, fontStyle: 'bold' as const, fontSize: 8.6 },
    alternateRowStyles: { fillColor: [247, 250, 249] as [number, number, number] },
  };

  const room = (need: number) => { if (y > 297 - 22 - need) { doc.addPage(); y = 20; } };

  // 1. The KPI, exactly as set in the strategic plan (Goal 4): name, actual, target, formula.
  //    The detailed version adds the gap, the yearly targets bar and a one-line reading.
  const a = automationRate(systems), t = nextTarget();
  const met = a.rate >= t.target;
  const need = Math.max(0, Math.ceil((t.target / 100) * a.total) - a.live);
  h2('1. Key performance indicator');
  const cardH = detailed ? 52 : 34;
  doc.setFillColor(255, 255, 255); doc.setDrawColor(215, 226, 224); doc.setLineWidth(0.4); doc.roundedRect(M, y, CW, cardH, 3, 3, 'FD');
  doc.setFillColor(13, 92, 89); doc.roundedRect(M, y, CW, 9, 3, 3, 'F'); doc.rect(M, y + 5, CW, 4, 'F');
  doc.setFont(F, 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
  doc.text('Automation of administrative and academic systems', M + 5, y + 6.2);
  doc.setFont(F, 'normal'); doc.setFontSize(8); doc.text('Strategic plan, Goal 4', W - M - 5, y + 6.2, { align: 'right' });
  // big number + status
  const ny = detailed ? y + 25 : y + 22;
  doc.setFont(F, 'bold'); doc.setFontSize(30); doc.setTextColor(13, 92, 89); doc.text(`${a.rate}%`, M + 6, ny);
  const sc: [number, number, number] = met ? [30, 158, 106] : [212, 138, 11];
  doc.setFillColor(...sc); doc.roundedRect(M + 6, ny + 3, 30, 6, 3, 3, 'F');
  doc.setFontSize(8); doc.setTextColor(255, 255, 255); doc.text(met ? 'On target' : 'Below target', M + 21, ny + 7.1, { align: 'center' });
  // facts
  const facts: [string, string][] = [
    ['Actual', `${a.rate}%  (${a.live} of ${a.total} systems live)`],
    [`Target ${t.year}`, `${t.target}%`],
    ...(detailed ? [['Gap', met ? 'Target met' : `${t.target - a.rate} points (${need} more system${need === 1 ? '' : 's'} to go live)`] as [string, string]] : []),
    ['Formula', 'Live systems / all systems in scope x 100'],
  ];
  doc.setDrawColor(225, 233, 231); doc.setLineWidth(0.3); doc.line(M + 46, y + 13, M + 46, y + 13 + facts.length * 6.2 - 2);
  facts.forEach(([k, v], i) => {
    const yy = y + 16 + i * 6.2;
    doc.setFont(F, 'normal'); doc.setFontSize(8.4); doc.setTextColor(...MUTED); doc.text(k, M + 52, yy);
    doc.setFont(F, 'bold'); doc.setFontSize(9.4); doc.setTextColor(...DARK); doc.text(v, M + 80, yy);
  });
  if (detailed) {
    // progress bar with the yearly targets of the strategic plan
    const bx = M + 6, bw2 = CW - 12, by = y + 41;
    doc.setFillColor(237, 242, 241); doc.roundedRect(bx, by, bw2, 3, 1.5, 1.5, 'F');
    if (a.rate > 0) { doc.setFillColor(21, 139, 135); doc.roundedRect(bx, by, Math.max(3, bw2 * a.rate / 100), 3, 1.5, 1.5, 'F'); }
    AUTOMATION_TARGETS.forEach(x => {
      const xx = bx + bw2 * x.target / 100, cur = x.year === t.year;
      doc.setDrawColor(...(cur ? GOLD : MUTED)); doc.setLineWidth(cur ? 0.7 : 0.35); doc.line(xx, by - 1.2, xx, by + 4.2);
      doc.setFont(F, cur ? 'bold' : 'normal'); doc.setFontSize(7); doc.setTextColor(...(cur ? DARK : MUTED));
      doc.text(`${x.year}: ${x.target}%${x.year === 2030 ? '+' : ''}`, x.target >= 80 ? (x.year === 2030 ? bx + bw2 : xx - 1.5) : xx, by + 7.5, { align: x.target >= 80 ? 'right' : 'center' });
    });
  }
  y += cardH + (detailed ? 6 : 9);
  if (detailed) {
    const reading = met
      ? `${a.live} of ${a.total} systems are live (${a.rate}%), which meets the ${t.year} target of ${t.target}%.`
      : `${a.live} of ${a.total} systems are live (${a.rate}%). Reaching the ${t.year} target of ${t.target}% needs ${need} more system${need === 1 ? '' : 's'} to go live.`;
    doc.setFont(F, 'normal'); doc.setFontSize(9); doc.setTextColor(...DARK);
    doc.setFillColor(...GOLD); doc.rect(M, y - 3.2, 1, 4.6, 'F');
    doc.text(reading, M + 3.5, y); y += 9;
  }

  // 2. The systems behind the number (the evidence)
  h2('2. Systems');
  if (systems.length) {
    const statusCol = detailed ? 2 : 1;
    autoTable(doc, {
      ...tableStyle, startY: y,
      styles: { ...tableStyle.styles, fontSize: detailed ? 7.8 : 8.2, cellPadding: detailed ? { top: 1.2, bottom: 1.2, left: 1.6, right: 1.6 } : { top: 1.6, bottom: 1.6, left: 2, right: 2 } },
      headStyles: { ...tableStyle.headStyles, fontSize: detailed ? 7.8 : 8.6 },
      head: [detailed ? ['System', 'Type', 'Status', 'Orders done', 'Summary'] : ['System', 'Status', 'Summary']],
      body: systems.map(s => detailed
        ? [s.name, s.type === 'ACADEMIC' ? 'Academic' : 'Administrative', SYSTEM_STATUS[s.status].label, `${s.done} of ${s.orders}`, s.summary]
        : [s.name, SYSTEM_STATUS[s.status].label, s.summary]),
      columnStyles: detailed
        ? { 0: { cellWidth: 37, fontStyle: 'bold' }, 1: { cellWidth: 22 }, 2: { cellWidth: 25 }, 3: { cellWidth: 16, halign: 'center' }, 4: { cellWidth: CW - 100 } }
        : { 0: { cellWidth: 48, fontStyle: 'bold' }, 1: { cellWidth: 26 }, 2: { cellWidth: CW - 74 } },
      didParseCell: d => {
        if (d.section === 'body' && d.column.index === statusCol) {
          d.cell.styles.textColor = rgb(SYSTEM_STATUS[systems[d.row.index].status].color); d.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = lastY() + (detailed ? 9 : 12);
  } else {
    doc.setFont(F, 'normal'); doc.setFontSize(9.5); doc.setTextColor(...DARK); doc.text('No systems registered yet.', M, y); y += 14;
  }

  if (detailed) {
    // 3. Work indicators: three numbers, then one row per section
    room(60);
    h2('3. Work indicators');
    const done = orders.filter(o => o.bucket === 'DONE').length;
    const late = orders.filter(o => isLate(o)).length;
    const needGov = orders.filter(o => o.gov !== 'NOT_REQUIRED'), govOk = needGov.filter(o => o.gov === 'APPROVED').length;
    const K: [string, number, string, [number, number, number]][] = [
      ['Completion', pct(done, orders.length), `${done} of ${orders.length} orders done`, [30, 158, 106]],
      ['On time', pct(orders.length - late, orders.length), `${late} late`, TEAL],
      ['Governance', pct(govOk, needGov.length), `${govOk} of ${needGov.length} approved`, GOLD],
    ];
    const bw = (CW - 8) / 3;
    K.forEach(([l, v, sub, c], i) => {
      const x = M + i * (bw + 4);
      doc.setFillColor(247, 250, 249); doc.setDrawColor(225, 233, 231); doc.roundedRect(x, y, bw, 13, 2, 2, 'FD');
      doc.setFillColor(...c); doc.rect(x, y + 2.5, 1.1, 8, 'F');
      doc.setFont(F, 'bold'); doc.setFontSize(13); doc.setTextColor(...c); doc.text(`${v}%`, x + 5, y + 8.6);
      doc.setFontSize(8.6); doc.setTextColor(...DARK); doc.text(l, x + 23, y + 6);
      doc.setFont(F, 'normal'); doc.setFontSize(7.6); doc.setTextColor(...MUTED); doc.text(sub, x + 23, y + 10);
    });
    y += 17;
    autoTable(doc, {
      ...tableStyle, startY: y,
      head: [['Section', 'Orders', 'Done', 'In progress', 'Not started', 'Stuck', 'Late', 'Governance approved']],
      body: SECTION_LIST.map(sec => {
        const L = orders.filter(o => o.section === sec.key);
        const by = (b: keyof typeof BUCKETS) => L.filter(o => o.bucket === b).length;
        const g = L.filter(o => o.gov !== 'NOT_REQUIRED');
        return [sec.name, L.length, by('DONE'), by('IN_PROGRESS'), by('NOT_STARTED'), by('STUCK'), L.filter(o => isLate(o)).length,
          g.length ? `${g.filter(o => o.gov === 'APPROVED').length} of ${g.length}` : 'None required'];
      }),
      columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' }, 7: { halign: 'center' } },
    });
    y = lastY() + 9;

    // 4. Orders that need attention: late, stuck, or waiting governance review
    const reasons = (o: DetOrder) => [isLate(o) && 'Late', o.bucket === 'STUCK' && 'Stuck', o.gov === 'PENDING' && GOV.PENDING.label].filter(Boolean).join(', ');
    const attention = orders.filter(o => reasons(o)).sort((p, q) => (p.due ?? '9999').localeCompare(q.due ?? '9999'));
    room(30);
    h2('4. Needs attention');
    if (attention.length) {
      autoTable(doc, {
        ...tableStyle, startY: y,
        styles: { ...tableStyle.styles, fontSize: 7.8, cellPadding: { top: 1.1, bottom: 1.1, left: 1.6, right: 1.6 } },
        headStyles: { ...tableStyle.headStyles, fontSize: 7.8 },
        head: [['Order', 'Title', 'Section', 'Responsible', 'Due', 'Progress', 'Reason']],
        body: attention.map(o => [o.code, o.name, o.section === 'AUTOMATION' ? 'Automation' : 'Systems Eng.', o.owner || '-', fdate(o.due), `${o.progress}%`, reasons(o)]),
        columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 55 }, 2: { cellWidth: 21 }, 3: { cellWidth: 26 }, 4: { cellWidth: 20 }, 5: { cellWidth: 16, halign: 'center' }, 6: { cellWidth: CW - 160 } },
        didParseCell: d => {
          if (d.section === 'body' && d.column.index === 6) { d.cell.styles.textColor = [204, 61, 51]; d.cell.styles.fontStyle = 'bold'; }
        },
      });
      y = lastY() + 12;
    } else {
      doc.setFont(F, 'normal'); doc.setFontSize(9.5); doc.setTextColor(...DARK); doc.text('Nothing needs attention: no late, stuck or waiting orders.', M, y); y += 14;
    }
  }

  // Generated by (the person who downloaded the report) + signature
  room(14);
  const when = `${greg}, ${p2(now.getHours())}:${p2(now.getMinutes())}`;
  doc.setFont(F, 'bold'); doc.setFontSize(9.5); doc.setTextColor(...DARK); doc.text('Generated by', M, y);
  doc.setFont(F, 'normal'); doc.text(preparedBy, M, y + 4.8);
  doc.setTextColor(...MUTED); doc.setFontSize(8.5); doc.text(`${when}  |  DTC Enterprise Tracker`, M, y + 8.8);
  doc.setDrawColor(...MUTED); doc.setLineWidth(0.3); doc.line(W - M - 55, y + 5.5, W - M, y + 5.5); doc.text('Signature', W - M - 55, y + 9.3);

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...TEAL); doc.setLineWidth(0.5); doc.line(M, 284, W - M, 284);
    doc.setFont(F, 'normal'); doc.setFontSize(7.8); doc.setTextColor(...MUTED);
    doc.text('DTC Enterprise Tracker  |  English Language Institute  |  Princess Nourah bint Abdulrahman University', M, 288.5);
    doc.text(`${ref}  |  Page ${i} of ${pages}`, W - M, 288.5, { align: 'right' });
  }
  doc.save(`${ref}.pdf`);
}

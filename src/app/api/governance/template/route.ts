// src/app/api/governance/template/route.ts
// GET /api/governance/template
// Generates and streams an Excel import template for governance items

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';

const HEADERS = [
  'title',
  'type',
  'status',
  'priority',
  'riskLevel',
  'version',
  'unitCode',
  'ownerEmail',
  'reviewerEmail',
  'effectiveDate',
  'nextReviewDate',
  'reviewCycleDays',
  'source',
  'complianceImpact',
  'notes',
  'evidenceLinks',
];

const EXAMPLE_ROW: Record<string, string | number> = {
  title:            'Annual Procurement Policy Review',
  type:             'POLICY',
  status:           'DRAFT',
  priority:         'HIGH',
  riskLevel:        'MEDIUM',
  version:          '2.0',
  unitCode:         'PROC',
  ownerEmail:       'owner@dgcc.edu.sa',
  reviewerEmail:    'reviewer@dgcc.edu.sa',
  effectiveDate:    '2025-01-01',
  nextReviewDate:   '2026-01-01',
  reviewCycleDays:  365,
  source:           'MoHE Regulation 2024/12',
  complianceImpact: 'Affects all procurement above SAR 50,000',
  notes:            'Must be reviewed after any board resolution',
  evidenceLinks:    'https://sharepoint/policy/procurement',
};

const VALID_VALUES: Record<string, string> = {
  type:      'POLICY | PROCEDURE | STANDARD | GUIDELINE | COMMITTEE_DECISION | CONTROL | COMPLIANCE_REQUIREMENT | UPDATE_ITEM',
  status:    'DRAFT | ACTIVE | UNDER_REVIEW | SUPERSEDED | ARCHIVED',
  priority:  'LOW | MEDIUM | HIGH | CRITICAL',
  riskLevel: 'LOW | MEDIUM | HIGH | CRITICAL',
};

export async function GET(req: NextRequest) {
  const user = await requirePermission('governance:view');
  if (isErrorResponse(user)) return user;

  // ── Sheet 1: Import Data (blank header + example) ─────────────
  const importData: Record<string, string | number>[] = [
    EXAMPLE_ROW,
  ];
  const ws1 = XLSX.utils.json_to_sheet(importData, { header: HEADERS });

  // Style header row
  const range = XLSX.utils.decode_range(ws1['!ref'] ?? 'A1');
  ws1['!cols'] = HEADERS.map(h => {
    // Set column widths
    const widths: Record<string, number> = {
      title: 40, complianceImpact: 35, notes: 30, type: 25,
      ownerEmail: 28, reviewerEmail: 28, source: 30, evidenceLinks: 35,
    };
    return { wch: widths[h] ?? 18 };
  });

  // Freeze header row
  ws1['!freeze'] = { xSplit: 0, ySplit: 1 };

  // ── Sheet 2: Reference (valid values) ─────────────────────────
  const refRows = Object.entries(VALID_VALUES).map(([field, values]) => ({
    Field:         field,
    'Valid Values': values,
    Required:      field === 'title' ? 'Yes' : 'No',
  }));

  // Add date format note
  refRows.push({
    Field:         'effectiveDate / nextReviewDate',
    'Valid Values': 'YYYY-MM-DD format  (e.g. 2025-06-15)',
    Required:      'No',
  });
  refRows.push({
    Field:         'reviewCycleDays',
    'Valid Values': 'Number of days (e.g. 365 = annual)',
    Required:      'No',
  });
  refRows.push({
    Field:         'unitCode',
    'Valid Values': 'Must match an existing Unit code in the system',
    Required:      'No',
  });
  refRows.push({
    Field:         'ownerEmail / reviewerEmail',
    'Valid Values': 'Must match an existing user email in the system',
    Required:      'No',
  });

  const ws2 = XLSX.utils.json_to_sheet(refRows);
  ws2['!cols'] = [{ wch: 30 }, { wch: 70 }, { wch: 10 }];

  // ── Build workbook ────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Governance Items');
  XLSX.utils.book_append_sheet(wb, ws2, 'Reference');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="PES-Governance-Import-Template.xlsx"',
      'Content-Length':       buf.length.toString(),
      'Cache-Control':        'no-cache',
    },
  });
}

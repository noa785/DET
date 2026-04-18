// src/lib/validation/order.schemas.ts
// Single source of truth — used by both client forms AND server API routes
import { z } from 'zod';

// ── Core Order ─────────────────────────────────────────────────
export const OrderFormSchema = z.object({
  // Identity
  type: z.enum(['PROGRAM','PROJECT','DELIVERABLE','TASK','SUBTASK']),
  name: z.string().min(1, 'Name is required').max(500).trim(),

  // Linkage
  unitId:    z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  parentId:  z.string().nullable().optional(),
  ownerId:   z.string().nullable().optional(),

  // Status
  priority:        z.enum(['LOW','MEDIUM','HIGH','CRITICAL']),
  status:          z.enum(['NOT_STARTED','IN_PROGRESS','UNDER_REVIEW','BLOCKED','ON_HOLD','DONE','CANCELLED']),
  percentComplete: z.number().int().min(0).max(100),

  // Dates
  startDate: z.string().nullable().optional(),
  dueDate:   z.string().nullable().optional(),

  // RAG override
  ragOverride:     z.enum(['RED','AMBER','GREEN','BLUE','GREY']).nullable().optional(),
  ragOverrideNote: z.string().max(300).nullable().optional(),

  // Content
  dependencies: z.string().max(500).nullable().optional(),
  links:        z.string().max(1000).nullable().optional(),
  notes:        z.string().max(2000).nullable().optional(),
  govReviewRequired: z.boolean().optional().default(false),
  projectType: z.enum(['SYSTEM_BUILD', 'DATA_ANALYSIS', 'OTHER']).nullable().optional(),
}).refine(
  data => {
    if (data.startDate && data.dueDate) {
      return new Date(data.dueDate) >= new Date(data.startDate);
    }
    return true;
  },
  { message: 'Due date must be after start date', path: ['dueDate'] }
);

export type OrderFormValues = z.infer<typeof OrderFormSchema>;

// ── Description ────────────────────────────────────────────────
export const DescriptionFormSchema = z.object({
  objective:         z.string().max(2000).nullable().optional(),
  scope:             z.string().max(2000).nullable().optional(),
  rationale:         z.string().max(2000).nullable().optional(),
  governanceImpact:  z.string().max(2000).nullable().optional(),
  affectedUnit:      z.string().max(300).nullable().optional(),
  relatedPolicies:   z.string().max(500).nullable().optional(),
  requiredEvidence:  z.string().max(2000).nullable().optional(),
  risks:             z.string().max(2000).nullable().optional(),
});

export type DescriptionFormValues = z.infer<typeof DescriptionFormSchema>;

// ── Grid cell patch (single field update) ─────────────────────
export const GridCellPatchSchema = z.object({
  field: z.enum([
    'name','type','status','priority','percentComplete',
    'startDate','dueDate','ownerId','unitId','projectId',
    'ragOverride','notes','links','dependencies',
  ]),
  value: z.union([z.string(), z.number(), z.null()]),
});

export type GridCellPatch = z.infer<typeof GridCellPatchSchema>;

// ── Quick row (minimal create from Grid) ──────────────────────
export const QuickRowSchema = z.object({
  name:     z.string().min(1, 'Name required').max(500).trim(),
  unitId:   z.string().nullable().optional(),
  priority: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  status:   z.enum(['NOT_STARTED','IN_PROGRESS','UNDER_REVIEW','BLOCKED','ON_HOLD','DONE','CANCELLED']).default('NOT_STARTED'),
  dueDate:  z.string().nullable().optional(),
  ownerId:  z.string().nullable().optional(),
  type:     z.enum(['PROGRAM','PROJECT','DELIVERABLE','TASK','SUBTASK']).default('TASK'),
});

export type QuickRowValues = z.infer<typeof QuickRowSchema>;

// ── Default values ─────────────────────────────────────────────
export const ORDER_FORM_DEFAULTS: OrderFormValues = {
  type:            'TASK',
  name:            '',
  unitId:          null,
  projectId:       null,
  parentId:        null,
  ownerId:         null,
  priority:        'MEDIUM',
  status:          'NOT_STARTED',
  percentComplete: 0,
  startDate:       null,
  dueDate:         null,
  ragOverride:     null,
  ragOverrideNote: null,
  dependencies:    null,
  links:           null,
  notes:           null,
  govReviewRequired: false,
  projectType: null,
};

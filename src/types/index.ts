// ============================================================
// DGCC PES — Core Types
// ============================================================

// ----- RBAC -----

export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'GOVERNANCE_ADMIN'
  | 'UNIT_MANAGER'
  | 'PROJECT_OWNER'
  | 'EDITOR'
  | 'VIEWER'
  // Named institutional roles
  | 'TECH_ADMIN'       // Nora — full access (alias of SUPER_ADMIN)
  | 'GOV_EDITOR'       // Bushra, Malak, Alanoud — write governance only, viewer elsewhere, download Excel
  | 'IMPORT_VIEWER'    // Eman, Abeer — read + import/export only
  | 'DATA_ANALYST';    // Nora — full read + export, no write

export type Permission =
  // Orders
  | 'orders:view' | 'orders:create' | 'orders:edit' | 'orders:delete'
  | 'orders:bulk_edit' | 'orders:export'
  // Governance
  | 'governance:view' | 'governance:create' | 'governance:edit'
  | 'governance:delete' | 'governance:approve'
  // Gov Tasks
  | 'gov_tasks:view' | 'gov_tasks:create' | 'gov_tasks:edit' | 'gov_tasks:delete'
  // Changes
  | 'changes:view' | 'changes:create' | 'changes:edit' | 'changes:approve'
  // Briefs
  | 'briefs:view' | 'briefs:create' | 'briefs:edit' | 'briefs:publish'
  // Admin
  | 'admin:units' | 'admin:users' | 'admin:lookups' | 'admin:settings'
  // Import / Export
  | 'import:execute' | 'export:execute'
  // Audit
  | 'audit:view' | 'audit:export';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    'orders:view','orders:create','orders:edit','orders:delete','orders:bulk_edit','orders:export',
    'governance:view','governance:create','governance:edit','governance:delete','governance:approve',
    'gov_tasks:view','gov_tasks:create','gov_tasks:edit','gov_tasks:delete',
    'changes:view','changes:create','changes:edit','changes:approve',
    'briefs:view','briefs:create','briefs:edit','briefs:publish',
    'admin:units','admin:users','admin:lookups','admin:settings',
    'import:execute','export:execute',
    'audit:view','audit:export',
  ],
  ADMIN: [
    'orders:view','orders:create','orders:edit','orders:delete','orders:bulk_edit','orders:export',
    'governance:view','governance:create','governance:edit','governance:approve',
    'gov_tasks:view','gov_tasks:create','gov_tasks:edit',
    'changes:view','changes:create','changes:edit','changes:approve',
    'briefs:view','briefs:create','briefs:edit','briefs:publish',
    'admin:units','admin:lookups',
    'import:execute','export:execute',
    'audit:view','audit:export',
  ],
  GOVERNANCE_ADMIN: [
    'orders:view','orders:export',
    'governance:view','governance:create','governance:edit','governance:approve',
    'gov_tasks:view','gov_tasks:create','gov_tasks:edit','gov_tasks:delete',
    'changes:view','changes:edit','changes:approve',
    'briefs:view','briefs:create','briefs:edit','briefs:publish',
    'audit:view',
  ],
  UNIT_MANAGER: [
    'orders:view','orders:create','orders:edit','orders:bulk_edit','orders:export',
    'governance:view',
    'gov_tasks:view','gov_tasks:create','gov_tasks:edit',
    'changes:view',
    'briefs:view','briefs:create','briefs:edit',
    'export:execute',
    'audit:view',
  ],
  PROJECT_OWNER: [
    'orders:view','orders:create','orders:edit','orders:export',
    'governance:view',
    'gov_tasks:view',
    'changes:view',
    'briefs:view','briefs:create','briefs:edit',
    'export:execute',
  ],
  EDITOR: [
    'orders:view','orders:create','orders:edit','orders:export',
    'governance:view',
    'gov_tasks:view',
    'changes:view',
    'briefs:view',
  ],
  VIEWER: [
    'orders:view',
    'governance:view',
    'gov_tasks:view',
    'changes:view',
    'briefs:view',
  ],
  // Nora — Tech Admin: everything
  TECH_ADMIN: [
    'orders:view','orders:create','orders:edit','orders:delete','orders:bulk_edit','orders:export',
    'governance:view','governance:create','governance:edit','governance:delete','governance:approve',
    'gov_tasks:view','gov_tasks:create','gov_tasks:edit','gov_tasks:delete',
    'changes:view','changes:create','changes:edit','changes:approve',
    'briefs:view','briefs:create','briefs:edit','briefs:publish',
    'admin:units','admin:users','admin:lookups','admin:settings',
    'import:execute','export:execute',
    'audit:view','audit:export',
  ],
  // Eman / Abeer — Admin read + import/export
  IMPORT_VIEWER: [
    'orders:view','orders:export',
    'governance:view',
    'gov_tasks:view',
    'changes:view',
    'briefs:view',
    'import:execute','export:execute',
  ],
  // Bushra / Malak / Alanoud — Write governance, viewer elsewhere, download Excel
  GOV_EDITOR: [
    'orders:view','orders:export',
    'governance:view','governance:create','governance:edit',
    'gov_tasks:view','gov_tasks:create','gov_tasks:edit',
    'changes:view',
    'briefs:view',
    'export:execute',
  ],
  // Nora (analysis role) — full read + export, no write
  DATA_ANALYST: [
    'orders:view', 'orders:export',
    'governance:view',
    'gov_tasks:view',
    'changes:view',
    'briefs:view',
    'import:execute', 'export:execute',
    'audit:view', 'audit:export',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// ----- AUTH -----

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  initials?: string;
  role: Role;
  unitId?: string;
  unitCode?: string;
}

export interface Session {
  user: AuthUser;
  accessToken: string;
  expiresAt: number;
}

// ----- ORDERS -----

export type OrderStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'BLOCKED' | 'ON_HOLD' | 'DONE' | 'CANCELLED';
export type OrderType = 'PROGRAM' | 'PROJECT' | 'DELIVERABLE' | 'TASK' | 'SUBTASK';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RAGStatus = 'RED' | 'AMBER' | 'GREEN' | 'BLUE' | 'GREY';

export interface Order {
  id: string;
  orderCode: string;
  type: OrderType;
  name: string;
  unitId?: string;
  unitCode?: string;
  unitName?: string;
  projectId?: string;
  projectCode?: string;
  projectName?: string;
  parentId?: string;
  ownerId?: string;
  ownerName?: string;
  priority: Priority;
  status: OrderStatus;
  startDate?: string;
  dueDate?: string;
  percentComplete: number;
  plannedPercent?: number;
  ragAuto?: RAGStatus;
  ragOverride?: RAGStatus;
  ragOverrideNote?: string;
  rescheduleCount: number;
  dependencies?: string;
  links?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  isDeleted: boolean;
}

// Computed fields (client-side)
export interface OrderWithComputed extends Order {
  effectiveRAG: RAGStatus;
  isOverdue: boolean;
  projectRollup?: number;
  projectHealth?: 'RED' | 'AMBER' | 'GREEN';
}

// ----- GOVERNANCE -----

export type GovItemType = 'POLICY' | 'PROCEDURE' | 'STANDARD' | 'GUIDELINE' | 'COMMITTEE_DECISION' | 'CONTROL' | 'COMPLIANCE_REQUIREMENT' | 'UPDATE_ITEM';
export type GovItemStatus = 'DRAFT' | 'ACTIVE' | 'UNDER_REVIEW' | 'SUPERSEDED' | 'ARCHIVED';
export type GovTaskType = 'REVIEW' | 'APPROVAL' | 'DOCUMENTATION_UPDATE' | 'COMPLIANCE_CHECK' | 'POLICY_REVISION' | 'EVIDENCE_COLLECTION' | 'COMMUNICATION' | 'TRAINING' | 'IMPLEMENTATION_CHECK';
export type GovTaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'DONE' | 'CANCELLED';
export type ChangeType = 'FEATURE' | 'BUG_FIX' | 'POLICY_UPDATE' | 'SECURITY_PATCH' | 'WORKFLOW_UPDATE' | 'DATA_MODEL_UPDATE';
export type ChangeStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'IN_PROGRESS' | 'TESTING' | 'RELEASED' | 'REJECTED';

export interface GovernanceItem {
  id: string;
  govCode: string;
  title: string;
  type: GovItemType;
  status: GovItemStatus;
  priority: Priority;
  riskLevel: Priority;
  unitId?: string;
  unitCode?: string;
  ownerId?: string;
  ownerName?: string;
  reviewerId?: string;
  reviewerName?: string;
  version: string;
  effectiveDate?: string;
  nextReviewDate?: string;
  source?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface GovernanceTask {
  id: string;
  taskCode: string;
  title: string;
  type: GovTaskType;
  description?: string;
  status: GovTaskStatus;
  priority: Priority;
  govItemId?: string;
  govItemTitle?: string;
  changeRequestId?: string;
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: string;
  completionDate?: string;
  approvalRequired: boolean;
  approverId?: string;
  approverName?: string;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeRequest {
  id: string;
  changeCode: string;
  title: string;
  type: ChangeType;
  summary?: string;
  status: ChangeStatus;
  govReviewStatus: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
  riskLevel: Priority;
  requestedByName?: string;
  approvedByName?: string;
  plannedReleaseDate?: string;
  actualReleaseDate?: string;
  uatSignoff?: string;
  testingStatus?: string;
  createdAt: string;
  updatedAt: string;
}

// ----- BRIEFS -----

export type BriefStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

export interface BriefContent {
  executiveSummary?: string;
  highlights?: string;
  completedTasks?: string;
  inProgressTasks?: string;
  overdueItems?: string;
  risksBlockers?: string;
  governanceUpdates?: string;
  systemUpdates?: string;
  decisionsMade?: string;
  pendingApprovals?: string;
  nextWeekPlan?: string;
  kpiSnapshot?: string;
  references?: string;
}

export interface WeeklyBrief {
  id: string;
  briefCode: string;
  title: string;
  status: BriefStatus;
  version: string;
  weekStart?: string;
  weekEnd?: string;
  preparedByName?: string;
  unitId?: string;
  unitCode?: string;
  content?: BriefContent;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

// ----- API RESPONSES -----

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ----- FILTERS -----

export interface OrderFilters {
  search?: string;
  status?: OrderStatus;
  priority?: Priority;
  unitId?: string;
  projectId?: string;
  ragStatus?: RAGStatus;
  isOverdue?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

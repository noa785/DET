'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
  initials: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  unit: { code: string; name: string } | null;
}

interface Props {
  users: User[];
  units: { id: string; code: string; name: string }[];
  currentUserId: string;
}

const ROLES = [
  'TECH_ADMIN',
  'SUPER_ADMIN', 'ADMIN', 'GOVERNANCE_ADMIN',
  'UNIT_MANAGER', 'PROJECT_OWNER',
  'EDITOR', 'IMPORT_VIEWER',
  'GOV_EDITOR', 'DATA_ANALYST', 'VIEWER',
];

const ROLE_LABEL: Record<string, string> = {
  TECH_ADMIN:       'Tech Admin',
  SUPER_ADMIN:      'Super Admin',
  ADMIN:            'Admin',
  GOVERNANCE_ADMIN: 'Gov. Admin',
  UNIT_MANAGER:     'Unit Manager',
  PROJECT_OWNER:    'Project Owner',
  EDITOR:           'Editor',
  IMPORT_VIEWER:    'Admin (Read + Import/Export)',
  GOV_EDITOR:       'Gov. Editor + Viewer',
  DATA_ANALYST:     'Data Analyst',
  VIEWER:           'Viewer',
};

const ROLE_C: Record<string, string> = {
  TECH_ADMIN:       '#ef4444',
  SUPER_ADMIN:      '#ef4444',
  ADMIN:            '#f59e0b',
  GOVERNANCE_ADMIN: '#8b5cf6',
  UNIT_MANAGER:     '#3b82f6',
  PROJECT_OWNER:    '#06b6d4',
  EDITOR:           '#10b981',
  IMPORT_VIEWER:    '#f97316',
  GOV_EDITOR:       '#a855f7',
  DATA_ANALYST:     '#0ea5e9',
  VIEWER:           '#6b7280',
};

const AVATAR_C = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function UsersClient({ users: initial, units, currentUserId }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('VIEWER');
  const [unitId, setUnitId] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);

  const activeCount = initial.filter(u => u.isActive).length;

  function reset() {
    setName(''); setEmail(''); setRole('VIEWER'); setUnitId('');
    setPassword(''); setIsActive(true); setError(''); setEditingId(null);
  }

  function openCreate() { reset(); setShowForm(true); }

  function openEdit(u: User) {
    setEditingId(u.id);
    setName(u.name);
    setEmail(u.email);
    setRole(u.role);
    setUnitId(units.find(x => x.code === u.unit?.code)?.id || '');
    setIsActive(u.isActive);
    setPassword('');
    setError('');
    setShowForm(true);
  }

  async function handleSave() {
    if (!name.trim() || !email.trim()) { setError('Name and email are required'); return; }
    if (!editingId && (!password || password.length < 6)) { setError('Password must be at least 6 characters'); return; }
    setSaving(true); setError('');

    try {
      const payload: any = { name, email, role, unitId: unitId || null, isActive };
      if (password) payload.password = password;

      const url = editingId ? `/api/users/${editingId}` : '/api/users';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed'); return; }

      reset(); setShowForm(false); router.refresh();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDeactivate(id: string, userName: string) {
    if (id === currentUserId) { alert('Cannot deactivate your own account'); return; }
    if (!confirm(`Deactivate ${userName}? They will not be able to log in.`)) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) { alert('Failed'); return; }
      router.refresh();
    } catch { alert('Failed'); }
  }

  async function handleReactivate(id: string) {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) { alert('Failed'); return; }
      router.refresh();
    } catch { alert('Failed'); }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--text)]">Users & Roles</h1>
          <p className="text-sm text-[var(--text-3)] mt-0.5">{initial.length} users ({activeCount} active)</p>
        </div>
        <button onClick={openCreate} className="pes-btn-primary text-[13px]">+ Add User</button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-16 z-50 overflow-y-auto">
          <div className="pes-card p-6 w-full max-w-md mx-4 mb-10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-[17px] text-[var(--text)]">
                {editingId ? 'Edit User' : 'Add User'}
              </h2>
              <button onClick={() => { setShowForm(false); reset(); }} className="text-[var(--text-3)] hover:text-[var(--text)] text-xl">&times;</button>
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-[13px]">{error}</div>}

            <div>
              <label className="pes-label">Full Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sarah Al-Qahtani" className="pes-input w-full mt-1 text-[13px]" />
            </div>

            <div>
              <label className="pes-label">Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. sarah@dgcc.edu.sa" className="pes-input w-full mt-1 text-[13px]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="pes-label">Role</label>
                <select value={role} onChange={e => setRole(e.target.value)} className="pes-input w-full mt-1 text-[13px]">
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r] ?? r.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="pes-label">Unit</label>
                <select value={unitId} onChange={e => setUnitId(e.target.value)} className="pes-input w-full mt-1 text-[13px]">
                  <option value="">— None —</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.code} - {u.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="pes-label">{editingId ? 'New Password (leave empty to keep current)' : 'Password *'}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder={editingId ? 'Leave empty to keep current' : 'Min 6 characters'}
                className="pes-input w-full mt-1 text-[13px]" />
            </div>

            {editingId && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                  className="rounded border-slate-600" />
                <label htmlFor="active" className="text-[13px] text-[var(--text-2)]">Active</label>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
              <button onClick={() => { setShowForm(false); reset(); }} className="pes-btn-ghost text-[13px]">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="pes-btn-primary text-[13px]">
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="pes-card overflow-hidden overflow-x-auto">
        <table className="w-full text-[13px] border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
              {['Name', 'Email', 'Role', 'Unit', 'Active', 'Last Login', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-3)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {initial.map((u, idx) => {
              const rc = ROLE_C[u.role] ?? '#6b7280';
              const ac = AVATAR_C[idx % AVATAR_C.length];
              return (
                <tr key={u.id} className={'border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors' + (!u.isActive ? ' opacity-50' : '')}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-[var(--text)]" style={{ background: ac }}>
                        {u.initials || u.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                      <span className="text-[var(--text)] font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-2)]">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded" style={{ background: rc + '18', color: rc }}>
                      {ROLE_LABEL[u.role] ?? u.role.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-2)]">{u.unit?.code ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    {u.isActive
                      ? <span className="text-green-400 text-[12px]">● Active</span>
                      : <span className="text-red-400 text-[12px]">● Inactive</span>}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-[var(--text-3)]">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : 'Never'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(u)} className="text-[11.5px] text-blue-400 hover:text-blue-300">Edit</button>
                      {u.id !== currentUserId && (
                        u.isActive
                          ? <button onClick={() => handleDeactivate(u.id, u.name)} className="text-[11.5px] text-red-400 hover:text-red-300">Deactivate</button>
                          : <button onClick={() => handleReactivate(u.id)} className="text-[11.5px] text-green-400 hover:text-green-300">Reactivate</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

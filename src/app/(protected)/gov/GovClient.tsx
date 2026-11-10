'use client';
// Governance register: one list for the governance of SE and Automation projects and of every ELI unit.
// The governance officer edits here or in her Google Sheet; both stay in step every 5 minutes.

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  GOV_ITEM_STATUS, GOV_ITEM_STATUS_KEYS, GOV_ITEM_TYPE, GOV_ITEM_TYPE_KEYS, GOV_SCOPE, SECTIONS, govOverdue, pct,
  type DetGov, type DetProject, type DetUnit, type GovItemStatus, type GovItemType, type GovScope,
} from '@/lib/det/shared';
import { GovItemPill, Icon, PageHeader, UnitSelect, api, toast } from '@/components/det/ui';
import { useLang } from '@/lib/i18n/client';
import { locale, type Lang } from '@/lib/i18n/core';

/** A YYYY-MM-DD date in the reader's language. */
function fdate(iso: string | null, lang: Lang): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale(lang), { day: 'numeric', month: 'short', year: 'numeric' });
}

type Draft = Omit<DetGov, 'id' | 'code' | 'updatedAt' | 'projectSection'> & { id?: string; code?: string };
const EMPTY: Draft = {
  scope: 'UNIT', projectCode: null, projectName: null, unitCode: null, unitName: null, title: '', type: 'OTHER',
  status: 'PLANNED', owner: '', due: null, lastReview: null, nextReview: null, evidence: '', notes: '', titleAr: '', notesAr: '',
};

export default function GovClient({ initial, projects, units, owners, canEdit }: {
  initial: DetGov[]; projects: DetProject[]; units: DetUnit[]; owners: string[]; canEdit: boolean;
}) {
  const { t, lang } = useLang();
  const [items, setItems] = useState(initial);
  const [scope, setScope] = useState<'ALL' | GovScope>('ALL');
  const [status, setStatus] = useState<'' | GovItemStatus>('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Draft | null>(null);
  useEffect(() => setItems(initial), [initial]);

  // The governance officer may write in Arabic only: show the language of the page first, the other one as fallback.
  const titleOf = (g: Pick<DetGov, 'title' | 'titleAr'>) => (lang === 'ar' ? g.titleAr || g.title : g.title || g.titleAr);
  const target = (g: Pick<DetGov, 'scope' | 'projectName' | 'unitName'>) => (g.scope === 'PROJECT' ? g.projectName : g.unitName) || 'Not linked';
  const shownTarget = (g: Pick<DetGov, 'scope' | 'projectName' | 'unitName'>) => { const x = target(g); return x === 'Not linked' ? t('Not linked') : x; };
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items
      .filter(g => (scope === 'ALL' || g.scope === scope) && (!status || g.status === status) &&
        (!s || `${g.code} ${g.title} ${g.titleAr} ${g.owner} ${target(g)} ${g.projectCode ?? ''} ${g.unitCode ?? ''}`.toLowerCase().includes(s)))
      .sort((a, b) => a.scope.localeCompare(b.scope) || target(a).localeCompare(target(b)) || a.code.localeCompare(b.code));
  }, [items, scope, status, q]);

  const approved = items.filter(g => g.status === 'APPROVED').length;
  const overdue = items.filter(g => govOverdue(g)).length;
  const covered = new Set(items.filter(g => g.scope === 'UNIT' && g.unitCode).map(g => g.unitCode));
  const notCovered = units.filter(u => !covered.has(u.code));

  return (
    <>
      <PageHeader title={t('Governance register')} sub={t('Governance of Systems Engineering and Automation projects, and of every ELI unit.')}
        actions={<>
          <a className="btn" href="/api/work/governance/export" download title={t('Download the governance register as an Excel file')}><Icon name="xls" size={16} />{t('Download Excel')}</a>
          {canEdit && <button className="btn primary" onClick={() => setOpen({ ...EMPTY })}><Icon name="plus" size={16} />{t('Add item')}</button>}
        </>} />
      <div className="gov-chips">
        <div className="gov-chip"><b>{items.length}</b><span>{t('Governance items')}</span></div>
        <div className="gov-chip"><b>{pct(approved, items.length)}%</b><span>{t('Approved ({n})', { n: approved })}</span></div>
        <div className="gov-chip"><b style={{ color: overdue ? 'var(--red)' : undefined }}>{overdue}</b><span>{t('Reviews overdue')}</span></div>
        <div className="gov-chip"><b>{t('{n} of {total}', { n: covered.size, total: units.length })}</b><span>{t('ELI units covered')}</span></div>
      </div>
      <div className="card">
        <div className="toolbar">
          <div className="chips">
            {(['ALL', 'PROJECT', 'UNIT'] as const).map(k => (
              <button key={k} className={`chip${scope === k ? ' on' : ''}`} onClick={() => setScope(k)}>
                {t(k === 'ALL' ? 'All' : k === 'PROJECT' ? 'Projects' : 'Units')} <span className="n">{k === 'ALL' ? items.length : items.filter(g => g.scope === k).length}</span>
              </button>
            ))}
          </div>
          <div className="tb-search"><Icon name="search" size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search governance')} /></div>
        </div>
        <div className="filter-row">
          <span className="fr-label"><Icon name="filter" size={14} />{t('Filter')}</span>
          <select className="fr-unit" value={status} onChange={e => setStatus(e.target.value as GovItemStatus | '')} aria-label={t('Status')}>
            <option value="">{t('All statuses')}</option>
            {GOV_ITEM_STATUS_KEYS.map(k => <option key={k} value={k}>{t(GOV_ITEM_STATUS[k].label)}</option>)}
          </select>
          <span className="fr-count">{list.length === 1 ? t('{n} item', { n: 1 }) : t('{n} items', { n: list.length })}</span>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>{t('Governance item')}</th><th>{t('Type')}</th><th>{t('Owner')}</th><th>{t('Status')}</th><th>{t('Due')}</th><th>{t('Next review')}</th></tr></thead>
            <tbody>
              {list.map((g, i) => {
                const head = i === 0 || list[i - 1].scope !== g.scope || target(list[i - 1]) !== target(g);
                return (
                  <Fragment key={g.id}>
                    {head && (
                      <tr className="proj-row"><td colSpan={6}>
                        <Icon name={g.scope === 'PROJECT' ? 'folder' : 'gov'} size={15} /><b>{shownTarget(g)}</b>
                        <span className="t-code">{t(GOV_SCOPE[g.scope])}{g.scope === 'PROJECT' && g.projectSection ? ` · ${t(SECTIONS[g.projectSection].name)}` : ''}</span>
                      </td></tr>
                    )}
                    <tr className="click" onClick={() => setOpen({ ...g, title: g.title === g.titleAr ? '' : g.title })}>
                      <td><div className="t-name"><bdi>{titleOf(g)}</bdi></div><div className="t-code">{g.code}</div></td>
                      <td className="muted" style={{ fontSize: 13 }}>{GOV_ITEM_TYPE[g.type] ? t(GOV_ITEM_TYPE[g.type]) : g.type}</td>
                      <td>{g.owner || <span className="muted">-</span>}</td>
                      <td><GovItemPill status={g.status} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{g.due ? fdate(g.due, lang) : <span className="muted">-</span>}</td>
                      <td className={govOverdue(g) ? 'over' : ''} style={{ whiteSpace: 'nowrap' }}>{g.nextReview ? fdate(g.nextReview, lang) : <span className="muted">-</span>}{govOverdue(g) ? t(' · overdue') : ''}</td>
                    </tr>
                  </Fragment>
                );
              })}
              {!list.length && <tr><td colSpan={6}><div className="empty"><b>{t(items.length ? 'No items match' : 'No governance items yet')}</b>{t(items.length ? 'Try another filter or search.' : canEdit ? 'Use Add item, or fill the governance Google Sheet.' : 'Items added by the governance officer will appear here.')}</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {!!notCovered.length && (
        <details className="card mt card-b">
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t('ELI units without governance items yet ({n})', { n: notCovered.length })}</summary>
          <p className="muted" style={{ marginTop: 10, lineHeight: 1.8 }}>{notCovered.map(u => u.name).join(' · ')}</p>
        </details>
      )}
      <GovDrawer draft={open} projects={projects} units={units} owners={owners} canEdit={canEdit} onClose={() => setOpen(null)}
        onSaved={g => setItems(prev => (prev.some(x => x.id === g.id) ? prev.map(x => (x.id === g.id ? g : x)) : [...prev, g]))}
        onRemoved={id => setItems(prev => prev.filter(x => x.id !== id))} />
    </>
  );
}

function GovDrawer({ draft, projects, units, owners, canEdit, onClose, onSaved, onRemoved }: {
  draft: Draft | null; projects: DetProject[]; units: DetUnit[]; owners: string[]; canEdit: boolean;
  onClose: () => void; onSaved: (g: DetGov) => void; onRemoved: (id: string) => void;
}) {
  const { t, lang } = useLang();
  const [f, setF] = useState<Draft | null>(draft);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setF(draft); setErr(''); }, [draft]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const open = !!draft && !!f;
  const set = (p: Partial<Draft>) => setF(x => (x ? { ...x, ...p } : x));

  async function save() {
    if (!f) return;
    if (!f.title.trim() && !f.titleAr.trim()) { setErr(t('Please write the governance item (in English or Arabic).')); return; }
    setSaving(true); setErr('');
    try {
      const body = {
        scope: f.scope, target: f.scope === 'PROJECT' ? f.projectCode : f.unitCode, title: f.title, titleAr: f.titleAr, type: f.type, status: f.status,
        owner: f.owner, due: f.due, lastReview: f.lastReview, nextReview: f.nextReview, evidence: f.evidence, notes: f.notes, notesAr: f.notesAr,
      };
      const g = await api<DetGov>(f.id ? `/api/work/governance/${f.id}` : '/api/work/governance', f.id ? 'PATCH' : 'POST', body);
      onSaved(g); toast(t(f.id ? 'Governance item updated' : 'Governance item added')); onClose();
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!f?.id) return;
    setSaving(true);
    try { await api(`/api/work/governance/${f.id}`, 'DELETE'); onRemoved(f.id); toast(t('Governance item removed')); onClose(); }
    catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div className="drawer-bg" onClick={onClose} style={open ? { opacity: 1, visibility: 'visible' } : undefined} />
      <aside className="drawer" aria-hidden={!open} style={open ? { transform: 'none', visibility: 'visible' } : undefined}>
        {f && (
          <>
            <div className="drawer-h">
              <div style={{ flex: 1 }}>
                <div className="eyebrow" style={{ color: 'var(--teal)' }}>{t('Governance')}{f.code ? ` · ${f.code}` : t(' · new item')}</div>
                <h2><bdi>{(lang === 'ar' ? f.titleAr || f.title : f.title || f.titleAr) || t('New governance item')}</bdi></h2>
              </div>
              <button className="x" onClick={onClose} aria-label={t('Close')}><Icon name="x" size={18} /></button>
            </div>
            <div className="drawer-b">
              {err && <div className="err-banner">{err}</div>}
              {!canEdit && <div className="ro" style={{ marginBottom: 14 }}>{t('View only. The governance register is updated by the governance officer.')}</div>}
              <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                <div className="two">
                  <div className="f">
                    <label htmlFor="g-scope">{t('About')}</label>
                    <select id="g-scope" value={f.scope} onChange={e => set({ scope: e.target.value as GovScope, projectCode: null, projectName: null, unitCode: null, unitName: null })}>
                      <option value="UNIT">{t('An ELI unit')}</option><option value="PROJECT">{t('A project')}</option>
                    </select>
                  </div>
                  <div className="f">
                    <label htmlFor="g-target">{t(f.scope === 'PROJECT' ? 'Project' : 'Unit')}</label>
                    {f.scope === 'PROJECT' ? (
                      <select id="g-target" value={f.projectCode ?? ''} onChange={e => set({ projectCode: e.target.value || null, projectName: projects.find(p => p.code === e.target.value)?.name ?? null })}>
                        <option value="">{t('Choose a project')}</option>
                        {projects.map(p => <option key={p.code} value={p.code}>{p.name} ({p.section ? SECTIONS[p.section].short : '-'})</option>)}
                      </select>
                    ) : (
                      <UnitSelect id="g-target" units={units} value={f.unitCode ?? ''} emptyLabel={t('Choose a unit')}
                        onChange={code => set({ unitCode: code || null, unitName: units.find(u => u.code === code)?.name ?? null })} />
                    )}
                  </div>
                </div>
                <div className="f">
                  <label htmlFor="g-title">{t('Governance item')}</label>
                  <input id="g-title" value={f.title} onChange={e => set({ title: e.target.value })} placeholder={t('e.g. Data access policy approved by the unit head')} />
                </div>
                <div className="f">
                  <label htmlFor="g-title-ar">{t('Governance item (Arabic)')}</label>
                  <input id="g-title-ar" dir="rtl" lang="ar" value={f.titleAr} onChange={e => set({ titleAr: e.target.value })} placeholder="مثال: اعتماد سياسة الوصول إلى البيانات من رئيس الوحدة" />
                </div>
                <div className="two">
                  <div className="f">
                    <label htmlFor="g-type">{t('Type')}</label>
                    <select id="g-type" value={f.type} onChange={e => set({ type: e.target.value as GovItemType })}>
                      {GOV_ITEM_TYPE_KEYS.map(k => <option key={k} value={k}>{t(GOV_ITEM_TYPE[k])}</option>)}
                    </select>
                  </div>
                  <div className="f">
                    <label htmlFor="g-status">{t('Status')}</label>
                    <select id="g-status" value={f.status} onChange={e => set({ status: e.target.value as GovItemStatus })}>
                      {GOV_ITEM_STATUS_KEYS.map(k => <option key={k} value={k}>{t(GOV_ITEM_STATUS[k].label)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="two">
                  <div className="f">
                    <label htmlFor="g-owner">{t('Owner')}</label>
                    <input id="g-owner" list="g-owners" value={f.owner} onChange={e => set({ owner: e.target.value })} />
                    <datalist id="g-owners">{owners.map(o => <option key={o} value={o} />)}</datalist>
                  </div>
                  <div className="f">
                    <label htmlFor="g-due">{t('Due date')}</label>
                    <input id="g-due" type="date" value={f.due ?? ''} onChange={e => set({ due: e.target.value || null })} />
                  </div>
                </div>
                <div className="two">
                  <div className="f">
                    <label htmlFor="g-last">{t('Last review')}</label>
                    <input id="g-last" type="date" value={f.lastReview ?? ''} onChange={e => set({ lastReview: e.target.value || null })} />
                  </div>
                  <div className="f">
                    <label htmlFor="g-next">{t('Next review')}</label>
                    <input id="g-next" type="date" value={f.nextReview ?? ''} onChange={e => set({ nextReview: e.target.value || null })} />
                  </div>
                </div>
                <div className="f">
                  <label htmlFor="g-ev">{t('Evidence link')} <span className="muted" style={{ fontWeight: 400 }}>{t('(optional)')}</span></label>
                  <input id="g-ev" value={f.evidence} onChange={e => set({ evidence: e.target.value })} placeholder={t('Link to the policy, approval or minutes')} />
                  {!canEdit && f.evidence && /^https?:\/\//.test(f.evidence) && <a className="link-btn" href={f.evidence} target="_blank" rel="noreferrer">{t('Open evidence')}</a>}
                </div>
                <div className="f">
                  <label htmlFor="g-notes">{t('Notes')} <span className="muted" style={{ fontWeight: 400 }}>{t('(optional)')}</span></label>
                  <textarea id="g-notes" dir="auto" value={f.notes} onChange={e => set({ notes: e.target.value })} />
                </div>
                <div className="f">
                  <label htmlFor="g-notes-ar">{t('Notes (Arabic)')} <span className="muted" style={{ fontWeight: 400 }}>{t('(optional)')}</span></label>
                  <textarea id="g-notes-ar" dir="rtl" lang="ar" value={f.notesAr} onChange={e => set({ notesAr: e.target.value })} />
                </div>
              </fieldset>
            </div>
            <div className="drawer-f">
              {canEdit && f.id && <button className="btn" onClick={remove} disabled={saving} style={{ marginRight: 'auto', color: 'var(--red)' }}>{t('Remove')}</button>}
              <button className="btn" onClick={onClose}>{t(canEdit ? 'Cancel' : 'Close')}</button>
              {canEdit && <button className="btn primary" onClick={save} disabled={saving}><Icon name="check" size={16} />{t(saving ? 'Saving…' : 'Save')}</button>}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

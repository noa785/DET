'use client';
// Side panel to update one order: progress, status, responsible, due date, unit,
// description points, narrative, governance and a short "what changed" note.

import { useEffect, useState } from 'react';
import { BUCKETS, BUCKET_KEYS, SECTIONS, type Bucket, type DetOrder, type DetProject, type DetUnit, type GovStatus } from '@/lib/det/shared';
import { BulletEditor, GovBox, Icon, ProjectSelect, Segmented, UnitSelect, api, fdateIn, toast } from './ui';
import { useLang } from '@/lib/i18n/client';

type Log = { id: string; text: string; by: string; at: string };

export default function OrderDrawer({ order, owners, units = [], projects = [], readOnly = false, onClose, onSaved }: {
  order: DetOrder | null; owners: string[]; units?: DetUnit[]; projects?: DetProject[]; readOnly?: boolean; onClose: () => void; onSaved: (o: DetOrder) => void;
}) {
  const { t, lang } = useLang();
  const [f, setF] = useState<DetOrder | null>(order);
  const [note, setNote] = useState('');
  const [logs, setLogs] = useState<Log[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setF(order); setNote(''); setErr(''); setLogs([]);
    if (order) api<Log[]>(`/api/work/orders/${order.id}`, 'GET').then(setLogs).catch(() => setLogs([]));
  }, [order]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const open = !!order && !!f;
  const set = (patch: Partial<DetOrder>) => setF(p => (p ? { ...p, ...patch } : p));
  const setProgress = (v: number) => {
    if (!f) return;
    let bucket: Bucket = f.bucket;
    if (v === 100) bucket = 'DONE'; else if (bucket === 'DONE') bucket = 'IN_PROGRESS'; else if (v > 0 && bucket === 'NOT_STARTED') bucket = 'IN_PROGRESS';
    set({ progress: v, bucket });
  };
  const setBucket = (b: Bucket) => set({ bucket: b, ...(b === 'DONE' ? { progress: 100 } : {}) });

  async function save() {
    if (!f || !order || readOnly) return;
    setSaving(true); setErr('');
    try {
      const saved = await api<DetOrder>(`/api/work/orders/${order.id}`, 'PATCH', {
        bucket: f.bucket, progress: f.progress, ownerName: f.owner, project: f.projectName || null, dueDate: f.due || null, unitCode: f.unitCode || null,
        points: f.points, narrative: f.narrative, govStatus: f.gov, govNote: f.govNote, govNoteAr: f.govNoteAr, note: note || undefined,
      });
      onSaved(saved); toast(t('Order updated')); onClose();
    } catch (e) { setErr((e as Error).message); }
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
                <div className="eyebrow" style={{ color: SECTIONS[f.section].color }}>{t(SECTIONS[f.section].name)} · {f.code}{f.unitCode ? ` · ${f.unitCode}` : ''}</div>
                <h2>{f.name}</h2>
              </div>
              <button className="x" onClick={onClose} aria-label={t('Close')}><Icon name="x" size={18} /></button>
            </div>
            <div className="drawer-b">
              {err && <div className="err-banner">{err}</div>}
              {readOnly && <div className="ro" style={{ marginBottom: 14 }}>{t('View only. This order belongs to {section}, which is updated by its own team.', { section: t(SECTIONS[f.section].name) })}</div>}
              <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
              <div className="f">
                <label>{t('Progress')}</label>
                <div className="range-val">{f.progress}%</div>
                <input type="range" min={0} max={100} step={1} value={f.progress} style={{ ['--p' as string]: `${f.progress}%` }}
                  onChange={e => setProgress(Number(e.target.value))} />
              </div>
              <div className="f">
                <label>{t('Status')}</label>
                <Segmented value={f.bucket} onChange={setBucket}
                  options={BUCKET_KEYS.map(k => ({ key: k, label: t(BUCKETS[k].label), color: BUCKETS[k].color }))} />
              </div>
              <div className="two">
                <div className="f">
                  <label htmlFor="d-owner">{t('Responsible')}</label>
                  <input id="d-owner" list="det-owners" value={f.owner} onChange={e => set({ owner: e.target.value })} />
                  <datalist id="det-owners">{owners.map(o => <option key={o} value={o} />)}</datalist>
                </div>
                <div className="f">
                  <label htmlFor="d-due">{t('Due date')}</label>
                  <input id="d-due" type="date" value={f.due ?? ''} onChange={e => set({ due: e.target.value || null })} />
                </div>
              </div>
              <div className="f">
                <label htmlFor="d-project">{t('Project')}</label>
                <ProjectSelect key={f.id} id="d-project" projects={projects} value={f.projectName ?? ''}
                  onChange={name => set({ projectName: name || null, projectCode: projects.find(p => p.name === name)?.code ?? null })} />
              </div>
              <div className="f">
                <label htmlFor="d-unit">{t('Unit')}</label>
                <UnitSelect id="d-unit" units={units} value={f.unitCode ?? ''}
                  onChange={code => set({ unitCode: code || null, unitName: units.find(u => u.code === code)?.name ?? null })} />
              </div>
              <div className="f">
                <label>{t('Description')}</label>
                <BulletEditor value={f.points} onChange={points => set({ points })} />
              </div>
              <div className="f">
                <label htmlFor="d-narr">{t('Narrative')} <span className="muted" style={{ fontWeight: 400 }}>{t('(optional)')}</span></label>
                <textarea id="d-narr" value={f.narrative} onChange={e => set({ narrative: e.target.value })} />
              </div>
              {f.risks && <div className="f"><label>{t('Risks')}</label><div className="ro">{f.risks}</div></div>}
              {f.nextSteps && <div className="f"><label>{t('Next steps')}</label><div className="ro">{f.nextSteps}</div></div>}
              <div className="f">
                <GovBox section={f.section} value={f.gov} note={f.govNote} noteAr={f.govNoteAr}
                  onChange={(gov: GovStatus) => set({ gov })} onNote={govNote => set({ govNote })} onNoteAr={govNoteAr => set({ govNoteAr })} />
              </div>
              {!readOnly && <div className="f">
                <label htmlFor="d-note">{t('Update note')} <span className="muted" style={{ fontWeight: 400 }}>{t('(optional)')}</span></label>
                <textarea id="d-note" value={note} onChange={e => setNote(e.target.value)} placeholder={t('What changed?')} />
              </div>}
              </fieldset>
              <div className="f">
                <label>{t('History')}</label>
                <div className="log">
                  {logs.length ? logs.map(l => <div key={l.id}>{l.text}<span>{l.by}{l.by ? ' · ' : ''}{fdateIn(lang, l.at.slice(0, 10))}</span></div>)
                    : <div>{t('No changes recorded yet')}<span>{t('Changes you save will appear here')}</span></div>}
                </div>
              </div>
            </div>
            <div className="drawer-f">
              <button className="btn" onClick={onClose}>{t(readOnly ? 'Close' : 'Cancel')}</button>
              {!readOnly && <button className="btn primary" onClick={save} disabled={saving}><Icon name="check" size={16} />{t(saving ? 'Saving…' : 'Save changes')}</button>}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

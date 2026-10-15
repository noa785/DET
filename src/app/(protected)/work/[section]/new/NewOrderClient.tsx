'use client';
// Add Order: choose the section, write the order, list its points. Done.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SECTIONS, SECTION_LIST, type DetUnit, type GovStatus, type SectionKey, type DetOrder } from '@/lib/det/shared';
import { BulletEditor, GovBox, Icon, PageHeader, UnitSelect, api, sectionIcon, toast } from '@/components/det/ui';

export default function NewOrderClient({ section, owners, units, me }: {
  section: SectionKey; owners: string[]; units: DetUnit[]; me: string;
}) {
  const router = useRouter();
  const [sec, setSec] = useState<SectionKey>(section);
  const [name, setName] = useState('');
  const [owner, setOwner] = useState(me);
  const [unit, setUnit] = useState('');
  const [due, setDue] = useState('');
  const [points, setPoints] = useState<string[]>(['']);
  const [showNarr, setShowNarr] = useState(false);
  const [narrative, setNarrative] = useState('');
  const [gov, setGov] = useState<GovStatus>('NOT_REQUIRED');
  const [govNote, setGovNote] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const s = SECTIONS[sec];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true); setErr('');
    if (!name.trim() || !due) return;
    setSaving(true);
    try {
      const o = await api<DetOrder>('/api/work/orders', 'POST', {
        section: sec, name, ownerName: owner, unitCode: unit || null, dueDate: due,
        points: points.map(p => p.trim()).filter(Boolean), narrative, govStatus: gov, govNote,
      });
      toast(`Order saved in ${s.name}`);
      router.push(`/work/${s.slug}?new=${o.id}`);
      router.refresh();
    } catch (e2) { setErr((e2 as Error).message); setSaving(false); }
  }

  return (
    <>
      <PageHeader section={sec} title="Add Order" sub="Choose the section, write the order, list its points. Done." />
      <div className="card card-b form sec-card" style={{ ['--sc' as string]: s.color }}>
        <form onSubmit={submit} noValidate>
          {err && <div className="err-banner">{err}</div>}
          <div className="f">
            <label>Section</label><div className="hint">Where will this order be saved?</div>
            <div className="secpick">
              {SECTION_LIST.map(x => (
                <button key={x.key} type="button" className={x.key === sec ? 'on' : ''} style={{ ['--c' as string]: x.color }} onClick={() => setSec(x.key)}>
                  <span className="sp-ic"><Icon name={sectionIcon(x.key)} size={20} /></span>
                  <span className="sp-t"><b>{x.name}</b><small>{x.hint}</small></span>
                  <span className="sp-check"><Icon name="check" size={16} /></span>
                </button>
              ))}
            </div>
          </div>

          <div className={`f${tried && !name.trim() ? ' bad' : ''}`}>
            <label htmlFor="n-name">Order</label>
            <input id="n-name" autoFocus autoComplete="off" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Automatic weekly attendance report" />
            <div className="err">Please write the order.</div>
          </div>

          <div className="three-col">
            <div className="f">
              <label htmlFor="n-owner">Responsible</label>
              <input id="n-owner" list="n-owners" value={owner} onChange={e => setOwner(e.target.value)} />
              <datalist id="n-owners">{owners.map(o => <option key={o} value={o} />)}</datalist>
            </div>
            <div className={`f${tried && !due ? ' bad' : ''}`}>
              <label htmlFor="n-due">Due date</label>
              <input id="n-due" type="date" value={due} onChange={e => setDue(e.target.value)} />
              <div className="err">Please pick a due date.</div>
            </div>
            <div className="f">
              <label htmlFor="n-unit">Unit <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
              <UnitSelect id="n-unit" units={units} value={unit} onChange={setUnit} />
            </div>
          </div>

          <div className="f">
            <label>Description</label><div className="hint">One point per line. Press Enter for a new point.</div>
            <BulletEditor value={points} onChange={setPoints} />
          </div>

          <div className="f">
            {!showNarr ? (
              <button type="button" className="link-btn" onClick={() => setShowNarr(true)}><Icon name="plus" size={15} />Add a narrative <span className="muted">(optional)</span></button>
            ) : (
              <>
                <label htmlFor="n-narr">Narrative <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
                <textarea id="n-narr" autoFocus value={narrative} onChange={e => setNarrative(e.target.value)} placeholder="A short paragraph, if you want to explain more." />
              </>
            )}
          </div>

          <GovBox section={sec} value={gov} note={govNote} onChange={setGov} onNote={setGovNote} />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn primary big" type="submit" disabled={saving}><Icon name="check" size={18} />{saving ? 'Saving…' : `Save to ${s.name}`}</button>
            <Link className="btn big" href={`/work/${s.slug}`}>Cancel</Link>
          </div>
        </form>
      </div>
    </>
  );
}

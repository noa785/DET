'use client';
// Performance KPIs: three indicators, one card per section, and what needs attention.

import { useState } from 'react';
import Link from 'next/link';
import { AUTOMATION_TARGETS, SECTIONS, SECTION_LIST, SYSTEM_STATUS, automationRate, fdate, isLate, nextTarget, pct, type DetOrder, type DetSystem, type SectionKey } from '@/lib/det/shared';
import { GovPill, Icon, Ring, api, sectionIcon, toast } from '@/components/det/ui';
import { downloadKpiReport, type ReportKind } from '@/lib/det/report';

export default function KpiClient({ orders, systems, userName }: { orders: DetOrder[]; systems: DetSystem[]; userName: string }) {
  const [busy, setBusy] = useState<ReportKind | null>(null);
  const done = orders.filter(o => o.bucket === 'DONE').length;
  const late = orders.filter(o => isLate(o)).length;
  const needGov = orders.filter(o => o.gov !== 'NOT_REQUIRED');
  const govOk = needGov.filter(o => o.gov === 'APPROVED').length;
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = userName.split(/\s+/)[0];

  const K = [
    { l: 'Completion', v: pct(done, orders.length), s: `${done} of ${orders.length} orders are done`, c: '#1E9E6A' },
    { l: 'On time', v: pct(orders.length - late, orders.length), s: late ? `${late} order${late === 1 ? ' is' : 's are'} late` : 'Nothing is late', c: '#158B87' },
    { l: 'Governance', v: pct(govOk, needGov.length), s: `${govOk} of ${needGov.length} reviews approved`, c: '#C9A24E' },
  ];
  const attention = orders.filter(o => isLate(o) || o.gov === 'PENDING')
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));

  async function report(kind: ReportKind) {
    setBusy(kind);
    try {
      await downloadKpiReport(orders, systems, userName, kind);
      toast(kind === 'detailed' ? 'Detailed report downloaded' : 'Summary report downloaded');
      api('/api/work/activity', 'POST', { action: 'EXPORT', notes: `Downloaded the ${kind} KPI report (PDF)` }).catch(() => null);
    }
    catch { toast('Could not create the report'); }
    finally { setBusy(null); }
  }

  const team = (key: SectionKey) => {
    const s = SECTIONS[key], L = orders.filter(o => o.section === key);
    const d = L.filter(o => o.bucket === 'DONE').length, lt = L.filter(o => isLate(o)).length, gw = L.filter(o => o.gov === 'PENDING').length;
    return (
      <Link className="card team2" href={`/work/${s.slug}`} key={key}>
        <Ring value={pct(d, L.length)} size={96} stroke={9} color={s.color}>
          <div style={{ color: 'var(--text)' }}><b>{pct(d, L.length)}%</b><span>Done</span></div>
        </Ring>
        <div className="t2">
          <div className="t2-h"><span className="tag" style={{ background: s.color }}><Icon name={sectionIcon(key)} size={16} /></span>{s.name}</div>
          <div className="t2-row"><span>Orders</span><b>{L.length}</b></div>
          <div className="t2-row"><span>Late</span><b style={{ color: lt ? 'var(--red)' : undefined }}>{lt}</b></div>
          <div className="t2-row"><span>Waiting governance</span><b style={{ color: gw ? 'var(--amber)' : undefined }}>{gw}</b></div>
        </div>
      </Link>
    );
  };

  return (
    <>
      <section className="hero">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="eyebrow">Performance KPIs</div>
          <h1>{greet}, {first}</h1>
          <p>Three numbers that show where we are</p>
        </div>
        <div className="hero-btns">
          <button className="btn hero-btn" onClick={() => report('summary')} disabled={!!busy} title="One page: the KPI and the systems">
            <Icon name="pdf" size={17} />{busy === 'summary' ? 'Preparing…' : 'Summary report'}
          </button>
          <button className="btn hero-btn alt" onClick={() => report('detailed')} disabled={!!busy} title="The KPI, systems, work indicators and what needs attention">
            <Icon name="pdf" size={17} />{busy === 'detailed' ? 'Preparing…' : 'Detailed report'}
          </button>
        </div>
      </section>

      <div className="grid g3">
        {K.map(k => (
          <div className="card kpi3" key={k.l}>
            <Ring value={k.v} size={112} color={k.c}><div style={{ color: 'var(--text)' }}><b>{k.v}%</b></div></Ring>
            <div><div className="k3-l">{k.l}</div><div className="k3-s">{k.s}</div></div>
          </div>
        ))}
      </div>

      <SystemsBand systems={systems} />

      <div className="grid g2 mt">{SECTION_LIST.map(s => team(s.key))}</div>

      <div className="card mt">
        <div className="card-h"><h3>Needs attention</h3><span className="muted">{attention.length} order{attention.length === 1 ? '' : 's'}</span></div>
        {attention.slice(0, 15).map(o => (
          <Link className="att" key={o.id} href={`/work/${SECTIONS[o.section].slug}?open=${o.id}`}>
            <span className="av" style={{ background: SECTIONS[o.section].color, borderRadius: 8, fontSize: 10 }}>{SECTIONS[o.section].short}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="att-t">{o.name}</div>
              <div className="muted">{o.owner}{o.due ? ` · due ${fdate(o.due)}` : ''}</div>
            </div>
            {isLate(o) ? <span className="pill" style={{ color: 'var(--red)', background: '#CC3D3317' }}>Late</span> : <GovPill gov={o.gov} />}
          </Link>
        ))}
        {attention.length > 15 && <div className="more">And {attention.length - 15} more. Open a section to see all orders.</div>}
        {!attention.length && <div className="empty"><b>All clear</b>Nothing is late or waiting for governance.</div>}
      </div>
    </>
  );
}

/* Strategic indicator (Goal 4) and the list of systems with a short summary each. */
function SystemsBand({ systems }: { systems: DetSystem[] }) {
  if (!systems.length) return null;
  const a = automationRate(systems), t = nextTarget();
  const gap = a.rate - t.target;
  return (
    <div className="card mt sys-band">
      <div className="card-h">
        <h3><Icon name="se" size={16} />Digital transformation indicator</h3>
        <span className="muted">Strategic plan, Goal 4</span>
      </div>
      <div className="sys-ind">
        <Ring value={a.rate} size={112} color="#0D5C59"><div style={{ color: 'var(--text)' }}><b>{a.rate}%</b></div></Ring>
        <div className="sys-ind-t">
          <div className="k3-l">Automation of administrative and academic systems</div>
          <div className="k3-s">{a.live} of {a.total} systems are live · target {t.year}: {t.target}% ({gap >= 0 ? 'met' : `${-gap} points to go`})</div>
          <div className="targets">
            {AUTOMATION_TARGETS.map(x => <span key={x.year} className={x.year === t.year ? 'on' : ''}><b>{x.year}</b>{x.year === 2030 ? `${x.target}%+` : `${x.target}%`}</span>)}
          </div>
        </div>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>System</th><th>Type</th><th>Status</th><th>Work done</th><th style={{ width: '42%' }}>Summary</th></tr></thead>
          <tbody>
            {systems.map(s => (
              <tr key={s.code}>
                <td><div className="t-name" style={{ minWidth: 180 }}>{s.name}</div><div className="t-code">{s.code}{s.unitCode && <span className="unit-tag">{s.unitCode}</span>}</div></td>
                <td className="muted" style={{ fontSize: 13 }}>{s.type === 'ACADEMIC' ? 'Academic' : 'Administrative'}</td>
                <td><span className="pill" style={{ color: SYSTEM_STATUS[s.status].color, background: `${SYSTEM_STATUS[s.status].color}17` }}>{SYSTEM_STATUS[s.status].label}</span></td>
                <td className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{s.done} of {s.orders} orders</td>
                <td style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{s.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';
// Performance KPIs: three indicators, one card per section, and what needs attention.

import { useState } from 'react';
import Link from 'next/link';
import { AUTOMATION_TARGETS, SECTIONS, SECTION_LIST, SYSTEM_STATUS, automationRate, govOverdue, groupByProject, isLate, nextTarget, pct, type DetGov, type DetOrder, type DetSystem, type SectionKey } from '@/lib/det/shared';
import { GovPill, Icon, Ring, api, sectionIcon, toast } from '@/components/det/ui';
import { downloadKpiReport, type ReportKind } from '@/lib/det/report';
import { useLang } from '@/lib/i18n/client';
import { locale, type Lang } from '@/lib/i18n/core';

/** A YYYY-MM-DD date in the reader's language. */
function fdate(iso: string | null, lang: Lang): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale(lang), { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function KpiClient({ orders, systems, gov = [], unitCount = 0, userName, reportSections = [] }: {
  orders: DetOrder[]; systems: DetSystem[]; gov?: DetGov[]; unitCount?: number; userName: string; reportSections?: SectionKey[];
}) {
  const { t, lang } = useLang();
  const [busy, setBusy] = useState<ReportKind | null>(null);
  const done = orders.filter(o => o.bucket === 'DONE').length;
  const late = orders.filter(o => isLate(o)).length;
  const needGov = orders.filter(o => o.gov !== 'NOT_REQUIRED');
  const govOk = needGov.filter(o => o.gov === 'APPROVED').length;
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = userName.split(/\s+/)[0];

  const K = [
    { k: 'done', l: t('Completion'), v: pct(done, orders.length), s: t('{done} of {total} orders are done', { done, total: orders.length }), c: '#1E9E6A' },
    { k: 'time', l: t('On time'), v: pct(orders.length - late, orders.length), s: late ? (late === 1 ? t('{n} order is late', { n: late }) : t('{n} orders are late', { n: late })) : t('Nothing is late'), c: '#158B87' },
    { k: 'gov', l: t('Governance'), v: pct(govOk, needGov.length), s: t('{ok} of {total} reviews approved', { ok: govOk, total: needGov.length }), c: '#C9A24E' },
  ];
  const attention = orders.filter(o => isLate(o) || o.gov === 'PENDING')
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));

  // Each team downloads its own section's report; whoever may download both gets the full report.
  const scope: SectionKey | null = reportSections.length === 1 ? reportSections[0] : null;
  const canReport = reportSections.length > 0;
  const scopeLabel = scope ? ` · ${SECTIONS[scope].name}` : '';
  const scopeShown = scope ? ` · ${t(SECTIONS[scope].name)}` : '';

  async function report(kind: ReportKind) {
    setBusy(kind);
    try {
      await downloadKpiReport(scope ? orders.filter(o => o.section === scope) : orders, systems, userName, kind, scope ?? undefined);
      toast(kind === 'detailed' ? t('Detailed report downloaded') : t('Summary report downloaded'));
      api('/api/work/activity', 'POST', { action: 'EXPORT', notes: `Downloaded the ${kind} KPI report (PDF)${scopeLabel}` }).catch(() => null);
    }
    catch { toast(t('Could not create the report')); }
    finally { setBusy(null); }
  }

  const team = (key: SectionKey) => {
    const s = SECTIONS[key], L = orders.filter(o => o.section === key);
    const d = L.filter(o => o.bucket === 'DONE').length, lt = L.filter(o => isLate(o)).length, gw = L.filter(o => o.gov === 'PENDING').length;
    return (
      <Link className="card team2" href={`/work/${s.slug}`} key={key}>
        <Ring value={pct(d, L.length)} size={96} stroke={9} color={s.color}>
          <div style={{ color: 'var(--text)' }}><b>{pct(d, L.length)}%</b><span>{t('Done')}</span></div>
        </Ring>
        <div className="t2">
          <div className="t2-h"><span className="tag" style={{ background: s.color }}><Icon name={sectionIcon(key)} size={16} /></span>{t(s.name)}</div>
          <div className="t2-row"><span>{t('Orders')}</span><b>{L.length}</b></div>
          <div className="t2-row"><span>{t('Late')}</span><b style={{ color: lt ? 'var(--red)' : undefined }}>{lt}</b></div>
          <div className="t2-row"><span>{t('Waiting governance')}</span><b style={{ color: gw ? 'var(--amber)' : undefined }}>{gw}</b></div>
        </div>
      </Link>
    );
  };

  return (
    <>
      <section className="hero">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="eyebrow">{t('Performance KPIs')}</div>
          <h1>{t('{greet}, {name}', { greet: t(greet), name: first })}</h1>
          <p>{t('Three numbers that show where we are')}</p>
        </div>
        {canReport && (
          <div className="hero-btns">
            <button className="btn hero-btn" onClick={() => report('summary')} disabled={!!busy} title={t('One page: the KPI and the systems{scope}', { scope: scopeShown })}>
              <Icon name="pdf" size={17} />{busy === 'summary' ? t('Preparing…') : t('Summary report{scope}', { scope: scopeShown })}
            </button>
            <button className="btn hero-btn alt" onClick={() => report('detailed')} disabled={!!busy} title={t('The KPI, systems, work indicators and what needs attention{scope}', { scope: scopeShown })}>
              <Icon name="pdf" size={17} />{busy === 'detailed' ? t('Preparing…') : t('Detailed report{scope}', { scope: scopeShown })}
            </button>
          </div>
        )}
      </section>

      <div className="grid g3">
        {K.map(k => (
          <div className="card kpi3" key={k.k}>
            <Ring value={k.v} size={112} color={k.c}><div style={{ color: 'var(--text)' }}><b>{k.v}%</b></div></Ring>
            <div><div className="k3-l">{k.l}</div><div className="k3-s">{k.s}</div></div>
          </div>
        ))}
      </div>

      <SystemsBand systems={systems} />

      <div className="grid g2 mt">{SECTION_LIST.map(s => team(s.key))}</div>

      <ProjectsCard orders={orders} />

      <GovernanceCard gov={gov} unitCount={unitCount} />

      <div className="card mt">
        <div className="card-h"><h3>{t('Needs attention')}</h3><span className="muted">{attention.length === 1 ? t('{n} order', { n: 1 }) : t('{n} orders', { n: attention.length })}</span></div>
        {attention.slice(0, 15).map(o => (
          <Link className="att" key={o.id} href={`/work/${SECTIONS[o.section].slug}?open=${o.id}`}>
            <span className="av" style={{ background: SECTIONS[o.section].color, borderRadius: 8, fontSize: 10 }}>{SECTIONS[o.section].short}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="att-t">{o.name}</div>
              <div className="muted">{o.owner}{o.due ? t(' · due {date}', { date: fdate(o.due, lang) }) : ''}</div>
            </div>
            {isLate(o) ? <span className="pill" style={{ color: 'var(--red)', background: '#CC3D3317' }}>{t('Late')}</span> : <GovPill gov={o.gov} />}
          </Link>
        ))}
        {attention.length > 15 && <div className="more">{t('And {n} more. Open a section to see all orders.', { n: attention.length - 15 })}</div>}
        {!attention.length && <div className="empty"><b>{t('All clear')}</b>{t('Nothing is late or waiting for governance.')}</div>}
      </div>
    </>
  );
}

/* Strategic indicator (Goal 4) and the list of systems with a short summary each. */
function SystemsBand({ systems }: { systems: DetSystem[] }) {
  const { t } = useLang();
  if (!systems.length) return null;
  const a = automationRate(systems), tg = nextTarget();
  const gap = a.rate - tg.target;
  return (
    <div className="card mt sys-band">
      <div className="card-h">
        <h3><Icon name="se" size={16} />{t('Digital transformation indicator')}</h3>
        <span className="muted">{t('Strategic plan, Goal 4')}</span>
      </div>
      <div className="sys-ind">
        <Ring value={a.rate} size={112} color="#0D5C59"><div style={{ color: 'var(--text)' }}><b>{a.rate}%</b></div></Ring>
        <div className="sys-ind-t">
          <div className="k3-l">{t('Automation of administrative and academic systems')}</div>
          <div className="k3-s">{t('{live} of {total} systems are live · target {year}: {target}% ({gap})', {
            live: a.live, total: a.total, year: tg.year, target: tg.target,
            gap: gap >= 0 ? t('met') : t('{n} points to go', { n: -gap }),
          })}</div>
          <div className="targets">
            {AUTOMATION_TARGETS.map(x => <span key={x.year} className={x.year === tg.year ? 'on' : ''}><b>{x.year}</b>{x.year === 2030 ? `${x.target}%+` : `${x.target}%`}</span>)}
          </div>
        </div>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>{t('System')}</th><th>{t('Type')}</th><th>{t('Status')}</th><th>{t('Work done')}</th><th style={{ width: '42%' }}>{t('Summary')}</th></tr></thead>
          <tbody>
            {systems.map(s => (
              <tr key={s.code}>
                <td><div className="t-name" style={{ minWidth: 180 }}>{t(s.name)}</div><div className="t-code">{s.code}{s.unitCode && <span className="unit-tag">{s.unitCode}</span>}</div></td>
                <td className="muted" style={{ fontSize: 13 }}>{s.type === 'ACADEMIC' ? t('Academic') : t('Administrative')}</td>
                <td><span className="pill" style={{ color: SYSTEM_STATUS[s.status].color, background: `${SYSTEM_STATUS[s.status].color}17` }}>{t(SYSTEM_STATUS[s.status].label)}</span></td>
                <td className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{t('{done} of {total} orders', { done: s.done, total: s.orders })}</td>
                <td style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{s.summary ? t(s.summary) : s.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Projects: every section's orders measured project by project. */
function ProjectsCard({ orders }: { orders: DetOrder[] }) {
  const { t } = useLang();
  const rows = SECTION_LIST.flatMap(sec => groupByProject(orders.filter(o => o.section === sec.key)).map(g => {
    const done = g.items.filter(o => o.bucket === 'DONE').length;
    return { sec, project: g.project, n: g.items.length, done, late: g.items.filter(o => isLate(o)).length, wait: g.items.filter(o => o.gov === 'PENDING').length };
  }));
  if (!rows.length) return null;
  return (
    <div className="card mt">
      <div className="card-h"><h3><Icon name="folder" size={16} />{t('Projects')}</h3><span className="muted">{rows.length === 1 ? t('{n} project', { n: 1 }) : t('{n} projects', { n: rows.length })}</span></div>
      <div className="tbl-wrap">
        <table className="proj-table">
          <thead><tr><th>{t('Project')}</th><th>{t('Section')}</th><th>{t('Orders')}</th><th>{t('Done')}</th><th>{t('Late')}</th><th>{t('Waiting governance')}</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={`${r.sec.key}-${r.project}`}>
                <td><div className="t-name">{r.project === 'No project' ? t('No project') : r.project}</div></td>
                <td><span className="pill" style={{ color: r.sec.color, background: `${r.sec.color}17` }}>{t(r.sec.name)}</span></td>
                <td>{r.n}</td>
                <td><b>{pct(r.done, r.n)}%</b> <span className="muted">({r.done})</span></td>
                <td style={{ color: r.late ? 'var(--red)' : undefined }}>{r.late}</td>
                <td style={{ color: r.wait ? 'var(--amber)' : undefined }}>{r.wait}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Governance register: approval, overdue reviews and how many ELI units are covered. */
function GovernanceCard({ gov, unitCount }: { gov: DetGov[]; unitCount: number }) {
  const { t } = useLang();
  const approved = gov.filter(g => g.status === 'APPROVED').length;
  const overdue = gov.filter(g => govOverdue(g)).length;
  const units = new Set(gov.filter(g => g.scope === 'UNIT' && g.unitCode).map(g => g.unitCode)).size;
  const projects = new Set(gov.filter(g => g.scope === 'PROJECT' && g.projectCode).map(g => g.projectCode)).size;
  return (
    <Link className="card mt" href="/gov" style={{ display: 'block' }}>
      <div className="card-h"><h3><Icon name="gov" size={16} />{t('Governance register')}</h3><span className="muted">{gov.length === 1 ? t('{n} item', { n: 1 }) : t('{n} items', { n: gov.length })}</span></div>
      <div className="gov-chips" style={{ marginBottom: 0 }}>
        <div className="gov-chip"><b>{pct(approved, gov.length)}%</b><span>{t('Approved ({n} of {total})', { n: approved, total: gov.length })}</span></div>
        <div className="gov-chip"><b style={{ color: overdue ? 'var(--red)' : undefined }}>{overdue}</b><span>{t('Reviews overdue')}</span></div>
        <div className="gov-chip"><b>{t('{n} of {total}', { n: units, total: unitCount })}</b><span>{t('ELI units covered')}</span></div>
        <div className="gov-chip"><b>{projects}</b><span>{t('Projects covered')}</span></div>
      </div>
    </Link>
  );
}

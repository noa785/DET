'use client';
// src/app/(protected)/dashboard/DashboardClient.tsx
import Link from 'next/link';

interface StatCardProps { label: string; value: number | string; sub?: string; color: string; trend?: string; href?: string; }
interface StatusDist    { label: string; count: number; color: string; }
interface UnitDist      { code: string; count: number; color: string | null; }
interface ProjectHealth { name: string; rollup: number; health: 'RED' | 'AMBER' | 'GREEN'; taskCount: number; }
interface OrderRow      { id: string; orderCode: string; name: string; unitCode?: string; unitColor?: string; status: string; percentComplete: number; priority: string; dueDate?: string; isOverdue: boolean; }
interface Props {
  stats: { total: number; done: number; active: number; review: number; blocked: number; completionRate: number; govItems: number; openGovTasks: number; pendingChanges: number; };
  statusDist: StatusDist[]; unitDist: UnitDist[]; overdueOrders: OrderRow[];
  activeOrders: OrderRow[]; projectHealth: ProjectHealth[]; userName: string;
}

export default function DashboardClient({ stats, statusDist, unitDist, overdueOrders, activeOrders, projectHealth, userName }: Props) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>
            DGCC Enterprise System
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1 }}>
            Good {now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening'}, {userName.split(' ')[0]}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 5 }}>{dateStr}</p>
        </div>
        <div style={{
          padding: '10px 18px', borderRadius: 8,
          background: stats.completionRate >= 70 ? 'rgba(5,150,105,0.08)' : 'rgba(217,119,6,0.08)',
          border: `1px solid ${stats.completionRate >= 70 ? 'rgba(5,150,105,0.2)' : 'rgba(217,119,6,0.2)'}`,
          textAlign: 'right',
        }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: stats.completionRate >= 70 ? 'var(--green)' : 'var(--amber)', letterSpacing: '-0.02em' }}>
            {stats.completionRate}%
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Completion Rate
          </div>
        </div>
      </div>

      {/* ── Primary Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatCard label="Total Orders"      value={stats.total}          sub={`${stats.done} completed`}         color="var(--accent)" href="/orders" />
        <StatCard label="In Progress"       value={stats.active}         sub={`${stats.review} under review`}    color="var(--amber)"  href="/orders?status=IN_PROGRESS" />
        <StatCard label="Overdue / At Risk" value={overdueOrders.length} sub={`${stats.blocked} blocked`}        color="var(--red)"    href="/orders?overdue=1" />
        <StatCard label="Completed"         value={stats.done}           sub={`of ${stats.total} total`}         color="var(--green)"  href="/orders?status=DONE" />
      </div>

      {/* ── Governance Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <StatCard label="Governance Items"   value={stats.govItems}      color="#7c3aed" href="/governance/review" />
        <StatCard label="Open Gov. Tasks"    value={stats.openGovTasks}  color="var(--amber)" href="/gov-tasks" />
        <StatCard label="Pending Gov. Review" value={stats.pendingChanges} color="var(--red)" href="/governance/review" />
      </div>

      {/* ── Charts Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

        {/* Status Distribution */}
        <div className="pes-card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 16 }}>Orders by Status</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
            {statusDist.map(s => {
              const max = Math.max(...statusDist.map(x => x.count), 1);
              const h = s.count > 0 ? Math.max((s.count / max) * 72, 8) : 4;
              return (
                <div key={s.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)' }}>{s.count}</div>
                  <div style={{ width: '100%', height: h, borderRadius: 3, background: s.color, opacity: 0.85, transition: 'height 0.3s' }} />
                  <div style={{ fontSize: 8.5, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.2, fontWeight: 500 }}>
                    {s.label.split(' ')[0]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Units */}
        <div className="pes-card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 14 }}>Active Units</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unitDist.slice(0, 5).map(u => {
              const max = Math.max(...unitDist.map(x => x.count), 1);
              const color = u.color && u.color.length <= 9 ? u.color : 'var(--accent)';
              return (
                <div key={u.code}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>{u.code}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{u.count}</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 99 }}>
                    <div style={{ height: 3, borderRadius: 99, background: color, width: `${(u.count / max) * 100}%`, transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })}
            {unitDist.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>No unit data</div>}
          </div>
        </div>

        {/* Project Health */}
        <div className="pes-card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 14 }}>Project Health</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {projectHealth.slice(0, 4).map(p => {
              const hc = p.health === 'RED' ? 'var(--red)' : p.health === 'AMBER' ? 'var(--amber)' : 'var(--green)';
              return (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: hc, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: hc }}>{p.rollup}%</span>
                </div>
              );
            })}
            {projectHealth.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>No projects yet</div>}
          </div>
        </div>
      </div>

      {/* ── Orders Tables ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Overdue */}
        <div className="pes-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)' }} />
              Overdue Orders
              {overdueOrders.length > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: 'rgba(220,38,38,0.1)', color: 'var(--red)', fontWeight: 700 }}>{overdueOrders.length}</span>}
            </div>
            <Link href="/orders?overdue=1" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>View all</Link>
          </div>
          {overdueOrders.length === 0 ? (
            <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>No overdue orders ✓</div>
          ) : overdueOrders.slice(0, 5).map(o => <OrderMiniRow key={o.id} order={o} />)}
        </div>

        {/* Active */}
        <div className="pes-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
              Active Orders
            </div>
            <Link href="/orders?status=IN_PROGRESS" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>View all</Link>
          </div>
          {activeOrders.length === 0 ? (
            <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>No active orders</div>
          ) : activeOrders.slice(0, 5).map(o => <OrderMiniRow key={o.id} order={o} />)}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, href }: StatCardProps) {
  const content = (
    <div className="pes-card" style={{
      padding: '16px 20px', cursor: href ? 'pointer' : 'default',
      borderLeft: `3px solid ${color}`,
      transition: 'transform 0.15s, box-shadow 0.15s',
    }}
    onMouseEnter={e => { if (href) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-lg)'; }}}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow)'; }}
    >
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>{sub}</div>}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link> : <>{content}</>;
}

function OrderMiniRow({ order }: { order: any }) {
  const prio: Record<string, string> = { CRITICAL: '#dc2626', HIGH: '#f87171', MEDIUM: '#f59e0b', LOW: '#94a3b8' };
  const color = order.unitColor && order.unitColor.length <= 9 ? order.unitColor : 'var(--accent)';
  return (
    <Link href={`/orders/${order.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 18px', borderBottom: '1px solid var(--border)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
      >
        {order.unitCode && (
          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 99, borderLeft: `2px solid ${color}`, background: `${color}15`, color, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {order.unitCode}
          </span>
        )}
        <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.name}</span>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 52, height: 3, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: 3, background: order.percentComplete === 100 ? 'var(--green)' : prio[order.priority] ?? 'var(--accent)', width: `${order.percentComplete}%` }} />
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-3)', width: 26, textAlign: 'right' }}>{order.percentComplete}%</span>
        </div>
      </div>
    </Link>
  );
}

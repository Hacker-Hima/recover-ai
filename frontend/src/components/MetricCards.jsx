import { formatCurrency, formatPercent } from '../api';

export function MetricCard({ title, value, sub, color = 'text-slate-900', icon, loading }) {
  return (
    <div className="card p-4 h-full flex flex-col justify-between transition-all duration-200 hover:shadow-sm">
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">{title}</span>
        {icon && <span className="text-lg opacity-90 flex-shrink-0">{icon}</span>}
      </div>
      <div className="my-2">
        {loading ? (
          <div className="h-7 w-28 shimmer rounded" />
        ) : (
          <div className={`text-2xl font-bold tracking-tight ${color}`}>{value}</div>
        )}
      </div>
      <div className="h-4 flex items-center">
        {sub ? (
          <span className="text-xs text-slate-500 font-medium">{sub}</span>
        ) : (
          <span className="text-xs text-transparent select-none">—</span>
        )}
      </div>
    </div>
  );
}

export function MetricGrid({ metrics, loading }) {
  if (!metrics && !loading) return null;
  const m = metrics || {};
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 items-stretch">
      <MetricCard
        title="Revenue at Risk"
        value={formatCurrency(m.revenueAtRisk)}
        color="text-amber-600"
        icon="⚠️"
        loading={loading}
      />
      <MetricCard
        title="Est. Recoverable"
        value={formatCurrency(m.estimatedRecoverable)}
        color="text-brand-600"
        icon="📊"
        loading={loading}
      />
      <MetricCard
        title="Recovered"
        value={formatCurrency(m.recoveredRevenue)}
        color="text-emerald-600"
        icon="✅"
        loading={loading}
      />
      <MetricCard
        title="Recovery Rate"
        value={formatPercent(m.recoveryRate)}
        color="text-emerald-600"
        icon="📈"
        loading={loading}
      />
      <MetricCard
        title="Human Review"
        value={m.humanReviewPending ?? '-'}
        sub="pending cases"
        color="text-amber-600"
        icon="👤"
        loading={loading}
      />
      <MetricCard
        title="Active Cases"
        value={m.activeRecoveryCases ?? '-'}
        color="text-brand-600"
        icon="⚡"
        loading={loading}
      />
    </div>
  );
}

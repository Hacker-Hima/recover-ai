import { formatCurrency, formatPercent } from '../api';

export function MetricCard({ title, value, sub, color = 'text-white', icon, loading }) {
  return (
    <div className="metric-card animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="section-title">{title}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      {loading ? (
        <div className="h-8 w-32 shimmer rounded mt-1" />
      ) : (
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
      )}
      {sub && <span className="text-xs text-slate-500 mt-0.5">{sub}</span>}
    </div>
  );
}

export function MetricGrid({ metrics, loading }) {
  if (!metrics && !loading) return null;
  const m = metrics || {};
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <MetricCard
        title="Revenue at Risk"
        value={formatCurrency(m.revenueAtRisk)}
        color="text-amber-400"
        icon="⚠️"
        loading={loading}
      />
      <MetricCard
        title="Est. Recoverable"
        value={formatCurrency(m.estimatedRecoverable)}
        color="text-brand-500"
        icon="📊"
        loading={loading}
      />
      <MetricCard
        title="Recovered"
        value={formatCurrency(m.recoveredRevenue)}
        color="text-emerald-400"
        icon="✅"
        loading={loading}
      />
      <MetricCard
        title="Recovery Rate"
        value={formatPercent(m.recoveryRate)}
        color="text-emerald-400"
        icon="📈"
        loading={loading}
      />
      <MetricCard
        title="Human Review"
        value={m.humanReviewPending ?? '-'}
        sub="pending cases"
        color="text-amber-400"
        icon="👤"
        loading={loading}
      />
      <MetricCard
        title="Active Cases"
        value={m.activeRecoveryCases ?? '-'}
        color="text-brand-500"
        icon="⚡"
        loading={loading}
      />
    </div>
  );
}

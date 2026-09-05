import { formatCurrency, formatPercent } from '../api';

export function CompareView({ data, loading }) {
  if (loading) {
    return <div className="h-48 shimmer rounded-xl" />;
  }

  if (!data?.recoverai && !data?.baseline) {
    return (
      <div className="card p-8 text-center text-slate-500">
        <p>Run both <strong className="text-brand-500">RecoverAI</strong> and <strong className="text-purple-400">Baseline</strong> to see the comparison</p>
      </div>
    );
  }

  const r = data.recoverai || {};
  const b = data.baseline || {};
  const c = data.comparison || {};

  const rows = [
    { label: 'Total Payments Processed', ai: r.total, base: b.total, unit: '' },
    { label: 'Payments Recovered', ai: r.recovered, base: b.recovered, unit: '', higherIsBetter: true },
    { label: 'Recovery Rate', ai: r.recoveryRate, base: b.recoveryRate, unit: '%', higherIsBetter: true, decimals: 1 },
    { label: 'Revenue Recovered', ai: r.recoveredRevenue, base: b.recoveredRevenue, unit: 'currency', higherIsBetter: true },
    { label: 'Avg Retries per Payment', ai: r.avgRetries, base: b.avgRetries, unit: '', higherIsBetter: false, decimals: 2 },
    { label: 'Avg Customer Contacts', ai: r.avgContacts, base: b.avgContacts, unit: '', higherIsBetter: false, decimals: 2 },
    { label: 'Human Escalation Rate', ai: r.humanEscalationRate, base: b.humanEscalationRate, unit: '%', higherIsBetter: false, decimals: 1 },
    { label: 'Stop Rate', ai: r.stopRate, base: b.stopRate, unit: '%', higherIsBetter: false, decimals: 1 },
  ];

  function fmt(val, unit, decimals = 0) {
    if (val == null) return '—';
    if (unit === 'currency') return formatCurrency(val);
    if (unit === '%') return `${(val || 0).toFixed(decimals)}%`;
    return typeof val === 'number' ? val.toFixed(decimals) : val;
  }

  function winner(ai, base, higherIsBetter) {
    if (ai == null || base == null) return null;
    if (higherIsBetter) return ai > base ? 'ai' : ai < base ? 'base' : 'tie';
    return ai < base ? 'ai' : ai > base ? 'base' : 'tie';
  }

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-3 bg-surface-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
        <div className="px-4 py-3">Metric</div>
        <div className="px-4 py-3 text-center text-brand-500">RecoverAI</div>
        <div className="px-4 py-3 text-center text-purple-400">Baseline</div>
      </div>

      {rows.map((row, i) => {
        const w = winner(row.ai, row.base, row.higherIsBetter);
        return (
          <div key={i} className="grid grid-cols-3 border-t border-white/5 hover:bg-surface-3/30 transition-colors">
            <div className="px-4 py-3 text-sm text-slate-400">{row.label}</div>
            <div className={`px-4 py-3 text-center font-semibold text-sm ${w === 'ai' ? 'text-emerald-400' : w === 'base' ? 'text-red-400' : 'text-slate-200'}`}>
              {fmt(row.ai, row.unit, row.decimals)}
              {w === 'ai' && <span className="ml-1 text-xs">▲</span>}
            </div>
            <div className={`px-4 py-3 text-center font-semibold text-sm ${w === 'base' ? 'text-emerald-400' : w === 'ai' ? 'text-red-400' : 'text-slate-200'}`}>
              {fmt(row.base, row.unit, row.decimals)}
              {w === 'base' && <span className="ml-1 text-xs">▲</span>}
            </div>
          </div>
        );
      })}

      {c.recoveryRateDiff !== undefined && (
        <div className="px-4 py-4 border-t border-white/10 bg-brand-500/5">
          <div className="text-xs text-slate-500 mb-2 uppercase tracking-wide font-semibold">Summary</div>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-slate-500">Recovery Rate: </span>
              <span className={c.recoveryRateDiff > 0 ? 'text-emerald-400' : 'text-red-400'}>
                {c.recoveryRateDiff > 0 ? '+' : ''}{(c.recoveryRateDiff || 0).toFixed(1)}% {c.recoveryRateDiff > 0 ? 'better' : 'worse'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Extra Revenue: </span>
              <span className={c.recoveredRevenueDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {c.recoveredRevenueDiff >= 0 ? '+' : ''}{formatCurrency(c.recoveredRevenueDiff)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

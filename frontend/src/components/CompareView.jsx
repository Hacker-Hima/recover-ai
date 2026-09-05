import { formatCurrency } from '../api';

export function CompareView({ data, loading }) {
  if (loading) {
    return <div className="h-48 shimmer rounded-xl" />;
  }

  if (!data?.recoverai && !data?.baseline) {
    return (
      <div className="card p-10 text-center text-slate-500">
        <div className="text-3xl mb-2">⚖️</div>
        <p className="text-base font-semibold text-slate-800">No comparison data yet</p>
        <p className="text-xs text-slate-400 mt-1">
          Run both <strong className="text-brand-600">RecoverAI Agent</strong> and <strong className="text-purple-600">Baseline</strong> to see side-by-side metrics
        </p>
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
      <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
        <div className="px-5 py-3.5">Metric</div>
        <div className="px-5 py-3.5 text-center text-brand-600">RecoverAI Agent</div>
        <div className="px-5 py-3.5 text-center text-purple-600">Blind Retry Baseline</div>
      </div>

      <div className="divide-y divide-slate-100">
        {rows.map((row, i) => {
          const w = winner(row.ai, row.base, row.higherIsBetter);
          return (
            <div key={i} className="grid grid-cols-3 hover:bg-slate-50/70 transition-colors items-center">
              <div className="px-5 py-3.5 text-sm font-medium text-slate-700">{row.label}</div>
              <div className={`px-5 py-3.5 text-center font-bold text-sm ${
                w === 'ai' ? 'text-emerald-600 bg-emerald-50/40' : w === 'base' ? 'text-rose-600' : 'text-slate-800'
              }`}>
                {fmt(row.ai, row.unit, row.decimals)}
                {w === 'ai' && <span className="ml-1 text-xs">★</span>}
              </div>
              <div className={`px-5 py-3.5 text-center font-bold text-sm ${
                w === 'base' ? 'text-emerald-600 bg-emerald-50/40' : w === 'ai' ? 'text-slate-500' : 'text-slate-800'
              }`}>
                {fmt(row.base, row.unit, row.decimals)}
                {w === 'base' && <span className="ml-1 text-xs">★</span>}
              </div>
            </div>
          );
        })}
      </div>

      {c.recoveryRateDiff !== undefined && (
        <div className="px-6 py-4 border-t border-slate-200 bg-brand-50/60">
          <div className="text-xs text-brand-700 mb-2 uppercase tracking-wider font-bold">Executive Summary</div>
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Recovery Rate Delta:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-xs ${c.recoveryRateDiff >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {c.recoveryRateDiff >= 0 ? '+' : ''}{(c.recoveryRateDiff || 0).toFixed(1)}% {c.recoveryRateDiff >= 0 ? 'higher' : 'lower'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Net Revenue Difference:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-xs ${c.recoveredRevenueDiff >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {c.recoveredRevenueDiff >= 0 ? '+' : ''}{formatCurrency(c.recoveredRevenueDiff)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

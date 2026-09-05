import { formatCurrency, formatPercent, statusBadgeClass, categoryBadgeClass, actionIcon } from '../api';

export function PriorityQueue({ payments, onSelect, loading }) {
  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h2 className="font-semibold text-slate-200">Priority Recovery Queue</h2>
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 shimmer rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!payments?.length) {
    return (
      <div className="card p-8 text-center text-slate-500">
        <p className="text-lg">No payments in queue</p>
        <p className="text-sm mt-1">Generate data or run the agent to populate</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h2 className="font-semibold text-slate-200">Priority Recovery Queue</h2>
        <span className="text-xs text-slate-500">{payments.length} payments</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Payment</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Amount</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Failure</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Rec. Prob</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Priority</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Action</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr
                key={p.paymentId}
                className="table-row animate-fade-in"
                onClick={() => onSelect(p)}
              >
                <td className="px-4 py-3">
                  <div className="mono text-slate-300">{p.paymentId}</div>
                  <div className="text-xs text-slate-500">{p.paymentMethod?.replace(/_/g, ' ')}</div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-200">
                  {formatCurrency(p.amount)}
                </td>
                <td className="px-4 py-3">
                  <span className={categoryBadgeClass(p.failureCategory)}>
                    {p.failureCategory?.replace(/_/g, ' ') || '-'}
                  </span>
                  <div className="text-xs text-slate-500 mt-0.5">{p.failureReason?.replace(/_/g, ' ')}</div>
                </td>
                <td className="px-4 py-3 text-right">
                  {p.recoveryProbability != null ? (
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-surface-4 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${p.recoveryProbability * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-300 w-10 text-right">
                        {formatPercent(p.recoveryProbability * 100)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-500 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {p.priorityScore != null ? (
                    <span className="font-mono text-xs text-slate-300">{p.priorityScore.toFixed(1)}</span>
                  ) : (
                    <span className="text-slate-500 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.decision?.selectedAction ? (
                    <span className="text-xs text-slate-300">
                      {actionIcon(p.decision.selectedAction)} {p.decision.selectedAction.replace(/_/g, ' ')}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={statusBadgeClass(p.status)}>
                    {p.status?.replace(/_/g, ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

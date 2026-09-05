import { formatCurrency, formatPercent, statusBadgeClass, categoryBadgeClass, actionIcon } from '../api';

export function PriorityQueue({ payments, onSelect, loading }) {
  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Priority Recovery Queue</h2>
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 shimmer rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!payments?.length) {
    return (
      <div className="card p-10 text-center text-slate-500">
        <div className="text-3xl mb-2">📋</div>
        <p className="text-base font-medium text-slate-700">No payments in queue</p>
        <p className="text-xs text-slate-400 mt-1">Load demo data or run the agent to populate the queue</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2.5">
          <h2 className="font-semibold text-slate-900 text-base">Priority Recovery Queue</h2>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
            {payments.length} cases
          </span>
        </div>
        <span className="text-xs text-slate-400">Click any row to inspect decision trace</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Failure Diagnosis</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rec. Prob</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Next Action</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((p) => (
              <tr
                key={p.paymentId}
                className="table-row hover:bg-slate-50/90 transition-colors cursor-pointer"
                onClick={() => onSelect(p)}
              >
                <td className="px-4 py-3.5 align-middle">
                  <div className="font-mono font-semibold text-xs text-slate-800">{p.paymentId}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{p.paymentMethod?.replace(/_/g, ' ')}</div>
                </td>
                <td className="px-4 py-3.5 text-right font-bold text-slate-900 tabular-nums align-middle">
                  {formatCurrency(p.amount)}
                </td>
                <td className="px-4 py-3.5 align-middle">
                  <span className={categoryBadgeClass(p.failureCategory)}>
                    {p.failureCategory?.replace(/_/g, ' ') || '-'}
                  </span>
                  <div className="text-xs text-slate-500 mt-1 font-medium">{p.failureReason?.replace(/_/g, ' ')}</div>
                </td>
                <td className="px-4 py-3.5 text-right align-middle">
                  {p.recoveryProbability != null ? (
                    <div className="flex items-center justify-end gap-2.5">
                      <div className="w-16 h-2 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${p.recoveryProbability * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-semibold text-slate-700 w-11 text-right">
                        {formatPercent(p.recoveryProbability * 100)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right align-middle">
                  {p.priorityScore != null ? (
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {p.priorityScore.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5 align-middle">
                  {p.decision?.selectedAction ? (
                    <span className="text-xs font-medium text-slate-800 inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
                      <span>{actionIcon(p.decision.selectedAction)}</span>
                      <span>{p.decision.selectedAction.replace(/_/g, ' ')}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5 align-middle">
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

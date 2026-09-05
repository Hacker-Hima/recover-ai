import { useState } from 'react';
import { api, formatCurrency } from '../api';

export function HumanReviewPanel({ payments, onRefresh }) {
  const [processing, setProcessing] = useState({});
  const [notes, setNotes] = useState({});

  if (!payments?.length) {
    return (
      <div className="card p-8 text-center">
        <div className="text-3xl mb-3">✅</div>
        <div className="text-slate-300 font-medium">No cases pending human review</div>
        <div className="text-slate-500 text-sm mt-1">The agent is handling all recoverable payments autonomously</div>
      </div>
    );
  }

  const handleAction = async (paymentId, action) => {
    setProcessing(p => ({ ...p, [paymentId]: action }));
    try {
      const note = notes[paymentId] || '';
      if (action === 'approve') await api.approveAction(paymentId, note);
      else if (action === 'reject') await api.rejectAction(paymentId, note);
      else if (action === 'stop') await api.stopCase(paymentId, note);
      onRefresh();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setProcessing(p => ({ ...p, [paymentId]: null }));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <h2 className="font-semibold text-amber-400">Human Review Required</h2>
        <span className="badge bg-amber-500/15 text-amber-400 border border-amber-500/20">{payments.length} cases</span>
      </div>

      {payments.map((p) => (
        <div key={p.paymentId} className="card p-4 border border-amber-500/15 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mono text-slate-400 text-xs">{p.paymentId}</div>
              <div className="font-bold text-xl text-slate-100">{formatCurrency(p.amount)}</div>
              <div className="text-sm text-slate-400 mt-0.5">
                {p.failureReason?.replace(/_/g, ' ')} · {p.failureCategory?.replace(/_/g, ' ')}
              </div>
            </div>
            <span className="badge bg-amber-500/15 text-amber-400 border border-amber-500/20 whitespace-nowrap">
              🚨 Escalated
            </span>
          </div>

          <div className="bg-surface-3 rounded-lg p-3 text-sm text-slate-300">
            <span className="text-amber-400 font-semibold text-xs block mb-1">Why the agent refused autonomous action:</span>
            {p.humanReviewReason}
          </div>

          <div>
            <input
              className="input w-full text-xs"
              placeholder="Optional review note..."
              value={notes[p.paymentId] || ''}
              onChange={e => setNotes(n => ({ ...n, [p.paymentId]: e.target.value }))}
            />
          </div>

          <div className="flex gap-2">
            <button
              className="btn-success text-xs"
              disabled={!!processing[p.paymentId]}
              onClick={() => handleAction(p.paymentId, 'approve')}
            >
              {processing[p.paymentId] === 'approve' ? '...' : '✓ Approve Action'}
            </button>
            <button
              className="btn-danger text-xs"
              disabled={!!processing[p.paymentId]}
              onClick={() => handleAction(p.paymentId, 'reject')}
            >
              {processing[p.paymentId] === 'reject' ? '...' : '✗ Reject Action'}
            </button>
            <button
              className="btn-secondary text-xs"
              disabled={!!processing[p.paymentId]}
              onClick={() => handleAction(p.paymentId, 'stop')}
            >
              {processing[p.paymentId] === 'stop' ? '...' : '⏹ Stop Case'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

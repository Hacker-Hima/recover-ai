import { useState } from 'react';
import { api, formatCurrency } from '../api';

export function HumanReviewPanel({ payments, onRefresh }) {
  const [processing, setProcessing] = useState({});
  const [notes, setNotes] = useState({});

  if (!payments?.length) {
    return (
      <div className="card p-12 text-center max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center text-xl mx-auto mb-3">
          ✓
        </div>
        <h3 className="text-slate-900 font-semibold text-base">No cases pending human review</h3>
        <p className="text-slate-500 text-sm mt-1">The recovery agent handled all current payments within safety guardrails.</p>
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
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200/80 p-4 rounded-xl">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <h2 className="font-semibold text-amber-900 text-sm">Human Review Required</h2>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            {payments.length} pending
          </span>
        </div>
        <span className="text-xs text-amber-800 font-medium">
          Policy guardrails hold ambiguous & high-value cases for approval
        </span>
      </div>

      <div className="space-y-3.5">
        {payments.map((p) => (
          <div key={p.paymentId} className="card p-5 border border-amber-200/90 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-slate-500 text-xs font-semibold">{p.paymentId}</div>
                <div className="font-bold text-2xl text-slate-900 mt-0.5">{formatCurrency(p.amount)}</div>
                <div className="text-xs text-slate-500 mt-1 font-medium">
                  {p.failureReason?.replace(/_/g, ' ')} · <span className="text-slate-700">{p.failureCategory?.replace(/_/g, ' ')}</span>
                </div>
              </div>
              <span className="badge bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap px-3 py-1">
                🚨 Escalated to Human
              </span>
            </div>

            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 text-sm text-slate-800">
              <span className="text-amber-900 font-semibold text-xs block mb-1">
                Why the agent refused autonomous action:
              </span>
              <p className="leading-relaxed text-slate-700 text-xs">{p.humanReviewReason}</p>
            </div>

            <div>
              <input
                className="input w-full text-xs"
                placeholder="Add reviewer notes (optional)..."
                value={notes[p.paymentId] || ''}
                onChange={e => setNotes(n => ({ ...n, [p.paymentId]: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                className="btn-success text-xs h-9 px-4"
                disabled={!!processing[p.paymentId]}
                onClick={() => handleAction(p.paymentId, 'approve')}
              >
                {processing[p.paymentId] === 'approve' ? '...' : '✓ Approve Action'}
              </button>
              <button
                className="btn-danger text-xs h-9 px-4"
                disabled={!!processing[p.paymentId]}
                onClick={() => handleAction(p.paymentId, 'reject')}
              >
                {processing[p.paymentId] === 'reject' ? '...' : '✗ Reject Action'}
              </button>
              <button
                className="btn-secondary text-xs h-9 px-4"
                disabled={!!processing[p.paymentId]}
                onClick={() => handleAction(p.paymentId, 'stop')}
              >
                {processing[p.paymentId] === 'stop' ? '...' : '⏹ Stop Case'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

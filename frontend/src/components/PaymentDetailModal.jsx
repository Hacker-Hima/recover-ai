import { useState, useEffect } from 'react';
import { api, formatCurrency, formatPercent, statusBadgeClass, categoryBadgeClass, actionIcon } from '../api';
import { AgentTimeline } from './AgentTimeline';

export function PaymentDetailModal({ paymentId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!paymentId) return;
    setLoading(true);
    setError(null);
    api.getPayment(paymentId)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [paymentId]);

  if (!paymentId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-2xl h-full bg-white border-l border-slate-200 shadow-2xl overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="font-mono text-xs font-semibold text-slate-500">{paymentId}</div>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">Payment Recovery Dossier</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-colors text-xl font-bold"
          >
            ×
          </button>
        </div>

        {loading && (
          <div className="p-6 space-y-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-12 shimmer rounded-xl" />)}
          </div>
        )}

        {error && (
          <div className="m-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
            {error}
          </div>
        )}

        {data && !loading && (
          <div className="p-6 space-y-6">
            {/* Payment Overview */}
            <section className="card p-5 space-y-3 bg-slate-50/60 border border-slate-200">
              <h3 className="section-title">Payment Overview</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-500 text-xs font-medium">Failed Amount</div>
                  <div className="font-bold text-2xl text-slate-900 mt-0.5">{formatCurrency(data.payment?.amount)}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs font-medium">Current Status</div>
                  <div className="mt-1"><span className={statusBadgeClass(data.payment?.status)}>{data.payment?.status?.replace(/_/g, ' ')}</span></div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs font-medium">Payment Method</div>
                  <div className="text-slate-800 font-medium capitalize mt-0.5">{data.payment?.paymentMethod?.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs font-medium">Attempt Number</div>
                  <div className="text-slate-800 font-semibold mt-0.5">{data.payment?.attemptNumber} of 3</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs font-medium">Failure Reason</div>
                  <div className="text-slate-800 font-medium mt-0.5">{data.payment?.failureReason?.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs font-medium">Taxonomy Category</div>
                  <div className="mt-1"><span className={categoryBadgeClass(data.payment?.failureCategory)}>{data.payment?.failureCategory?.replace(/_/g, ' ')}</span></div>
                </div>
                {data.payment?.recoveredAmount > 0 && (
                  <div className="col-span-2 pt-2 border-t border-slate-200">
                    <div className="text-slate-500 text-xs font-medium">Recovered Amount</div>
                    <div className="font-bold text-emerald-600 text-xl mt-0.5">{formatCurrency(data.payment?.recoveredAmount)}</div>
                  </div>
                )}
              </div>
            </section>

            {/* Customer */}
            {data.customer && (
              <section className="card p-5 space-y-3 bg-white border border-slate-200">
                <h3 className="section-title">Customer Profile & History</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500 text-xs font-medium">Historical Success Rate</div>
                    <div className="text-slate-800 font-semibold mt-0.5">{formatPercent((data.payment?.previousSuccessRate || 0) * 100)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-medium">Customer Tenure</div>
                    <div className="text-slate-800 font-semibold mt-0.5">{data.payment?.customerTenureDays} days</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-medium">Subscription Type</div>
                    <div className="text-slate-800 font-medium mt-0.5">{data.payment?.subscription ? 'Active Recurring' : 'One-time'}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-medium">Risk Tier</div>
                    <div className="text-slate-800 capitalize font-medium mt-0.5">{data.customer?.riskTier}</div>
                  </div>
                </div>
              </section>
            )}

            {/* Agent Scores */}
            {data.decision && (
              <section className="card p-5 space-y-4 bg-white border border-slate-200">
                <h3 className="section-title">Machine Learning & Agent Diagnosis</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500 text-xs font-medium">ML Recovery Probability</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-2 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${(data.decision.recoveryProbability || 0) * 100}%` }} />
                      </div>
                      <span className="font-mono font-bold text-slate-800 w-11 text-right">
                        {formatPercent((data.decision.recoveryProbability || 0) * 100)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Source: {data.decision.recoveryProbabilitySource}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-medium">Explainable Priority Score</div>
                    <div className="text-2xl font-bold text-slate-900 mt-0.5">
                      {data.decision.priorityScore?.toFixed(1)}
                      <span className="text-xs text-slate-400 font-normal"> / 100</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-medium">Diagnosis Confidence</div>
                    <div className="text-slate-800 font-semibold mt-0.5">{formatPercent((data.decision.diagnosisConfidence || 0) * 100)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-medium">Decision Confidence</div>
                    <div className="text-slate-800 font-semibold mt-0.5">{formatPercent((data.decision.decisionConfidence || 0) * 100)}</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <div className="text-slate-500 text-xs font-medium mb-1">Diagnostic Analysis</div>
                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                    {data.decision.diagnosis}
                  </p>
                </div>
              </section>
            )}

            {/* Decision */}
            {data.decision && (
              <section className="card p-5 space-y-3.5 border-l-4 border-l-brand-600 bg-white border border-slate-200 shadow-sm">
                <h3 className="section-title">Autonomous Action Selected</h3>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{actionIcon(data.decision.selectedAction)}</span>
                  <div>
                    <div className="font-bold text-base text-slate-900">{data.decision.selectedAction?.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-slate-500">Confidence: {formatPercent((data.decision.decisionConfidence || 0) * 100)}</div>
                  </div>
                </div>

                <div className="bg-brand-50/70 border border-brand-100 rounded-xl p-3.5">
                  <div className="text-xs text-brand-800 font-bold mb-1">WHY THIS ACTION?</div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">{data.decision.decisionReason}</p>
                </div>

                {data.decision.guardrailsApplied?.length > 0 && (
                  <div>
                    <div className="text-xs text-amber-800 font-semibold mb-1.5">Guardrails Triggered</div>
                    <div className="flex flex-wrap gap-1.5">
                      {data.decision.guardrailsApplied.map(g => (
                        <span key={g} className="badge bg-amber-50 text-amber-800 border border-amber-200 text-[11px]">
                          🛡️ {g.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Human Review Required Banner */}
            {data.payment?.humanReviewRequired && (
              <section className="card p-5 border border-amber-200 bg-amber-50/60 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span>🚨</span>
                  <h3 className="text-amber-900 font-bold text-sm">Escalated to Human Review</h3>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{data.payment?.humanReviewReason}</p>
                <div className="mt-3">
                  <span className={`badge ${data.payment?.humanReviewStatus === 'pending' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-700'}`}>
                    Status: {data.payment?.humanReviewStatus}
                  </span>
                </div>
              </section>
            )}

            {/* Agent Timeline */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="section-title">Decision & Execution Audit Trail</h3>
                <span className="text-xs text-slate-400">Chronological</span>
              </div>
              <AgentTimeline events={data.events} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

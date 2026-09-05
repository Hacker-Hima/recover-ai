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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl h-full bg-surface-1 border-l border-white/10 overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface-1 border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="font-mono text-sm text-slate-400">{paymentId}</div>
            <h2 className="text-lg font-semibold text-slate-100">Payment Detail</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-3 text-slate-400 hover:text-slate-200 transition-colors text-xl"
          >
            ×
          </button>
        </div>

        {loading && (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-10 shimmer rounded" />)}
          </div>
        )}

        {error && (
          <div className="m-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {data && !loading && (
          <div className="p-6 space-y-6">
            {/* Payment Overview */}
            <section className="card p-4 space-y-3">
              <h3 className="section-title">Payment Details</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-slate-500 text-xs">Amount</div>
                  <div className="font-bold text-xl text-slate-100">{formatCurrency(data.payment?.amount)}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs">Status</div>
                  <div className="mt-0.5"><span className={statusBadgeClass(data.payment?.status)}>{data.payment?.status?.replace(/_/g, ' ')}</span></div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs">Method</div>
                  <div className="text-slate-200">{data.payment?.paymentMethod?.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs">Attempt #</div>
                  <div className="text-slate-200">{data.payment?.attemptNumber}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs">Failure Reason</div>
                  <div className="text-slate-200">{data.payment?.failureReason?.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs">Category</div>
                  <div className="mt-0.5"><span className={categoryBadgeClass(data.payment?.failureCategory)}>{data.payment?.failureCategory?.replace(/_/g, ' ')}</span></div>
                </div>
                {data.payment?.recoveredAmount > 0 && (
                  <div className="col-span-2">
                    <div className="text-slate-500 text-xs">Recovered Amount</div>
                    <div className="font-bold text-emerald-400 text-lg">{formatCurrency(data.payment?.recoveredAmount)}</div>
                  </div>
                )}
              </div>
            </section>

            {/* Customer */}
            {data.customer && (
              <section className="card p-4 space-y-2">
                <h3 className="section-title">Customer History</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-slate-500 text-xs">Success Rate</div>
                    <div className="text-slate-200">{formatPercent((data.payment?.previousSuccessRate || 0) * 100)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs">Tenure</div>
                    <div className="text-slate-200">{data.payment?.customerTenureDays} days</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs">Subscription</div>
                    <div className="text-slate-200">{data.payment?.subscription ? 'Yes' : 'No'}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs">Risk Tier</div>
                    <div className="text-slate-200 capitalize">{data.customer?.riskTier}</div>
                  </div>
                </div>
              </section>
            )}

            {/* Agent Scores */}
            {data.decision && (
              <section className="card p-4 space-y-3">
                <h3 className="section-title">Agent Analysis</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-slate-500 text-xs">Recovery Probability</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-surface-4 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${(data.decision.recoveryProbability || 0) * 100}%` }} />
                      </div>
                      <span className="font-semibold text-slate-200 w-10 text-right">{formatPercent((data.decision.recoveryProbability || 0) * 100)}</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">{data.decision.recoveryProbabilitySource}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs">Priority Score</div>
                    <div className="text-xl font-bold text-slate-100">{data.decision.priorityScore?.toFixed(1)}<span className="text-sm text-slate-500">/100</span></div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs">Diagnosis Confidence</div>
                    <div className="text-slate-200">{formatPercent((data.decision.diagnosisConfidence || 0) * 100)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs">Decision Confidence</div>
                    <div className="text-slate-200">{formatPercent((data.decision.decisionConfidence || 0) * 100)}</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5">
                  <div className="text-slate-500 text-xs mb-1">Diagnosis</div>
                  <p className="text-sm text-slate-300 leading-relaxed">{data.decision.diagnosis}</p>
                </div>
              </section>
            )}

            {/* Decision */}
            {data.decision && (
              <section className="card p-4 space-y-3 border-l-2 border-brand-500">
                <h3 className="section-title">Decision</h3>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{actionIcon(data.decision.selectedAction)}</span>
                  <div>
                    <div className="font-semibold text-slate-100">{data.decision.selectedAction?.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-slate-500">confidence: {formatPercent((data.decision.decisionConfidence || 0) * 100)}</div>
                  </div>
                </div>

                <div className="bg-surface-3 rounded-lg p-3">
                  <div className="text-xs text-brand-500 font-semibold mb-1">WHY THIS ACTION?</div>
                  <p className="text-sm text-slate-300 leading-relaxed">{data.decision.decisionReason}</p>
                </div>

                {data.decision.guardrailsApplied?.length > 0 && (
                  <div>
                    <div className="text-xs text-orange-400 font-semibold mb-1">Guardrails Triggered</div>
                    <div className="flex flex-wrap gap-1">
                      {data.decision.guardrailsApplied.map(g => (
                        <span key={g} className="badge bg-orange-500/10 text-orange-400 border border-orange-500/20">{g.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Human Review */}
            {data.payment?.humanReviewRequired && (
              <section className="card p-4 border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <span>🚨</span>
                  <h3 className="text-amber-400 font-semibold text-sm">Human Review Required</h3>
                </div>
                <p className="text-sm text-slate-300">{data.payment?.humanReviewReason}</p>
                <div className="mt-2">
                  <span className={`badge ${data.payment?.humanReviewStatus === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-500/10 text-slate-400'}`}>
                    {data.payment?.humanReviewStatus}
                  </span>
                </div>
              </section>
            )}

            {/* Agent Timeline */}
            <section>
              <h3 className="section-title mb-3">Agent Activity Timeline</h3>
              <AgentTimeline events={data.events} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

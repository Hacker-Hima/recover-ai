import { useState, useEffect, useCallback, useRef } from 'react';
import { api, createSSE, formatCurrency, eventIcon } from './api';
import { MetricGrid } from './components/MetricCards';
import { PriorityQueue } from './components/PriorityQueue';
import { PaymentDetailModal } from './components/PaymentDetailModal';
import { FailureCategoryChart, ActionDistributionChart, RecoveryCompareChart } from './components/Charts';
import { HumanReviewPanel } from './components/HumanReviewPanel';
import { CompareView } from './components/CompareView';

const TABS = ['Dashboard', 'Human Review', 'Compare'];

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const color = type === 'error' ? 'bg-red-500/15 border-red-500/20 text-red-400'
    : type === 'success' ? 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400'
    : 'bg-brand-500/15 border-brand-500/20 text-brand-500';

  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg border text-sm font-medium shadow-xl animate-slide-in ${color}`}>
      {message}
    </div>
  );
}

function AgentRunBanner({ runState }) {
  if (!runState?.isRunning) return null;
  const pct = runState.total > 0 ? Math.round(runState.processed / runState.total * 100) : 0;
  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-brand-500/90 backdrop-blur-md px-4 py-2.5 flex items-center gap-4 text-sm text-white">
      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
      <span className="font-semibold">RecoverAI Agent Running</span>
      <span className="text-white/70">{runState.processed}/{runState.total} payments processed</span>
      <div className="flex-1 max-w-xs h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-white/70">{pct}%</span>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('Dashboard');
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [summaryMetrics, setSummaryMetrics] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [humanReview, setHumanReview] = useState([]);
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);
  const [runState, setRunState] = useState(null);
  const [baselineState, setBaselineState] = useState(null);
  const [toast, setToast] = useState(null);
  const [activityFeed, setActivityFeed] = useState([]);
  const [dataStatus, setDataStatus] = useState(null);
  const [loading, setLoading] = useState({});
  const sseRef = useRef(null);

  const showToast = (message, type = 'info') => setToast({ message, type, id: Date.now() });

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const [dash, summ] = await Promise.all([
        api.dashboardMetrics(),
        api.summaryMetrics(),
      ]);
      setMetrics(dash);
      setSummaryMetrics(summ.metrics);
    } catch (err) {
      console.error('Metrics error:', err);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const data = await api.getPriorityQueue(30);
      setQueue(data.queue || []);
    } catch (err) {
      console.error('Queue error:', err);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const fetchHumanReview = useCallback(async () => {
    try {
      const data = await api.getHumanReview();
      setHumanReview(data.payments || []);
    } catch {}
  }, []);

  const fetchCompare = useCallback(async () => {
    setCompareLoading(true);
    try {
      const data = await api.compareMetrics();
      setCompareData(data);
    } catch {}
    finally { setCompareLoading(false); }
  }, []);

  const fetchDataStatus = useCallback(async () => {
    try {
      const data = await api.dataStatus();
      setDataStatus(data);
    } catch {}
  }, []);

  const refreshAll = useCallback(() => {
    fetchMetrics();
    fetchQueue();
    fetchHumanReview();
    fetchDataStatus();
  }, [fetchMetrics, fetchQueue, fetchHumanReview, fetchDataStatus]);

  // SSE connection
  useEffect(() => {
    const sse = createSSE(
      (msg) => {
        if (msg.type === 'run_started') setRunState({ isRunning: true, ...msg });
        if (msg.type === 'run_completed') {
          setRunState({ isRunning: false, ...msg });
          showToast(`Agent completed: ${msg.recovered} recovered`, 'success');
          refreshAll();
        }
        if (msg.type === 'progress') setRunState(prev => ({ ...prev, ...msg }));
        if (msg.type === 'agent_event') {
          setActivityFeed(prev => [msg.event, ...prev].slice(0, 50));
        }
        if (msg.type === 'payment_processed') {
          // Debounced refresh
          clearTimeout(window._refreshTimer);
          window._refreshTimer = setTimeout(refreshAll, 1500);
        }
      },
      null,
      () => {} // silent reconnect
    );
    sseRef.current = sse;
    return () => sse.close();
  }, [refreshAll]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  // Action handlers
  const setLoad = (key, val) => setLoading(l => ({ ...l, [key]: val }));

  async function handleGenerateDemo() {
    setLoad('demo', true);
    try {
      await api.loadDemo();
      showToast('20 demo cases loaded', 'success');
      refreshAll();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoad('demo', false); }
  }

  async function handleGenerateData() {
    setLoad('generate', true);
    try {
      const data = await api.generateData(5000);
      showToast(`${data.stats?.totalPayments} payments generated`, 'success');
      refreshAll();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoad('generate', false); }
  }

  async function handleRunAgent() {
    setLoad('agent', true);
    try {
      await api.runAgent({ isDemo: dataStatus?.unprocessed < 50 });
      showToast('Agent started', 'info');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoad('agent', false); }
  }

  async function handleRunBaseline() {
    setLoad('baseline', true);
    try {
      await api.runBaseline();
      showToast('Baseline agent started', 'info');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoad('baseline', false); }
  }

  async function handleCompare() {
    await fetchCompare();
    setTab('Compare');
  }

  async function handleReset() {
    if (!confirm('Reset all data and reload 20 demo cases?')) return;
    setLoad('reset', true);
    try {
      await api.resetDemo();
      showToast('Demo reset complete', 'success');
      setCompareData(null);
      setActivityFeed([]);
      refreshAll();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoad('reset', false); }
  }

  const isAgentRunning = runState?.isRunning;

  return (
    <div className="min-h-screen">
      <AgentRunBanner runState={runState} />

      {/* Header */}
      <header className="border-b border-white/5 bg-surface-1/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold text-sm">R</div>
            <div>
              <span className="font-bold text-slate-100">RecoverAI</span>
              <span className="text-slate-500 text-xs ml-2">Payment Recovery Agent</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); if (t === 'Compare') fetchCompare(); if (t === 'Human Review') fetchHumanReview(); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-brand-500/15 text-brand-500' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-3'}`}
              >
                {t}
                {t === 'Human Review' && humanReview.length > 0 && (
                  <span className="ml-1.5 w-4 h-4 rounded-full bg-amber-500 text-white text-xs inline-flex items-center justify-center">
                    {humanReview.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Safety Banner */}
          <div className="text-xs text-slate-600 border border-white/5 rounded-md px-2 py-1">
            🔒 PROTOTYPE — No real money
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6">

        {/* Control Bar */}
        <div className="flex flex-wrap items-center gap-2 mb-6 p-4 card">
          <button className="btn-primary" onClick={handleGenerateDemo} disabled={loading.demo}>
            {loading.demo ? '...' : '📋 Generate Demo Data'}
          </button>
          <button className="btn-secondary" onClick={handleGenerateData} disabled={loading.generate}>
            {loading.generate ? '...' : '⚙️ Generate 5K Records'}
          </button>
          <div className="w-px h-6 bg-white/10" />
          <button
            className={`btn-primary ${isAgentRunning ? 'opacity-75' : ''}`}
            onClick={handleRunAgent}
            disabled={loading.agent || isAgentRunning}
          >
            {isAgentRunning ? (
              <>
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Agent Running...
              </>
            ) : '🤖 Run Recovery Agent'}
          </button>
          <button className="btn-secondary" onClick={handleRunBaseline} disabled={loading.baseline}>
            {loading.baseline ? '...' : '📊 Run Baseline'}
          </button>
          <button className="btn-secondary" onClick={handleCompare}>
            📈 Compare Results
          </button>
          <div className="flex-1" />
          <button className="btn-danger" onClick={handleReset} disabled={loading.reset}>
            {loading.reset ? '...' : '↺ Reset Demo'}
          </button>
        </div>

        {/* Tab Content */}
        {tab === 'Dashboard' && (
          <div className="space-y-6">
            {/* Metrics */}
            <MetricGrid metrics={metrics} loading={metricsLoading} />

            {/* Charts + Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="card p-4">
                <FailureCategoryChart metrics={summaryMetrics} />
              </div>
              <div className="card p-4">
                <ActionDistributionChart metrics={summaryMetrics} />
              </div>
              {/* Activity Feed */}
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                  Agent Activity Feed
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {activityFeed.length === 0 ? (
                    <div className="text-slate-500 text-xs py-4 text-center">
                      Start the agent to see live events
                    </div>
                  ) : activityFeed.slice(0, 20).map((ev, i) => (
                    <div key={i} className="flex gap-2 text-xs animate-slide-in">
                      <span>{eventIcon(ev.eventType)}</span>
                      <div>
                        <div className="text-slate-300 leading-snug">{ev.description}</div>
                        <div className="mono text-slate-600">{ev.paymentId}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Priority Queue */}
            <PriorityQueue
              payments={queue}
              onSelect={(p) => setSelectedPaymentId(p.paymentId)}
              loading={queueLoading}
            />
          </div>
        )}

        {tab === 'Human Review' && (
          <HumanReviewPanel
            payments={humanReview}
            onRefresh={() => { fetchHumanReview(); fetchMetrics(); }}
          />
        )}

        {tab === 'Compare' && (
          <div className="space-y-6">
            <div className="card p-4">
              <RecoveryCompareChart data={compareData} />
            </div>
            <CompareView data={compareData} loading={compareLoading} />
          </div>
        )}
      </main>

      {/* Payment Detail Modal */}
      <PaymentDetailModal
        paymentId={selectedPaymentId}
        onClose={() => setSelectedPaymentId(null)}
      />

      {/* Toast */}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

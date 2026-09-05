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

  const color = type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800 shadow-rose-100'
    : type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-emerald-100'
    : 'bg-brand-50 border-brand-200 text-brand-800 shadow-brand-100';

  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl border text-sm font-medium shadow-lg animate-slide-in ${color}`}>
      {message}
    </div>
  );
}

function AgentRunBanner({ runState }) {
  if (!runState?.isRunning) return null;
  const pct = runState.total > 0 ? Math.round(runState.processed / runState.total * 100) : 0;
  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-brand-600/95 backdrop-blur-md px-6 py-2.5 flex items-center gap-4 text-sm text-white shadow-md">
      <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
      <span className="font-semibold tracking-wide">RecoverAI Agent Running</span>
      <span className="text-white/80">{runState.processed} / {runState.total} payments processed</span>
      <div className="flex-1 max-w-xs h-2 bg-black/20 rounded-full overflow-hidden p-0.5">
        <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono font-medium text-white/90">{pct}%</span>
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
  const [confirmReset, setConfirmReset] = useState(false);
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
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    setConfirmReset(false);
    setLoad('reset', true);
    try {
      await api.resetDemo();
      showToast('Demo reset complete — 20 cases reloaded', 'success');
      setRunState(null);
      setBaselineState(null);
      setCompareData(null);
      setActivityFeed([]);
      refreshAll();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoad('reset', false);
    }
  }

  const isAgentRunning = runState?.isRunning;

  return (
    <div className="min-h-screen">
      <AgentRunBanner runState={runState} />

      {/* Header */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              R
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-slate-900 tracking-tight text-lg">RecoverAI</span>
              <span className="text-slate-500 text-xs font-medium">AI Revenue Recovery Agent</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); if (t === 'Compare') fetchCompare(); if (t === 'Human Review') fetchHumanReview(); }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tab === t
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t}
                {t === 'Human Review' && humanReview.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold inline-flex items-center justify-center">
                    {humanReview.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Safety Banner */}
          <div className="text-xs font-medium text-slate-600 border border-slate-200 bg-slate-50 rounded-lg px-3 py-1.5 shadow-sm flex items-center gap-1.5">
            <span>🔒</span>
            <span>PROTOTYPE — Mock Gateway Only</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">

        {/* Control Bar - Cleanly aligned and grouped */}
        <div className="card p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Data Operations */}
            <div className="flex items-center gap-2">
              <button className="btn-secondary text-xs h-9" onClick={handleGenerateDemo} disabled={loading.demo}>
                {loading.demo ? '...' : '📋 Demo Cases (20)'}
              </button>
              <button className="btn-secondary text-xs h-9" onClick={handleGenerateData} disabled={loading.generate}>
                {loading.generate ? '...' : '⚙️ 5K Dataset'}
              </button>
            </div>

            <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1" />

            {/* Agent Actions */}
            <div className="flex items-center gap-2">
              <button
                className={`btn-primary text-xs h-9 ${isAgentRunning ? 'opacity-80' : ''}`}
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
              <button className="btn-secondary text-xs h-9" onClick={handleRunBaseline} disabled={loading.baseline}>
                {loading.baseline ? '...' : '📊 Run Baseline'}
              </button>
            </div>

            <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1" />

            {/* Analytics */}
            <button className="btn-secondary text-xs h-9" onClick={handleCompare}>
              📈 Compare Strategy
            </button>
          </div>

          <div>
            <button
              className={`text-xs h-9 px-3 rounded-lg font-medium transition-all duration-150 flex items-center justify-center gap-1.5 ${
                confirmReset
                  ? 'bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm ring-2 ring-rose-300 animate-pulse'
                  : 'btn-danger'
              }`}
              onClick={handleReset}
              disabled={loading.reset}
            >
              {loading.reset ? '...' : confirmReset ? '⚠️ Confirm Reset?' : '↺ Reset Demo'}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {tab === 'Dashboard' && (
          <div className="space-y-6">
            {/* Metrics Grid */}
            <MetricGrid metrics={metrics} loading={metricsLoading} />

            {/* Charts + Activity - Aligned 3-column row with uniform heights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="card p-5 h-[280px] flex flex-col justify-between">
                <FailureCategoryChart metrics={summaryMetrics} />
              </div>
              <div className="card p-5 h-[280px] flex flex-col justify-between">
                <ActionDistributionChart metrics={summaryMetrics} />
              </div>
              {/* Activity Feed */}
              <div className="card p-5 h-[280px] flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                    Agent Activity Feed
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">Real-time SSE</span>
                </div>
                <div className="space-y-2 flex-1 overflow-y-auto pr-1 mt-3">
                  {activityFeed.length === 0 ? (
                    <div className="text-slate-400 text-xs py-10 text-center">
                      Run the recovery agent to observe live execution events
                    </div>
                  ) : activityFeed.slice(0, 20).map((ev, i) => (
                    <div key={i} className="flex gap-2.5 p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs animate-slide-in">
                      <span className="text-sm">{eventIcon(ev.eventType)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-slate-700 font-medium leading-snug">{ev.description}</div>
                        <div className="mono text-slate-400 text-[11px] mt-0.5">{ev.paymentId}</div>
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
            <div className="card p-5">
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

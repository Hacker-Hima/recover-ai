const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Data
  generateData: (count = 5000) => request('POST', `/api/data/generate?count=${count}`),
  loadDemo: () => request('POST', '/api/data/demo'),
  resetDemo: () => request('DELETE', '/api/data/reset'),
  dataStatus: () => request('GET', '/api/data/status'),

  // Payments
  getPayments: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/api/payments${q ? '?' + q : ''}`);
  },
  getPayment: (id) => request('GET', `/api/payments/${id}`),
  getTimeline: (id) => request('GET', `/api/payments/${id}/timeline`),
  getPriorityQueue: (limit = 20) => request('GET', `/api/payments/queue/priority?limit=${limit}`),

  // Agent
  runAgent: (body = {}) => request('POST', '/api/agent/run', body),
  agentStatus: () => request('GET', '/api/agent/status'),

  // Baseline
  runBaseline: () => request('POST', '/api/baseline/run'),
  baselineStatus: () => request('GET', '/api/baseline/status'),

  // Metrics
  dashboardMetrics: () => request('GET', '/api/metrics/dashboard'),
  summaryMetrics: (source) => request('GET', `/api/metrics/summary${source ? '?source=' + source : ''}`),
  compareMetrics: () => request('GET', '/api/metrics/compare'),

  // Human review
  getHumanReview: () => request('GET', '/api/human-review'),
  approveAction: (id, note) => request('POST', `/api/human-review/${id}/approve`, { note }),
  rejectAction: (id, note) => request('POST', `/api/human-review/${id}/reject`, { note }),
  stopCase: (id, note) => request('POST', `/api/human-review/${id}/stop`, { note }),
};

export function createSSE(onMessage, onOpen, onError) {
  const es = new EventSource(`${API_BASE}/api/agent/events`);
  es.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch {} };
  if (onOpen) es.onopen = onOpen;
  if (onError) es.onerror = onError;
  return es;
}

export function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount || 0);
}

export function formatPercent(val) {
  return `${(val || 0).toFixed(1)}%`;
}

export function statusBadgeClass(status) {
  const map = {
    recovered: 'badge-recovered',
    failed: 'badge-failed',
    escalated: 'badge-escalated',
    stopped: 'badge-stopped',
    processing: 'badge-processing',
    pending_retry: 'badge-pending',
    pending: 'badge-pending',
  };
  return map[status] || 'badge-stopped';
}

export function categoryBadgeClass(cat) {
  const map = {
    TRANSIENT: 'badge-transient',
    SOFT_DECLINE: 'badge-soft_decline',
    HARD_DECLINE: 'badge-hard_decline',
    CUSTOMER_ACTION_REQUIRED: 'badge-customer_action_required',
    UNKNOWN: 'badge-unknown',
  };
  return map[cat] || 'badge-unknown';
}

export function actionIcon(action) {
  const map = {
    RETRY_NOW: '⚡',
    RETRY_LATER: '🕐',
    SEND_PAYMENT_LINK: '🔗',
    SEND_REMINDER: '📧',
    SUGGEST_ALTERNATIVE_METHOD: '🔄',
    ESCALATE_TO_HUMAN: '👤',
    STOP: '🛑',
  };
  return map[action] || '•';
}

export function eventIcon(type) {
  const map = {
    PAYMENT_DETECTED: '📥',
    REVENUE_AT_RISK: '⚠️',
    FAILURE_CLASSIFIED: '🔍',
    RECOVERY_PROBABILITY_CALCULATED: '📊',
    PRIORITY_SCORED: '🎯',
    CUSTOMER_ANALYZED: '👤',
    GUARDRAIL_APPLIED: '🛡️',
    DECISION_MADE: '💡',
    ACTION_SCHEDULED: '📅',
    ACTION_EXECUTED: '⚡',
    OUTCOME_OBSERVED: '👁️',
    PAYMENT_RECOVERED: '✅',
    PAYMENT_FAILED: '❌',
    ESCALATED_TO_HUMAN: '🚨',
    CASE_STOPPED: '🛑',
    HUMAN_ACTION_TAKEN: '👋',
    ERROR: '💥',
  };
  return map[type] || '•';
}

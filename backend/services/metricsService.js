/**
 * Metrics Service
 * Calculates all metrics from actual database data — never fabricated.
 */
const Payment = require('../models/Payment');
const RecoveryAction = require('../models/RecoveryAction');
const AgentDecision = require('../models/AgentDecision');

async function getSummaryMetrics(source = null) {
  const filter = source ? { agentSource: source } : { agentSource: { $ne: 'unprocessed' } };

  const [
    total,
    recovered,
    stopped,
    escalated,
    payments,
    actions,
  ] = await Promise.all([
    Payment.countDocuments(filter),
    Payment.countDocuments({ ...filter, status: 'recovered' }),
    Payment.countDocuments({ ...filter, status: 'stopped' }),
    Payment.countDocuments({ ...filter, status: 'escalated' }),
    Payment.find(filter).lean(),
    RecoveryAction.find(source ? { source } : {}).lean(),
  ]);

  const revenueAtRisk = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const recoveredRevenue = payments
    .filter(p => p.status === 'recovered')
    .reduce((s, p) => s + (p.recoveredAmount || p.amount || 0), 0);

  const estimatedRecoverable = payments.reduce((s, p) => {
    return s + (p.amount || 0) * (p.recoveryProbability || 0);
  }, 0);

  const recoveryRate = total > 0 ? recovered / total : 0;

  // Average retries
  const retriesByPayment = {};
  actions.forEach(a => {
    if (['RETRY_NOW', 'RETRY_LATER'].includes(a.actionType)) {
      retriesByPayment[a.paymentId] = (retriesByPayment[a.paymentId] || 0) + 1;
    }
  });
  const retryValues = Object.values(retriesByPayment);
  const avgRetries = retryValues.length > 0
    ? retryValues.reduce((s, v) => s + v, 0) / retryValues.length
    : 0;

  // Average contacts (non-retry actions)
  const contactsByPayment = {};
  actions.forEach(a => {
    if (['SEND_PAYMENT_LINK', 'SEND_REMINDER', 'SUGGEST_ALTERNATIVE_METHOD'].includes(a.actionType)) {
      contactsByPayment[a.paymentId] = (contactsByPayment[a.paymentId] || 0) + 1;
    }
  });
  const contactValues = Object.values(contactsByPayment);
  const avgContacts = contactValues.length > 0
    ? contactValues.reduce((s, v) => s + v, 0) / contactValues.length
    : 0;

  // Recovery by failure category
  const byCategory = {};
  payments.forEach(p => {
    const cat = p.failureCategory || 'UNKNOWN';
    if (!byCategory[cat]) byCategory[cat] = { total: 0, recovered: 0, revenue: 0, recoveredRevenue: 0 };
    byCategory[cat].total++;
    byCategory[cat].revenue += p.amount || 0;
    if (p.status === 'recovered') {
      byCategory[cat].recovered++;
      byCategory[cat].recoveredRevenue += p.recoveredAmount || p.amount || 0;
    }
  });
  Object.keys(byCategory).forEach(cat => {
    byCategory[cat].rate = byCategory[cat].total > 0
      ? byCategory[cat].recovered / byCategory[cat].total
      : 0;
  });

  // Recovery by payment method
  const byMethod = {};
  payments.forEach(p => {
    const m = p.paymentMethod || 'unknown';
    if (!byMethod[m]) byMethod[m] = { total: 0, recovered: 0 };
    byMethod[m].total++;
    if (p.status === 'recovered') byMethod[m].recovered++;
  });

  // Action distribution
  const actionDist = {};
  actions.forEach(a => {
    actionDist[a.actionType] = (actionDist[a.actionType] || 0) + 1;
  });

  return {
    total,
    recovered,
    stopped,
    escalated,
    revenueAtRisk: Math.round(revenueAtRisk),
    recoveredRevenue: Math.round(recoveredRevenue),
    estimatedRecoverable: Math.round(estimatedRecoverable),
    recoveryRate: Math.round(recoveryRate * 10000) / 100,
    humanEscalationRate: total > 0 ? Math.round(escalated / total * 10000) / 100 : 0,
    stopRate: total > 0 ? Math.round(stopped / total * 10000) / 100 : 0,
    avgRetries: Math.round(avgRetries * 100) / 100,
    avgContacts: Math.round(avgContacts * 100) / 100,
    byCategory,
    byMethod,
    actionDist,
  };
}

async function getComparisonMetrics() {
  const [recoverai, baseline, unprocessed] = await Promise.all([
    getSummaryMetrics('recoverai'),
    getSummaryMetrics('baseline'),
    Payment.countDocuments({ agentSource: 'unprocessed' }),
  ]);

  return {
    recoverai,
    baseline,
    unprocessed,
    comparison: {
      recoveryRateDiff: recoverai.recoveryRate - baseline.recoveryRate,
      recoveredRevenueDiff: recoverai.recoveredRevenue - baseline.recoveredRevenue,
      avgRetriesDiff: recoverai.avgRetries - baseline.avgRetries,
      escalationRateDiff: recoverai.humanEscalationRate - baseline.humanEscalationRate,
    },
  };
}

async function getDashboardSummary() {
  const [
    totalFailed,
    totalRecovered,
    totalEscalated,
    totalStopped,
    revenueAtRisk,
    recoveredRevenue,
    humanReviewPending,
  ] = await Promise.all([
    Payment.countDocuments({ status: { $in: ['failed', 'pending_retry', 'processing', 'stopped'] } }),
    Payment.countDocuments({ status: 'recovered' }),
    Payment.countDocuments({ status: 'escalated' }),
    Payment.countDocuments({ status: 'stopped' }),
    Payment.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
    Payment.aggregate([{ $match: { status: 'recovered' } }, { $group: { _id: null, total: { $sum: '$recoveredAmount' } } }]),
    Payment.countDocuments({ humanReviewRequired: true, humanReviewStatus: 'pending' }),
  ]);

  const allPayments = await Payment.find({ agentSource: { $ne: 'unprocessed' } }).lean();
  const estimatedRecoverable = allPayments.reduce((s, p) => s + (p.amount || 0) * (p.recoveryProbability || 0), 0);

  const totalProcessed = totalRecovered + totalEscalated + totalStopped;
  const recoveryRate = totalProcessed > 0 ? (totalRecovered / totalProcessed) * 100 : 0;

  return {
    totalFailed,
    totalRecovered,
    totalEscalated,
    totalStopped,
    revenueAtRisk: revenueAtRisk[0]?.total || 0,
    recoveredRevenue: recoveredRevenue[0]?.total || 0,
    estimatedRecoverable: Math.round(estimatedRecoverable),
    recoveryRate: Math.round(recoveryRate * 10) / 10,
    humanReviewPending,
    activeRecoveryCases: await Payment.countDocuments({ status: { $in: ['pending_retry', 'processing'] } }),
  };
}

module.exports = { getSummaryMetrics, getComparisonMetrics, getDashboardSummary };

/**
 * Baseline Agent — Simple Retry Strategy
 *
 * Every failed payment → retry after fixed delay → max 3 attempts.
 * Used for comparison against RecoverAI.
 */

const Payment = require('../models/Payment');
const RecoveryAction = require('../models/RecoveryAction');
const AgentEvent = require('../models/AgentEvent');
const { executeAction } = require('./actionExecutor');

let baselineRunState = {
  isRunning: false,
  total: 0,
  processed: 0,
  recovered: 0,
  failed: 0,
  totalRetries: 0,
};

async function runBaseline(options = {}) {
  if (baselineRunState.isRunning) throw new Error('Baseline already running');

  const payments = await Payment.find({ agentSource: 'unprocessed' })
    .sort({ amount: -1 })
    .limit(options.batchSize || 100)
    .lean();

  if (payments.length === 0) return { message: 'No unprocessed payments', processed: 0 };

  baselineRunState = {
    isRunning: true,
    total: payments.length,
    processed: 0,
    recovered: 0,
    failed: 0,
    totalRetries: 0,
  };

  const MAX_ATTEMPTS = 3;

  try {
    for (const payment of payments) {
      await Payment.updateOne({ paymentId: payment.paymentId }, { agentSource: 'baseline', status: 'processing' });

      let recovered = false;
      let recoveredAmount = 0;
      let seq = 0;

      // Log detection
      await AgentEvent.create({
        paymentId: payment.paymentId,
        eventType: 'PAYMENT_DETECTED',
        description: `[BASELINE] Payment detected: ₹${payment.amount}`,
        data: { strategy: 'baseline_fixed_retry' },
        source: 'baseline',
        sequenceNumber: ++seq,
      });

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        baselineRunState.totalRetries++;

        await AgentEvent.create({
          paymentId: payment.paymentId,
          eventType: 'ACTION_EXECUTED',
          description: `[BASELINE] Retry attempt ${attempt}/${MAX_ATTEMPTS}`,
          data: { attempt, maxAttempts: MAX_ATTEMPTS },
          source: 'baseline',
          sequenceNumber: ++seq,
        });

        const action = await executeAction(
          { ...payment, failureCategory: payment.failureCategory || 'UNKNOWN' },
          { selectedAction: 'RETRY_LATER', decisionReason: 'Baseline fixed retry strategy', decisionConfidence: 0.5 },
          'baseline'
        );

        if (action.result === 'success') {
          recovered = true;
          recoveredAmount = action.recoveredAmount;
          break;
        }

        // Fixed delay simulation (2h between retries — simulated)
        await new Promise(r => setTimeout(r, 20));
      }

      const finalStatus = recovered ? 'recovered' : 'stopped';

      await Payment.updateOne({ paymentId: payment.paymentId }, {
        status: finalStatus,
        recoveredAmount,
        agentSource: 'baseline',
      });

      await AgentEvent.create({
        paymentId: payment.paymentId,
        eventType: recovered ? 'PAYMENT_RECOVERED' : 'CASE_STOPPED',
        description: recovered ? `[BASELINE] ₹${recoveredAmount} recovered` : `[BASELINE] All ${MAX_ATTEMPTS} retries exhausted`,
        data: { recovered, recoveredAmount, strategy: 'baseline' },
        source: 'baseline',
        sequenceNumber: ++seq,
      });

      if (recovered) baselineRunState.recovered++;
      else baselineRunState.failed++;
      baselineRunState.processed++;

      await new Promise(r => setTimeout(r, 20));
    }
  } finally {
    baselineRunState.isRunning = false;
  }

  return { ...baselineRunState };
}

function getBaselineState() { return { ...baselineRunState }; }

module.exports = { runBaseline, getBaselineState };

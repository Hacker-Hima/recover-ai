/**
 * RecoverAI Agent — Core Loop
 *
 * The agent OBSERVES → REASONS → DECIDES → ACTS → OBSERVES RESULT
 * Every step is recorded in the AgentEvent timeline.
 * All actions are bounded. The agent stops autonomously when rules require it.
 */

const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const AgentDecision = require('../models/AgentDecision');
const AgentEvent = require('../models/AgentEvent');

const { diagnosePayment } = require('./diagnosis');
const { getRecoveryProbability, calculatePriorityScore } = require('./recoveryScoring');
const { makeDecision } = require('./decisionEngine');
const { executeAction } = require('./actionExecutor');

// Agent run state (in-memory, not persisted — use for current run tracking)
let agentRunState = {
  isRunning: false,
  runId: null,
  total: 0,
  processed: 0,
  recovered: 0,
  stopped: 0,
  escalated: 0,
  errors: 0,
  startedAt: null,
  completedAt: null,
  lastEvent: null,
};

// SSE subscribers
const sseClients = new Set();

function broadcastEvent(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try { client.write(msg); } catch { sseClients.delete(client); }
  });
}

/**
 * Record an agent timeline event.
 */
async function recordEvent(paymentId, eventType, description, data = {}, source = 'recoverai', seq) {
  const event = await AgentEvent.create({
    paymentId,
    eventType,
    description,
    data,
    source,
    sequenceNumber: seq,
  });

  agentRunState.lastEvent = { paymentId, eventType, description, data };
  broadcastEvent({ type: 'agent_event', event });
  return event;
}

/**
 * Process a single payment through the full agent loop.
 * Returns the final payment state.
 */
async function processPayment(payment, llmService = null, source = 'recoverai') {
  let seq = 0;
  const pid = payment.paymentId;

  // Mark as processing
  await Payment.updateOne({ paymentId: pid }, { status: 'processing', agentSource: source });

  try {
    // ── Step 1: Validate & Detect ───────────────────────────────────────────
    await recordEvent(pid, 'PAYMENT_DETECTED',
      `Payment failure detected: ₹${payment.amount?.toLocaleString('en-IN')} via ${payment.paymentMethod}`,
      { amount: payment.amount, paymentMethod: payment.paymentMethod, failureReason: payment.failureReason },
      source, ++seq
    );

    // ── Step 2: Revenue at Risk ─────────────────────────────────────────────
    const revenueAtRisk = payment.amount;
    await recordEvent(pid, 'REVENUE_AT_RISK',
      `Revenue at risk identified: ₹${revenueAtRisk?.toLocaleString('en-IN')}`,
      { revenueAtRisk },
      source, ++seq
    );

    // ── Step 3: Diagnose ────────────────────────────────────────────────────
    const diagnosis = await diagnosePayment(payment, llmService);
    await recordEvent(pid, 'FAILURE_CLASSIFIED',
      `Failure classified: ${diagnosis.category} — ${diagnosis.label} (confidence: ${(diagnosis.confidence * 100).toFixed(0)}%)`,
      { category: diagnosis.category, label: diagnosis.label, confidence: diagnosis.confidence, source: diagnosis.source },
      source, ++seq
    );

    // ── Step 4: Recovery Probability ────────────────────────────────────────
    const scoringResult = await getRecoveryProbability(payment);
    const recoveryProbability = scoringResult.probability;

    await recordEvent(pid, 'RECOVERY_PROBABILITY_CALCULATED',
      `Recovery probability: ${(recoveryProbability * 100).toFixed(0)}% (source: ${scoringResult.source})`,
      { recoveryProbability, source: scoringResult.source },
      source, ++seq
    );

    // ── Step 5: Priority Score ──────────────────────────────────────────────
    const { score: priorityScore, breakdown } = calculatePriorityScore(payment, recoveryProbability);

    await recordEvent(pid, 'PRIORITY_SCORED',
      `Priority score calculated: ${priorityScore}/100`,
      { priorityScore, breakdown },
      source, ++seq
    );

    // Update payment with scored data
    await Payment.updateOne({ paymentId: pid }, {
      recoveryProbability,
      priorityScore,
      revenueAtRisk,
    });

    // ── Step 6: Analyze Customer ────────────────────────────────────────────
    const customer = await Customer.findOne({ customerId: payment.customerId }).lean();
    if (customer) {
      await recordEvent(pid, 'CUSTOMER_ANALYZED',
        `Customer analyzed: ${customer.successfulPayments} successful payments, ${(payment.previousSuccessRate * 100).toFixed(0)}% success rate`,
        {
          successRate: payment.previousSuccessRate,
          tenureDays: payment.customerTenureDays,
          subscriptionStatus: customer.subscriptionStatus,
          contactCount: customer.contactCount || 0,
        },
        source, ++seq
      );
    }

    // ── Step 7 & 8: Check Guardrails & Decide ──────────────────────────────
    const decision = await makeDecision(payment, {
      category: diagnosis.category,
      confidence: diagnosis.confidence,
      label: diagnosis.label,
    }, recoveryProbability, customer, llmService);

    // Log guardrails if triggered
    if (decision.guardrailsApplied.length > 0) {
      await recordEvent(pid, 'GUARDRAIL_APPLIED',
        `Guardrails triggered: ${decision.guardrailsApplied.join(', ')}`,
        { guardrails: decision.guardrailsApplied },
        source, ++seq
      );
    }

    await recordEvent(pid, 'DECISION_MADE',
      `Decision: ${decision.selectedAction} (confidence: ${(decision.decisionConfidence * 100).toFixed(0)}%)`,
      {
        selectedAction: decision.selectedAction,
        reason: decision.decisionReason,
        confidence: decision.decisionConfidence,
        humanReviewRequired: decision.humanReviewRequired,
      },
      source, ++seq
    );

    // Persist agent decision
    const agentDecision = await AgentDecision.create({
      paymentId: pid,
      diagnosis: diagnosis.diagnosis,
      diagnosisConfidence: diagnosis.confidence,
      diagnosisSource: diagnosis.source,
      diagnosisExplanation: diagnosis.explanation,
      recoveryProbability,
      recoveryProbabilitySource: scoringResult.source,
      priorityScore,
      priorityBreakdown: breakdown,
      selectedAction: decision.selectedAction,
      decisionReason: decision.decisionReason,
      decisionConfidence: decision.decisionConfidence,
      guardrailsApplied: decision.guardrailsApplied,
      status: 'executing',
    });

    // ── Step 9 & 10: Execute & Observe ─────────────────────────────────────
    if (decision.selectedAction === 'RETRY_LATER') {
      await recordEvent(pid, 'ACTION_SCHEDULED',
        `Action scheduled: ${decision.selectedAction} — retry in 2 hours`,
        { scheduledIn: '2 hours' },
        source, ++seq
      );
    }

    const actionRecord = await executeAction(
      { ...payment, failureCategory: diagnosis.category },
      decision,
      source
    );

    await recordEvent(pid, 'ACTION_EXECUTED',
      `Action executed: ${decision.selectedAction} → ${actionRecord.result}`,
      { actionType: decision.selectedAction, result: actionRecord.result, recoveredAmount: actionRecord.recoveredAmount },
      source, ++seq
    );

    // ── Step 11-15: Observe & Update State ─────────────────────────────────
    let finalStatus, finalRecoveredAmount, humanReviewRequired;

    if (decision.selectedAction === 'ESCALATE_TO_HUMAN') {
      finalStatus = 'escalated';
      finalRecoveredAmount = 0;
      humanReviewRequired = true;

      await recordEvent(pid, 'ESCALATED_TO_HUMAN',
        `Case escalated to human review: ${decision.decisionReason}`,
        { reason: decision.decisionReason },
        source, ++seq
      );
    } else if (decision.selectedAction === 'STOP') {
      finalStatus = 'stopped';
      finalRecoveredAmount = 0;
      humanReviewRequired = false;

      await recordEvent(pid, 'CASE_STOPPED',
        `Recovery stopped: ${decision.decisionReason}`,
        { reason: decision.decisionReason, guardrails: decision.guardrailsApplied },
        source, ++seq
      );
    } else if (actionRecord.result === 'success') {
      finalStatus = 'recovered';
      finalRecoveredAmount = actionRecord.recoveredAmount;
      humanReviewRequired = false;

      await recordEvent(pid, 'PAYMENT_RECOVERED',
        `Payment recovered! ₹${finalRecoveredAmount?.toLocaleString('en-IN')} recovered via ${decision.selectedAction}`,
        { recoveredAmount: finalRecoveredAmount, action: decision.selectedAction },
        source, ++seq
      );
    } else if (actionRecord.result === 'pending') {
      // Async action sent — simulate outcome after delay for demo
      const willRecover = actionRecord.gatewayResponse?.customerWillPay ||
        actionRecord.gatewayResponse?.customerWillAct ||
        actionRecord.gatewayResponse?.customerWillSwitch;

      finalStatus = willRecover ? 'recovered' : 'stopped';
      finalRecoveredAmount = willRecover ? payment.amount : 0;

      if (willRecover) {
        await recordEvent(pid, 'OUTCOME_OBSERVED',
          `Customer responded to ${decision.selectedAction} — payment completed`,
          { outcome: 'customer_acted', recoveredAmount: finalRecoveredAmount },
          source, ++seq
        );
        await recordEvent(pid, 'PAYMENT_RECOVERED',
          `₹${finalRecoveredAmount?.toLocaleString('en-IN')} recovered`,
          { recoveredAmount: finalRecoveredAmount },
          source, ++seq
        );
      } else {
        await recordEvent(pid, 'OUTCOME_OBSERVED',
          `Customer did not respond to ${decision.selectedAction}`,
          { outcome: 'no_customer_action' },
          source, ++seq
        );
        await recordEvent(pid, 'CASE_STOPPED',
          `Recovery case closed — no customer response`,
          {},
          source, ++seq
        );
      }
    } else {
      finalStatus = 'stopped';
      finalRecoveredAmount = 0;
      await recordEvent(pid, 'PAYMENT_FAILED',
        `Recovery action failed: ${actionRecord.failureReason || 'Gateway declined'}`,
        { result: actionRecord.result },
        source, ++seq
      );
      await recordEvent(pid, 'CASE_STOPPED',
        `Recovery case closed after action failure`,
        {},
        source, ++seq
      );
    }

    // Persist final payment state
    await Payment.updateOne({ paymentId: pid }, {
      status: finalStatus,
      recoveredAmount: finalRecoveredAmount,
      humanReviewRequired: !!decision.humanReviewRequired,
      humanReviewReason: decision.humanReviewReason,
      humanReviewStatus: decision.humanReviewRequired ? 'pending' : 'na',
      agentSource: source,
    });

    await AgentDecision.updateOne({ _id: agentDecision._id }, { status: 'completed' });

    // Update run state
    if (finalStatus === 'recovered') agentRunState.recovered++;
    else if (finalStatus === 'stopped') agentRunState.stopped++;
    else if (finalStatus === 'escalated') agentRunState.escalated++;

    broadcastEvent({
      type: 'payment_processed',
      paymentId: pid,
      status: finalStatus,
      recoveredAmount: finalRecoveredAmount,
      progress: {
        processed: agentRunState.processed,
        total: agentRunState.total,
      },
    });

    return { paymentId: pid, status: finalStatus, recoveredAmount: finalRecoveredAmount };

  } catch (err) {
    console.error(`Error processing payment ${pid}:`, err);
    agentRunState.errors++;

    await recordEvent(pid, 'ERROR',
      `Agent error: ${err.message}`,
      { error: err.message },
      source, ++seq
    ).catch(() => {}); // Don't throw on event recording failure

    await Payment.updateOne({ paymentId: pid }, { status: 'failed', agentSource: source });

    broadcastEvent({ type: 'payment_error', paymentId: pid, error: err.message });

    return { paymentId: pid, status: 'error', error: err.message };
  } finally {
    agentRunState.processed++;
    broadcastEvent({
      type: 'progress',
      processed: agentRunState.processed,
      total: agentRunState.total,
      percent: Math.round((agentRunState.processed / agentRunState.total) * 100),
    });
  }
}

/**
 * Process all eligible unprocessed payments.
 * Runs sequentially with brief delay to allow SSE updates.
 */
async function processAllPayments(options = {}) {
  const { source = 'recoverai', isDemo = false, batchSize = 100 } = options;

  if (agentRunState.isRunning) {
    throw new Error('Agent is already running');
  }

  // Get eligible payments
  const filter = { agentSource: 'unprocessed' };
  if (isDemo) filter.isDemo = true;

  const payments = await Payment.find(filter)
    .sort({ amount: -1 }) // Process high-value first
    .limit(batchSize)
    .lean();

  if (payments.length === 0) {
    return { message: 'No unprocessed payments found', processed: 0 };
  }

  // Load LLM service lazily (may be unavailable)
  let llmService = null;
  try {
    llmService = require('./llmService');
    await llmService.checkAvailability();
    if (!llmService.isAvailable()) llmService = null;
  } catch {
    llmService = null;
  }

  agentRunState = {
    isRunning: true,
    runId: `RUN-${Date.now()}`,
    total: payments.length,
    processed: 0,
    recovered: 0,
    stopped: 0,
    escalated: 0,
    errors: 0,
    startedAt: new Date(),
    completedAt: null,
    lastEvent: null,
  };

  broadcastEvent({ type: 'run_started', runId: agentRunState.runId, total: payments.length });

  try {
    for (const payment of payments) {
      await processPayment(payment, llmService, source);
      // Brief pause between payments for smooth SSE streaming
      await new Promise(r => setTimeout(r, 50));
    }
  } finally {
    agentRunState.isRunning = false;
    agentRunState.completedAt = new Date();
    broadcastEvent({ type: 'run_completed', ...agentRunState });
  }

  return {
    runId: agentRunState.runId,
    total: agentRunState.total,
    processed: agentRunState.processed,
    recovered: agentRunState.recovered,
    stopped: agentRunState.stopped,
    escalated: agentRunState.escalated,
    errors: agentRunState.errors,
  };
}

function getRunState() { return { ...agentRunState }; }
function getSseClients() { return sseClients; }

module.exports = { processPayment, processAllPayments, getRunState, getSseClients };

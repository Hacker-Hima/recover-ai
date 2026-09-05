/**
 * Mock Payment Gateway
 * Simulates payment gateway responses for demo purposes.
 *
 * SAFETY: This is a simulation only. No real money is processed.
 * Outcomes are configurable via probability parameters.
 * When a demo seed is supplied, results are fully deterministic.
 */

const express = require('express');
const router = express.Router();
const seedrandom = require('seedrandom');

const DEMO_SEED = process.env.DEMO_SEED || '42';

// Per-category success probabilities (configurable)
const SUCCESS_PROBS = {
  TRANSIENT: {
    RETRY_NOW: 0.75,
    RETRY_LATER: 0.85,
  },
  SOFT_DECLINE: {
    RETRY_NOW: 0.30,
    RETRY_LATER: 0.55,
  },
  HARD_DECLINE: {
    RETRY_NOW: 0.05,
    SEND_PAYMENT_LINK: 0.45,
    SUGGEST_ALTERNATIVE_METHOD: 0.40,
  },
  CUSTOMER_ACTION_REQUIRED: {
    SEND_REMINDER: 0.35,
    SEND_PAYMENT_LINK: 0.40,
  },
  UNKNOWN: {
    RETRY_LATER: 0.25,
  },
};

// Seeded RNG per payment so outcomes are deterministic for demo
function getPaymentRng(paymentId, action) {
  return seedrandom(`${DEMO_SEED}-${paymentId}-${action}`);
}

function simulateOutcome(paymentId, action, failureCategory) {
  const rng = getPaymentRng(paymentId, action);
  const categoryProbs = SUCCESS_PROBS[failureCategory] || {};
  const prob = categoryProbs[action] ?? 0.30; // default 30% if unmapped
  const success = rng() < prob;
  return success;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── POST /mock-gateway/payments/:paymentId/retry ─────────────────────────────
router.post('/payments/:paymentId/retry', async (req, res) => {
  const { paymentId } = req.params;
  const { failureCategory, amount, retryType = 'RETRY_LATER' } = req.body;

  // Simulate processing delay (100-300ms)
  await delay(100 + Math.floor(Math.random() * 200));

  const success = simulateOutcome(paymentId, retryType, failureCategory);

  if (success) {
    return res.json({
      success: true,
      gatewayStatus: 'PAYMENT_SUCCESS',
      transactionId: `TXN-${paymentId}-${Date.now()}`,
      recoveredAmount: amount,
      message: `Payment retry successful for ${paymentId}`,
      timestamp: new Date().toISOString(),
    });
  } else {
    return res.json({
      success: false,
      gatewayStatus: 'PAYMENT_FAILED',
      transactionId: null,
      recoveredAmount: 0,
      message: `Payment retry failed for ${paymentId}`,
      failureCode: failureCategory === 'SOFT_DECLINE' ? 'STILL_INSUFFICIENT' : 'RETRY_DECLINED',
      timestamp: new Date().toISOString(),
    });
  }
});

// ── POST /mock-gateway/payments/:paymentId/payment-link ──────────────────────
router.post('/payments/:paymentId/payment-link', async (req, res) => {
  const { paymentId } = req.params;
  const { failureCategory, amount, customerId } = req.body;

  await delay(50);

  const success = simulateOutcome(paymentId, 'SEND_PAYMENT_LINK', failureCategory);

  return res.json({
    success: true, // Link is always "sent" successfully
    gatewayStatus: 'PAYMENT_LINK_SENT',
    paymentLink: `https://pay.recoverai.demo/link/${paymentId}`,
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    // Simulate eventual customer action
    customerWillPay: success,
    estimatedOutcome: success ? 'PAYMENT_EXPECTED' : 'LINK_IGNORED',
    recoveredAmount: success ? amount : 0,
    message: `Payment link sent to customer ${customerId}`,
    timestamp: new Date().toISOString(),
  });
});

// ── POST /mock-gateway/payments/:paymentId/notify ────────────────────────────
router.post('/payments/:paymentId/notify', async (req, res) => {
  const { paymentId } = req.params;
  const { failureCategory, amount, customerId, channel = 'email' } = req.body;

  await delay(50);

  const success = simulateOutcome(paymentId, 'SEND_REMINDER', failureCategory);

  return res.json({
    success: true,
    gatewayStatus: 'NOTIFICATION_SENT',
    channel,
    recipient: customerId,
    messageId: `MSG-${paymentId}-${Date.now()}`,
    customerWillAct: success,
    estimatedOutcome: success ? 'CUSTOMER_ACTION_EXPECTED' : 'NO_RESPONSE_EXPECTED',
    recoveredAmount: success ? amount : 0,
    message: `${channel} reminder sent for payment ${paymentId}`,
    timestamp: new Date().toISOString(),
  });
});

// ── POST /mock-gateway/payments/:paymentId/escalate ──────────────────────────
router.post('/payments/:paymentId/escalate', async (req, res) => {
  const { paymentId } = req.params;
  const { reason, decisionConfidence, customerId } = req.body;

  await delay(30);

  return res.json({
    success: true,
    gatewayStatus: 'ESCALATED_TO_HUMAN',
    ticketId: `TICKET-${paymentId}-${Date.now()}`,
    assignedTeam: 'revenue-recovery',
    priority: decisionConfidence < 0.4 ? 'high' : 'medium',
    reason,
    estimatedResponseHours: 4,
    message: `Payment ${paymentId} escalated for human review`,
    timestamp: new Date().toISOString(),
  });
});

// ── POST /mock-gateway/payments/:paymentId/stop ──────────────────────────────
router.post('/payments/:paymentId/stop', async (req, res) => {
  const { paymentId } = req.params;
  const { reason } = req.body;

  await delay(30);

  return res.json({
    success: true,
    gatewayStatus: 'CASE_CLOSED',
    reason,
    message: `Recovery case stopped for payment ${paymentId}`,
    timestamp: new Date().toISOString(),
  });
});

// ── POST /mock-gateway/payments/:paymentId/suggest-alternative ───────────────
router.post('/payments/:paymentId/suggest-alternative', async (req, res) => {
  const { paymentId } = req.params;
  const { failureCategory, amount, customerId } = req.body;

  await delay(50);

  const success = simulateOutcome(paymentId, 'SUGGEST_ALTERNATIVE_METHOD', failureCategory);
  const alternatives = ['UPI', 'Net Banking', 'Wallet'];

  return res.json({
    success: true,
    gatewayStatus: 'ALTERNATIVE_SUGGESTED',
    suggestedMethods: alternatives,
    communicationSent: true,
    customerWillSwitch: success,
    estimatedOutcome: success ? 'METHOD_SWITCH_EXPECTED' : 'NO_ACTION_EXPECTED',
    recoveredAmount: success ? amount : 0,
    message: `Alternative payment methods suggested for ${paymentId}`,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

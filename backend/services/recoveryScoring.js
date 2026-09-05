/**
 * RecoverAI Recovery Scoring Service
 *
 * Calculates:
 *  1. Recovery probability (ML model preferred, heuristic fallback)
 *  2. Priority score (explainable formula)
 *
 * All scores are calculated from actual data — never fabricated.
 */

const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

// ─── Configuration ───────────────────────────────────────────────────────────
const HIGH_VALUE_THRESHOLD = parseInt(process.env.HIGH_VALUE_THRESHOLD) || 10000;

// Heuristic base recovery probabilities (used when ML unavailable)
const HEURISTIC_BASE_PROBS = {
  TRANSIENT: 0.80,
  SOFT_DECLINE: 0.52,
  HARD_DECLINE: 0.18,
  CUSTOMER_ACTION_REQUIRED: 0.28,
  UNKNOWN: 0.32,
};

let mlAvailable = null; // null = untested, true/false = last known state

/**
 * Test ML service availability (cached).
 */
async function checkMlAvailable() {
  try {
    const resp = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 2000 });
    mlAvailable = resp.data.status === 'ok';
  } catch {
    mlAvailable = false;
  }
  return mlAvailable;
}

/**
 * Heuristic recovery probability (fully explainable, no ML).
 */
function heuristicRecoveryProbability(payment) {
  const { failureCategory, attemptNumber, previousSuccessRate, previousFailures, subscription } = payment;

  let prob = HEURISTIC_BASE_PROBS[failureCategory] || 0.30;

  // Customer history adjustment
  if (previousSuccessRate !== undefined) {
    const historyFactor = 0.6 + 0.4 * previousSuccessRate; // 0.6–1.0
    prob *= historyFactor;
  }

  // Diminishing returns on retry
  if (attemptNumber === 2) prob *= 0.75;
  if (attemptNumber >= 3) prob *= 0.45;

  // Subscription customers are more likely to resolve
  if (subscription) prob = Math.min(prob * 1.15, 0.95);

  // Many previous failures lowers confidence
  if (previousFailures > 10) prob *= 0.85;
  if (previousFailures > 20) prob *= 0.70;

  return Math.min(Math.max(prob, 0.02), 0.98);
}

/**
 * Get recovery probability from ML service.
 * Falls back to heuristic if ML unavailable.
 */
async function getRecoveryProbability(payment) {
  // Try ML model
  if (mlAvailable !== false) {
    try {
      const features = {
        amount: payment.amount,
        payment_method: payment.paymentMethod,
        failure_category: payment.failureCategory,
        attempt_number: payment.attemptNumber,
        previous_success_rate: payment.previousSuccessRate || 0,
        previous_failures: payment.previousFailures || 0,
        customer_tenure_days: payment.customerTenureDays || 0,
        subscription: payment.subscription ? 1 : 0,
      };

      const resp = await axios.post(`${ML_SERVICE_URL}/predict`, features, { timeout: 3000 });
      mlAvailable = true;

      return {
        probability: resp.data.recovery_probability,
        source: 'ml_model',
        modelVersion: resp.data.model_version || '1.0',
        features,
      };
    } catch (err) {
      console.warn(`ML service unavailable: ${err.message}. Using heuristic fallback.`);
      mlAvailable = false;
    }
  }

  // Heuristic fallback
  const prob = heuristicRecoveryProbability(payment);
  return {
    probability: Math.round(prob * 100) / 100,
    source: 'heuristic',
    note: 'ML service unavailable — heuristic scoring applied',
  };
}

/**
 * Calculate priority score.
 *
 * Formula:
 *   priority = normalizedAmount × recoveryProbability × customerValueFactor × urgencyFactor
 *
 * All factors are in [0, 1] so the final score is in [0, 1].
 */
function calculatePriorityScore(payment, recoveryProbability, customer = null) {
  // 1. Normalized amount (log scale, capped at HIGH_VALUE_THRESHOLD)
  const logAmount = Math.log1p(payment.amount);
  const logThreshold = Math.log1p(HIGH_VALUE_THRESHOLD);
  const normalizedAmount = Math.min(logAmount / logThreshold, 1.0);

  // 2. Recovery probability (direct)
  const recovProb = Math.max(0, Math.min(recoveryProbability, 1));

  // 3. Customer value factor (based on success rate and tenure)
  const successRate = payment.previousSuccessRate || 0;
  const tenureScore = Math.min(payment.customerTenureDays / 1000, 1.0);
  const customerValueFactor = 0.5 + 0.3 * successRate + 0.2 * tenureScore;

  // 4. Urgency factor (subscription payments are more urgent; older failures decay)
  const subscriptionBonus = payment.subscription ? 1.15 : 1.0;
  const ageHours = (Date.now() - new Date(payment.createdAt).getTime()) / (1000 * 3600);
  const agePenalty = Math.max(0.5, 1.0 - ageHours / (72)); // Decay over 72h
  const urgencyFactor = Math.min(subscriptionBonus * agePenalty, 1.0);

  const rawScore = normalizedAmount * recovProb * customerValueFactor * urgencyFactor;

  // Normalize to 0–100
  const score = Math.round(rawScore * 100 * 10) / 10;

  return {
    score,
    breakdown: {
      normalizedAmount: Math.round(normalizedAmount * 100) / 100,
      recoveryProbability: recovProb,
      customerValueFactor: Math.round(customerValueFactor * 100) / 100,
      urgencyFactor: Math.round(urgencyFactor * 100) / 100,
    },
  };
}

// Periodically check ML health
setInterval(checkMlAvailable, 30000);
checkMlAvailable(); // initial check

module.exports = { getRecoveryProbability, calculatePriorityScore, heuristicRecoveryProbability };

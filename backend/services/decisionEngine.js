/**
 * RecoverAI Decision Engine
 *
 * Selects exactly ONE action from the allowed action set.
 * Uses deterministic policy guardrails — LLM cannot execute arbitrary commands.
 * All thresholds are configurable via environment variables.
 *
 * Action set:
 *   RETRY_NOW | RETRY_LATER | SEND_PAYMENT_LINK | SEND_REMINDER |
 *   SUGGEST_ALTERNATIVE_METHOD | ESCALATE_TO_HUMAN | STOP
 */

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;
const MAX_CUSTOMER_CONTACTS = parseInt(process.env.MAX_CUSTOMER_CONTACTS) || 2;
const MIN_RECOVERY_PROBABILITY = parseFloat(process.env.MIN_RECOVERY_PROBABILITY) || 0.15;
const MIN_CONFIDENCE = parseFloat(process.env.MIN_CONFIDENCE) || 0.60;
const HIGH_VALUE_THRESHOLD = parseInt(process.env.HIGH_VALUE_THRESHOLD) || 10000;

const ACTIONS = {
  RETRY_NOW: 'RETRY_NOW',
  RETRY_LATER: 'RETRY_LATER',
  SEND_PAYMENT_LINK: 'SEND_PAYMENT_LINK',
  SEND_REMINDER: 'SEND_REMINDER',
  SUGGEST_ALTERNATIVE_METHOD: 'SUGGEST_ALTERNATIVE_METHOD',
  ESCALATE_TO_HUMAN: 'ESCALATE_TO_HUMAN',
  STOP: 'STOP',
};

/**
 * Evaluate guardrails.
 * Returns array of triggered guardrails with reasons.
 */
function evaluateGuardrails(payment, diagnosis, recoveryProbability, diagnosisConfidence, customer) {
  const triggered = [];

  // G1: Max retries reached
  if (payment.attemptNumber >= MAX_RETRIES) {
    triggered.push({
      rule: 'MAX_RETRIES_REACHED',
      reason: `Attempt #${payment.attemptNumber} reaches maximum of ${MAX_RETRIES}`,
      forcedAction: ACTIONS.STOP,
    });
  }

  // G2: Recovery probability too low
  if (recoveryProbability < MIN_RECOVERY_PROBABILITY) {
    triggered.push({
      rule: 'RECOVERY_PROBABILITY_TOO_LOW',
      reason: `Recovery probability ${(recoveryProbability * 100).toFixed(0)}% is below threshold ${(MIN_RECOVERY_PROBABILITY * 100).toFixed(0)}%`,
      forcedAction: ACTIONS.STOP,
    });
  }

  // G3: Low confidence → human review
  if (diagnosisConfidence < MIN_CONFIDENCE) {
    triggered.push({
      rule: 'LOW_CONFIDENCE',
      reason: `Diagnosis confidence ${(diagnosisConfidence * 100).toFixed(0)}% is below threshold ${(MIN_CONFIDENCE * 100).toFixed(0)}%`,
      forcedAction: ACTIONS.ESCALATE_TO_HUMAN,
    });
  }

  // G4: Hard decline categories should not be retried
  if (diagnosis.category === 'HARD_DECLINE' && payment.attemptNumber >= 2) {
    triggered.push({
      rule: 'HARD_DECLINE_RETRY_BLOCK',
      reason: `Hard decline (${payment.failureReason}) cannot be resolved by retry`,
      forcedAction: ACTIONS.STOP,
    });
  }

  // G5: High-value ambiguous case → human review
  if (payment.amount >= HIGH_VALUE_THRESHOLD && diagnosis.category === 'UNKNOWN') {
    triggered.push({
      rule: 'HIGH_VALUE_UNKNOWN',
      reason: `High-value payment (₹${payment.amount?.toLocaleString('en-IN')}) with unknown failure requires human review`,
      forcedAction: ACTIONS.ESCALATE_TO_HUMAN,
    });
  }

  // G6: Customer contacted too many times
  if (customer && customer.contactCount >= MAX_CUSTOMER_CONTACTS) {
    triggered.push({
      rule: 'MAX_CONTACTS_REACHED',
      reason: `Customer already contacted ${customer.contactCount} times (max ${MAX_CUSTOMER_CONTACTS})`,
      forcedAction: ACTIONS.STOP,
    });
  }

  // G7: Stolen/lost card — never retry
  if (['stolen_card', 'lost_card', 'blocked_card'].includes(payment.failureReason)) {
    if (payment.amount >= HIGH_VALUE_THRESHOLD) {
      triggered.push({
        rule: 'HIGH_RISK_HARD_DECLINE',
        reason: `${payment.failureReason} with high value requires human review`,
        forcedAction: ACTIONS.ESCALATE_TO_HUMAN,
      });
    } else {
      triggered.push({
        rule: 'PERMANENT_HARD_DECLINE',
        reason: `${payment.failureReason} is non-recoverable by automated action`,
        forcedAction: ACTIONS.STOP,
      });
    }
  }

  return triggered;
}

/**
 * Select action from policy (no guardrail override).
 * Returns: { action, reason, confidence }
 */
function policySelectAction(payment, diagnosis, recoveryProbability, customer) {
  const { category } = diagnosis;
  const successRate = payment.previousSuccessRate || 0;
  const isHighValue = payment.amount >= HIGH_VALUE_THRESHOLD;
  const isSubscription = payment.subscription;

  // TRANSIENT: retry is the right call
  if (category === 'TRANSIENT') {
    if (recoveryProbability >= 0.75) {
      const action = payment.attemptNumber === 1 ? ACTIONS.RETRY_NOW : ACTIONS.RETRY_LATER;
      return {
        action,
        reason: `Transient failure (${payment.failureReason}) with ${(recoveryProbability * 100).toFixed(0)}% recovery probability. ${action === ACTIONS.RETRY_NOW ? 'Immediate retry recommended.' : 'Delayed retry recommended to avoid rapid re-failure.'}`,
        confidence: recoveryProbability,
      };
    } else {
      return {
        action: ACTIONS.RETRY_LATER,
        reason: `Transient failure with moderate recovery probability (${(recoveryProbability * 100).toFixed(0)}%). Delayed retry is safer.`,
        confidence: recoveryProbability * 0.9,
      };
    }
  }

  // SOFT_DECLINE: retry later or payment link
  if (category === 'SOFT_DECLINE') {
    if (recoveryProbability >= 0.45 && successRate >= 0.50) {
      return {
        action: ACTIONS.RETRY_LATER,
        reason: `Soft decline (${payment.failureReason}) with ${(recoveryProbability * 100).toFixed(0)}% recovery probability. Customer has ${(successRate * 100).toFixed(0)}% historical success. Retry after delay when funds/limit may have cleared.`,
        confidence: recoveryProbability,
      };
    } else if (recoveryProbability >= 0.25) {
      return {
        action: ACTIONS.SEND_PAYMENT_LINK,
        reason: `Soft decline with lower recovery probability (${(recoveryProbability * 100).toFixed(0)}%). Sending payment link gives customer agency to retry when ready.`,
        confidence: recoveryProbability * 0.85,
      };
    } else {
      return {
        action: ACTIONS.STOP,
        reason: `Soft decline with low recovery probability (${(recoveryProbability * 100).toFixed(0)}%). Further action unlikely to recover payment.`,
        confidence: 0.7,
      };
    }
  }

  // HARD_DECLINE: customer action required
  if (category === 'HARD_DECLINE') {
    if (['expired_card', 'invalid_card'].includes(payment.failureReason)) {
      if (successRate >= 0.70) {
        return {
          action: ACTIONS.SEND_PAYMENT_LINK,
          reason: `${payment.failureReason} requires card update. Customer has strong payment history (${(successRate * 100).toFixed(0)}%). Sending payment link for re-submission with valid card.`,
          confidence: 0.78,
        };
      } else {
        return {
          action: ACTIONS.SUGGEST_ALTERNATIVE_METHOD,
          reason: `${payment.failureReason} — card update pathway less likely. Suggesting alternative payment method.`,
          confidence: 0.65,
        };
      }
    }
    return {
      action: ACTIONS.SUGGEST_ALTERNATIVE_METHOD,
      reason: `Hard decline (${payment.failureReason}) — current payment method cannot succeed. Suggesting alternative method.`,
      confidence: 0.60,
    };
  }

  // CUSTOMER_ACTION_REQUIRED: reminder
  if (category === 'CUSTOMER_ACTION_REQUIRED') {
    if (payment.failureReason === 'customer_cancelled' && successRate >= 0.65) {
      return {
        action: ACTIONS.SEND_REMINDER,
        reason: `Customer cancelled payment but has ${(successRate * 100).toFixed(0)}% historical success. A gentle reminder may re-engage them.`,
        confidence: 0.65,
      };
    } else if (payment.failureReason === 'payment_abandoned') {
      return {
        action: ACTIONS.SEND_PAYMENT_LINK,
        reason: `Payment was abandoned. Sending a direct payment link reduces friction for customer to complete the payment.`,
        confidence: 0.60,
      };
    }
    return {
      action: ACTIONS.SEND_REMINDER,
      reason: `Customer action required. Sending reminder to re-engage.`,
      confidence: 0.55,
    };
  }

  // UNKNOWN: escalate or stop based on value
  if (category === 'UNKNOWN') {
    if (isHighValue) {
      return {
        action: ACTIONS.ESCALATE_TO_HUMAN,
        reason: `Unknown failure on high-value payment (₹${payment.amount?.toLocaleString('en-IN')}). Human review required.`,
        confidence: 0.50,
      };
    }
    if (recoveryProbability >= 0.35) {
      return {
        action: ACTIONS.RETRY_LATER,
        reason: `Unknown failure with moderate recovery probability. Cautious retry after delay.`,
        confidence: 0.45,
      };
    }
    return {
      action: ACTIONS.STOP,
      reason: `Unknown failure with low recovery probability. Cannot safely take automated action.`,
      confidence: 0.55,
    };
  }

  // Fallback
  return {
    action: ACTIONS.ESCALATE_TO_HUMAN,
    reason: 'Unable to determine safe automated action. Escalating to human review.',
    confidence: 0.40,
  };
}

/**
 * Main decision function.
 * Guardrails override policy when triggered.
 */
async function makeDecision(payment, diagnosis, recoveryProbability, customer = null, llmService = null) {
  const guardrails = evaluateGuardrails(
    payment, diagnosis, recoveryProbability, diagnosis.confidence, customer
  );

  let selectedAction, decisionReason, decisionConfidence;
  const guardrailsApplied = guardrails.map(g => g.rule);

  // Guardrails take precedence — use highest-priority forced action
  if (guardrails.length > 0) {
    // Priority: STOP > ESCALATE_TO_HUMAN (if both triggered, STOP wins for safety)
    const forceStop = guardrails.find(g => g.forcedAction === ACTIONS.STOP);
    const forceEscalate = guardrails.find(g => g.forcedAction === ACTIONS.ESCALATE_TO_HUMAN);

    if (forceStop) {
      selectedAction = ACTIONS.STOP;
      decisionReason = forceStop.reason;
      decisionConfidence = 0.90;
    } else if (forceEscalate) {
      selectedAction = ACTIONS.ESCALATE_TO_HUMAN;
      decisionReason = forceEscalate.reason;
      decisionConfidence = 0.85;
    } else {
      const first = guardrails[0];
      selectedAction = first.forcedAction;
      decisionReason = first.reason;
      decisionConfidence = 0.80;
    }
  } else {
    // Policy selection
    const policy = policySelectAction(payment, diagnosis, recoveryProbability, customer);
    selectedAction = policy.action;
    decisionReason = policy.reason;
    decisionConfidence = policy.confidence;

    // Optionally enrich with LLM reasoning (never changes the action)
    if (llmService) {
      try {
        const llmReason = await llmService.getReasoning({
          selectedAction,
          payment,
          diagnosis,
          recoveryProbability,
          policyReason: decisionReason,
        });
        if (llmReason) {
          decisionReason = llmReason;
        }
      } catch (err) {
        // LLM unavailable — keep policy reason
        console.warn(`LLM reasoning unavailable: ${err.message}`);
      }
    }
  }

  return {
    selectedAction,
    decisionReason,
    decisionConfidence: Math.round(decisionConfidence * 100) / 100,
    guardrailsApplied,
    humanReviewRequired: selectedAction === ACTIONS.ESCALATE_TO_HUMAN,
    humanReviewReason: selectedAction === ACTIONS.ESCALATE_TO_HUMAN ? decisionReason : null,
  };
}

module.exports = { makeDecision, evaluateGuardrails, policySelectAction, ACTIONS };

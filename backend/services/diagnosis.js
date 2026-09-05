/**
 * RecoverAI Diagnosis Service
 *
 * Classifies payment failures using a deterministic taxonomy first.
 * Optionally enriches with LLM explanation when available.
 * Never fabricates transaction facts.
 */

// ─── Failure Taxonomy (deterministic mapping) ────────────────────────────────
const FAILURE_TAXONOMY = {
  // TRANSIENT
  bank_timeout: { category: 'TRANSIENT', label: 'Bank Timeout', baseConfidence: 0.95 },
  network_error: { category: 'TRANSIENT', label: 'Network Error', baseConfidence: 0.95 },
  gateway_timeout: { category: 'TRANSIENT', label: 'Gateway Timeout', baseConfidence: 0.95 },
  issuer_unavailable: { category: 'TRANSIENT', label: 'Issuer Temporarily Unavailable', baseConfidence: 0.90 },

  // SOFT_DECLINE
  insufficient_funds: { category: 'SOFT_DECLINE', label: 'Insufficient Funds', baseConfidence: 0.92 },
  temporary_limit: { category: 'SOFT_DECLINE', label: 'Temporary Spending Limit Exceeded', baseConfidence: 0.90 },
  daily_limit_exceeded: { category: 'SOFT_DECLINE', label: 'Daily Limit Exceeded', baseConfidence: 0.88 },

  // HARD_DECLINE
  expired_card: { category: 'HARD_DECLINE', label: 'Card Expired', baseConfidence: 0.98 },
  invalid_card: { category: 'HARD_DECLINE', label: 'Invalid Card Details', baseConfidence: 0.95 },
  blocked_card: { category: 'HARD_DECLINE', label: 'Card Blocked by Issuer', baseConfidence: 0.95 },
  authentication_failed: { category: 'HARD_DECLINE', label: 'Authentication Failed (3DS)', baseConfidence: 0.88 },
  stolen_card: { category: 'HARD_DECLINE', label: 'Card Reported Stolen', baseConfidence: 0.99 },
  lost_card: { category: 'HARD_DECLINE', label: 'Card Reported Lost', baseConfidence: 0.99 },

  // CUSTOMER_ACTION_REQUIRED
  customer_cancelled: { category: 'CUSTOMER_ACTION_REQUIRED', label: 'Customer Cancelled Payment', baseConfidence: 0.95 },
  payment_abandoned: { category: 'CUSTOMER_ACTION_REQUIRED', label: 'Payment Abandoned by Customer', baseConfidence: 0.85 },

  // UNKNOWN (catch-all)
  unknown_failure: { category: 'UNKNOWN', label: 'Unknown Failure', baseConfidence: 0.40 },
};

// Recoverability descriptions per category
const CATEGORY_DESCRIPTIONS = {
  TRANSIENT: 'Temporary technical issue. High probability of success on retry.',
  SOFT_DECLINE: 'Temporary account or limit issue. May resolve with retry after delay or alternative method.',
  HARD_DECLINE: 'Permanent card/account issue requiring customer action. Retry will not succeed.',
  CUSTOMER_ACTION_REQUIRED: 'Customer intervention needed. Direct outreach recommended.',
  UNKNOWN: 'Failure cause could not be determined. Human review recommended for high-value cases.',
};

/**
 * Classify a payment failure deterministically.
 * Returns: { category, label, confidence, diagnosis, explanation, source }
 */
function classifyFailure(payment) {
  const failureReason = (payment.failureReason || '').toLowerCase().trim();

  // Direct lookup
  if (FAILURE_TAXONOMY[failureReason]) {
    const entry = FAILURE_TAXONOMY[failureReason];

    // Adjust confidence based on context
    let confidence = entry.baseConfidence;

    // Repeated failure with same reason increases classification confidence
    if (payment.attemptNumber > 1) confidence = Math.min(confidence + 0.02, 0.99);

    // Unknown prefix lowers it
    if (failureReason.startsWith('unknown')) confidence = 0.40;

    const category = payment.failureCategory || entry.category;

    return {
      category,
      label: entry.label,
      confidence,
      diagnosis: buildDiagnosisText(payment, entry, category),
      explanation: CATEGORY_DESCRIPTIONS[category],
      source: 'deterministic',
    };
  }

  // Fuzzy matching for partial matches
  for (const [key, entry] of Object.entries(FAILURE_TAXONOMY)) {
    if (failureReason.includes(key) || key.includes(failureReason)) {
      return {
        category: entry.category,
        label: entry.label,
        confidence: Math.max(entry.baseConfidence - 0.10, 0.50),
        diagnosis: buildDiagnosisText(payment, entry, entry.category),
        explanation: CATEGORY_DESCRIPTIONS[entry.category],
        source: 'deterministic_fuzzy',
      };
    }
  }

  // Fallback: UNKNOWN with low confidence
  return {
    category: 'UNKNOWN',
    label: 'Unrecognized Failure',
    confidence: 0.35,
    diagnosis: `Payment ${payment.paymentId} failed with reason "${payment.failureReason}" which does not match any known failure pattern.`,
    explanation: CATEGORY_DESCRIPTIONS.UNKNOWN,
    source: 'deterministic_fallback',
  };
}

function buildDiagnosisText(payment, entry, category) {
  const method = payment.paymentMethod?.replace(/_/g, ' ') || 'unknown method';
  const amount = `₹${payment.amount?.toLocaleString('en-IN') || '?'}`;

  const parts = [
    `${entry.label} detected for ${amount} ${method} payment.`,
    `Category: ${category}.`,
    `Attempt #${payment.attemptNumber}.`,
  ];

  if (payment.previousSuccessRate !== undefined) {
    const pct = (payment.previousSuccessRate * 100).toFixed(0);
    parts.push(`Customer historical success rate: ${pct}%.`);
  }

  parts.push(CATEGORY_DESCRIPTIONS[category]);

  return parts.join(' ');
}

/**
 * Main diagnosis function — deterministic first, LLM enrichment if available.
 */
async function diagnosePayment(payment, llmService = null) {
  // Step 1: Deterministic classification
  const base = classifyFailure(payment);

  // Step 2: If LLM available and not a hard/obvious case, enrich explanation
  if (llmService && base.category !== 'HARD_DECLINE' && base.confidence < 0.90) {
    try {
      const llmResult = await llmService.getDiagnosis({
        paymentId: payment.paymentId,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        failureReason: payment.failureReason,
        failureCategory: base.category,  // supply the determined category
        attemptNumber: payment.attemptNumber,
        previousSuccessRate: payment.previousSuccessRate,
        customerTenureDays: payment.customerTenureDays,
        subscription: payment.subscription,
      });

      if (llmResult && llmResult.explanation) {
        return {
          ...base,
          explanation: llmResult.explanation,
          llmEnriched: true,
          source: 'llm_with_fallback',
        };
      }
    } catch (err) {
      // LLM failed — use deterministic result, don't surface error to user
      console.warn(`LLM diagnosis unavailable for ${payment.paymentId}: ${err.message}`);
    }
  }

  return base;
}

module.exports = { diagnosePayment, classifyFailure, FAILURE_TAXONOMY, CATEGORY_DESCRIPTIONS };

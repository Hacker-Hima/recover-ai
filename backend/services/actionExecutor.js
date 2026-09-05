/**
 * RecoverAI Action Executor
 *
 * Calls the mock gateway for each action type.
 * Records RecoveryAction documents.
 * Never processes real money.
 */

const axios = require('axios');
const RecoveryAction = require('../models/RecoveryAction');

const GATEWAY_BASE = process.env.GATEWAY_URL || 'http://localhost:3001/mock-gateway';

async function callGateway(endpoint, data) {
  try {
    const resp = await axios.post(`${GATEWAY_BASE}${endpoint}`, data, { timeout: 5000 });
    return resp.data;
  } catch (err) {
    return {
      success: false,
      gatewayStatus: 'GATEWAY_ERROR',
      message: err.message,
    };
  }
}

/**
 * Execute the selected action and record the result.
 * Returns the RecoveryAction document.
 */
async function executeAction(payment, decision, source = 'recoverai') {
  const { selectedAction } = decision;
  const executedAt = new Date();

  let gatewayResponse;

  switch (selectedAction) {
    case 'RETRY_NOW':
    case 'RETRY_LATER': {
      gatewayResponse = await callGateway(`/payments/${payment.paymentId}/retry`, {
        failureCategory: payment.failureCategory,
        amount: payment.amount,
        retryType: selectedAction,
        attemptNumber: payment.attemptNumber,
      });
      break;
    }
    case 'SEND_PAYMENT_LINK': {
      gatewayResponse = await callGateway(`/payments/${payment.paymentId}/payment-link`, {
        failureCategory: payment.failureCategory,
        amount: payment.amount,
        customerId: payment.customerId,
      });
      break;
    }
    case 'SEND_REMINDER': {
      gatewayResponse = await callGateway(`/payments/${payment.paymentId}/notify`, {
        failureCategory: payment.failureCategory,
        amount: payment.amount,
        customerId: payment.customerId,
        channel: 'email',
      });
      break;
    }
    case 'SUGGEST_ALTERNATIVE_METHOD': {
      gatewayResponse = await callGateway(`/payments/${payment.paymentId}/suggest-alternative`, {
        failureCategory: payment.failureCategory,
        amount: payment.amount,
        customerId: payment.customerId,
      });
      break;
    }
    case 'ESCALATE_TO_HUMAN': {
      gatewayResponse = await callGateway(`/payments/${payment.paymentId}/escalate`, {
        reason: decision.decisionReason,
        decisionConfidence: decision.decisionConfidence,
        customerId: payment.customerId,
      });
      break;
    }
    case 'STOP': {
      gatewayResponse = await callGateway(`/payments/${payment.paymentId}/stop`, {
        reason: decision.decisionReason,
      });
      break;
    }
    default:
      gatewayResponse = { success: false, message: `Unknown action: ${selectedAction}` };
  }

  // Determine result
  let result, recoveredAmount;
  if (selectedAction === 'ESCALATE_TO_HUMAN') {
    result = 'escalated';
    recoveredAmount = 0;
  } else if (selectedAction === 'STOP') {
    result = 'stopped';
    recoveredAmount = 0;
  } else if (gatewayResponse.success && (gatewayResponse.customerWillPay || gatewayResponse.customerWillAct || gatewayResponse.customerWillSwitch || gatewayResponse.gatewayStatus === 'PAYMENT_SUCCESS')) {
    result = 'success';
    recoveredAmount = gatewayResponse.recoveredAmount || payment.amount;
  } else if (gatewayResponse.gatewayStatus === 'GATEWAY_ERROR') {
    result = 'failed';
    recoveredAmount = 0;
  } else {
    // Async actions (payment link, reminder) → pending customer action
    result = ['SEND_PAYMENT_LINK', 'SEND_REMINDER', 'SUGGEST_ALTERNATIVE_METHOD'].includes(selectedAction)
      ? 'pending'
      : 'failed';
    recoveredAmount = gatewayResponse.recoveredAmount || 0;
  }

  // Record action
  const action = await RecoveryAction.create({
    paymentId: payment.paymentId,
    actionType: selectedAction,
    scheduledAt: selectedAction === 'RETRY_LATER' ? new Date(Date.now() + 2 * 60 * 60 * 1000) : executedAt,
    executedAt,
    result,
    recoveredAmount,
    failureReason: gatewayResponse.message,
    gatewayResponse,
    source,
    attemptNumber: payment.attemptNumber,
  });

  return action;
}

module.exports = { executeAction };

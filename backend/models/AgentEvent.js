const mongoose = require('mongoose');

const AgentEventSchema = new mongoose.Schema({
  paymentId: { type: String, required: true, index: true },
  eventType: {
    type: String,
    enum: [
      'PAYMENT_DETECTED',
      'REVENUE_AT_RISK',
      'FAILURE_CLASSIFIED',
      'RECOVERY_PROBABILITY_CALCULATED',
      'PRIORITY_SCORED',
      'CUSTOMER_ANALYZED',
      'GUARDRAIL_APPLIED',
      'DECISION_MADE',
      'ACTION_SCHEDULED',
      'ACTION_EXECUTED',
      'OUTCOME_OBSERVED',
      'PAYMENT_RECOVERED',
      'PAYMENT_FAILED',
      'ESCALATED_TO_HUMAN',
      'CASE_STOPPED',
      'HUMAN_ACTION_TAKEN',
      'ERROR',
    ],
    required: true
  },
  description: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed },
  source: {
    type: String,
    enum: ['recoverai', 'baseline', 'human'],
    default: 'recoverai'
  },
  sequenceNumber: { type: Number, required: true },
}, { timestamps: true });

AgentEventSchema.index({ paymentId: 1, sequenceNumber: 1 });

module.exports = mongoose.model('AgentEvent', AgentEventSchema);

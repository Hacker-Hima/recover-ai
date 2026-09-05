const mongoose = require('mongoose');

const AgentDecisionSchema = new mongoose.Schema({
  paymentId: { type: String, required: true, index: true },
  diagnosis: { type: String, required: true },
  diagnosisConfidence: { type: Number, required: true, min: 0, max: 1 },
  diagnosisSource: {
    type: String,
    enum: ['deterministic', 'llm', 'llm_with_fallback'],
    default: 'deterministic'
  },
  diagnosisExplanation: { type: String },
  recoveryProbability: { type: Number, required: true, min: 0, max: 1 },
  recoveryProbabilitySource: {
    type: String,
    enum: ['ml_model', 'heuristic'],
    default: 'heuristic'
  },
  priorityScore: { type: Number, required: true },
  priorityBreakdown: {
    normalizedAmount: Number,
    recoveryProbability: Number,
    customerValueFactor: Number,
    urgencyFactor: Number
  },
  selectedAction: {
    type: String,
    enum: ['RETRY_NOW', 'RETRY_LATER', 'SEND_PAYMENT_LINK', 'SEND_REMINDER', 'SUGGEST_ALTERNATIVE_METHOD', 'ESCALATE_TO_HUMAN', 'STOP'],
    required: true
  },
  decisionReason: { type: String, required: true },
  decisionConfidence: { type: Number, required: true, min: 0, max: 1 },
  guardrailsApplied: [{ type: String }],
  status: {
    type: String,
    enum: ['pending', 'executing', 'completed', 'failed'],
    default: 'pending'
  },
}, { timestamps: true });

module.exports = mongoose.model('AgentDecision', AgentDecisionSchema);

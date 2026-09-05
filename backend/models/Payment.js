const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  paymentId: { type: String, required: true, unique: true, index: true },
  customerId: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet'],
    required: true
  },
  status: {
    type: String,
    enum: ['failed', 'recovered', 'pending_retry', 'escalated', 'stopped', 'processing'],
    default: 'failed',
    index: true
  },
  failureReason: { type: String, required: true },
  failureCategory: {
    type: String,
    enum: ['TRANSIENT', 'SOFT_DECLINE', 'HARD_DECLINE', 'CUSTOMER_ACTION_REQUIRED', 'UNKNOWN'],
    index: true
  },
  attemptNumber: { type: Number, default: 1 },
  previousSuccessRate: { type: Number, default: 0, min: 0, max: 1 },
  previousFailures: { type: Number, default: 0 },
  customerTenureDays: { type: Number, default: 0 },
  subscription: { type: Boolean, default: false },
  // Ground truth for ML evaluation
  groundTruthRecovered: { type: Boolean },
  // Agent processing results
  recoveryProbability: { type: Number },
  priorityScore: { type: Number },
  revenueAtRisk: { type: Number },
  recoveredAmount: { type: Number, default: 0 },
  humanReviewRequired: { type: Boolean, default: false },
  humanReviewReason: { type: String },
  humanReviewStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'na'],
    default: 'na'
  },
  // Source tagging for baseline vs RecoverAI comparison
  agentSource: {
    type: String,
    enum: ['recoverai', 'baseline', 'unprocessed'],
    default: 'unprocessed'
  },
  // Demo mode flag
  isDemo: { type: Boolean, default: false },
  demoScenario: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);

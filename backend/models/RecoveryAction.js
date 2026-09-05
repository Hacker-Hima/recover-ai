const mongoose = require('mongoose');

const RecoveryActionSchema = new mongoose.Schema({
  paymentId: { type: String, required: true, index: true },
  actionType: {
    type: String,
    enum: ['RETRY_NOW', 'RETRY_LATER', 'SEND_PAYMENT_LINK', 'SEND_REMINDER', 'SUGGEST_ALTERNATIVE_METHOD', 'ESCALATE_TO_HUMAN', 'STOP'],
    required: true
  },
  scheduledAt: { type: Date },
  executedAt: { type: Date },
  result: {
    type: String,
    enum: ['success', 'failed', 'pending', 'skipped', 'escalated', 'stopped'],
    default: 'pending'
  },
  recoveredAmount: { type: Number, default: 0 },
  failureReason: { type: String },
  gatewayResponse: { type: mongoose.Schema.Types.Mixed },
  source: {
    type: String,
    enum: ['recoverai', 'baseline'],
    default: 'recoverai'
  },
  attemptNumber: { type: Number, default: 1 },
}, { timestamps: true });

module.exports = mongoose.model('RecoveryAction', RecoveryActionSchema);

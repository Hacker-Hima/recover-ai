const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  customerId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  paymentHistory: [{
    paymentId: String,
    amount: Number,
    status: String,
    date: Date
  }],
  successfulPayments: { type: Number, default: 0 },
  failedPayments: { type: Number, default: 0 },
  averagePaymentAmount: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  customerTenureDays: { type: Number, default: 0 },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'paused', 'cancelled', 'none'],
    default: 'none'
  },
  riskTier: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  contactCount: { type: Number, default: 0 },
  lastContactedAt: { type: Date },
  preferredPaymentMethod: { type: String },
}, { timestamps: true });

// Computed field: success rate
CustomerSchema.virtual('successRate').get(function () {
  const total = this.successfulPayments + this.failedPayments;
  return total > 0 ? this.successfulPayments / total : 0;
});

module.exports = mongoose.model('Customer', CustomerSchema);

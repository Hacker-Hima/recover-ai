const Payment = require('../models/Payment');
const AgentDecision = require('../models/AgentDecision');
const RecoveryAction = require('../models/RecoveryAction');
const AgentEvent = require('../models/AgentEvent');
const Customer = require('../models/Customer');

/**
 * GET /api/payments
 * List payments with filters and pagination.
 */
async function listPayments(req, res) {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      failureCategory,
      agentSource,
      isDemo,
      sortBy = 'priorityScore',
      sortDir = 'desc',
      search,
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (failureCategory) filter.failureCategory = failureCategory;
    if (agentSource) filter.agentSource = agentSource;
    if (isDemo !== undefined) filter.isDemo = isDemo === 'true';
    if (search) filter.paymentId = { $regex: search, $options: 'i' };

    const sort = {};
    sort[sortBy] = sortDir === 'asc' ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [payments, total] = await Promise.all([
      Payment.find(filter).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
      Payment.countDocuments(filter),
    ]);

    res.json({
      success: true,
      payments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/payments/:paymentId
 * Get payment detail including decision, actions, customer.
 */
async function getPayment(req, res) {
  try {
    const { paymentId } = req.params;

    const [payment, decision, actions, events, customer] = await Promise.all([
      Payment.findOne({ paymentId }).lean(),
      AgentDecision.findOne({ paymentId }).sort({ createdAt: -1 }).lean(),
      RecoveryAction.find({ paymentId }).sort({ createdAt: 1 }).lean(),
      AgentEvent.find({ paymentId }).sort({ sequenceNumber: 1 }).lean(),
      null, // customer resolved below
    ]);

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    const cust = await Customer.findOne({ customerId: payment.customerId }).lean();

    res.json({
      success: true,
      payment,
      decision,
      actions,
      events,
      customer: cust,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/payments/:paymentId/timeline
 * Get agent activity timeline for a payment.
 */
async function getPaymentTimeline(req, res) {
  try {
    const { paymentId } = req.params;
    const events = await AgentEvent.find({ paymentId }).sort({ sequenceNumber: 1 }).lean();

    res.json({ success: true, paymentId, events });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/payments/queue/priority
 * Get priority-sorted queue for dashboard.
 */
async function getPriorityQueue(req, res) {
  try {
    const { source = 'recoverai', limit = 20 } = req.query;

    const payments = await Payment.find({
      status: { $in: ['failed', 'pending_retry', 'processing', 'escalated'] },
    })
      .sort({ priorityScore: -1, amount: -1 })
      .limit(parseInt(limit))
      .lean();

    const enriched = await Promise.all(
      payments.map(async (p) => {
        const decision = await AgentDecision.findOne({ paymentId: p.paymentId })
          .sort({ createdAt: -1 })
          .lean();
        return { ...p, decision };
      })
    );

    res.json({ success: true, queue: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { listPayments, getPayment, getPaymentTimeline, getPriorityQueue };

const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const AgentDecision = require('../models/AgentDecision');
const RecoveryAction = require('../models/RecoveryAction');
const AgentEvent = require('../models/AgentEvent');
const { generateDataset, generateDemoCases } = require('../utils/dataGenerator');

/**
 * POST /api/data/generate
 * Generate a full synthetic dataset (default 5000 payments).
 */
async function generateData(req, res) {
  try {
    const count = parseInt(req.query.count) || 5000;

    // Clear existing non-demo data
    await Promise.all([
      Payment.deleteMany({ isDemo: false }),
      Customer.deleteMany({}),
    ]);

    const { customers, payments } = generateDataset(count);

    // Bulk insert
    await Customer.insertMany(customers, { ordered: false });
    await Payment.insertMany(payments, { ordered: false });

    res.json({
      success: true,
      message: `Generated ${payments.length} payments across ${customers.length} customers`,
      stats: {
        totalPayments: payments.length,
        totalCustomers: customers.length,
        recoverable: payments.filter(p => p.groundTruthRecovered).length,
        notRecoverable: payments.filter(p => !p.groundTruthRecovered).length,
        byCategory: payments.reduce((acc, p) => {
          acc[p.failureCategory] = (acc[p.failureCategory] || 0) + 1;
          return acc;
        }, {}),
      },
    });
  } catch (err) {
    console.error('Generate data error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/data/demo
 * Load the 20 curated demo cases.
 */
async function loadDemoData(req, res) {
  try {
    // Clear ALL existing data for a clean demo
    await Promise.all([
      Payment.deleteMany({}),
      Customer.deleteMany({}),
      AgentDecision.deleteMany({}),
      RecoveryAction.deleteMany({}),
      AgentEvent.deleteMany({}),
    ]);

    const { customers, payments } = generateDemoCases();

    await Customer.insertMany(customers, { ordered: false });
    await Payment.insertMany(payments, { ordered: false });

    res.json({
      success: true,
      message: `Loaded ${payments.length} demo cases`,
      payments: payments.map(p => ({
        paymentId: p.paymentId,
        amount: p.amount,
        failureCategory: p.failureCategory,
        failureReason: p.failureReason,
        demoScenario: p.demoScenario,
        groundTruthRecovered: p.groundTruthRecovered,
      })),
    });
  } catch (err) {
    console.error('Load demo error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/data/reset
 * Wipe all data and reload demo cases.
 */
async function resetDemo(req, res) {
  try {
    await Promise.all([
      Payment.deleteMany({}),
      Customer.deleteMany({}),
      AgentDecision.deleteMany({}),
      RecoveryAction.deleteMany({}),
      AgentEvent.deleteMany({}),
    ]);

    const { customers, payments } = generateDemoCases();
    await Customer.insertMany(customers, { ordered: false });
    await Payment.insertMany(payments, { ordered: false });

    res.json({
      success: true,
      message: 'Demo reset complete — 20 cases ready for processing',
    });
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/data/status
 * Quick data status check.
 */
async function getDataStatus(req, res) {
  try {
    const [totalPayments, totalCustomers, processed, unprocessed] = await Promise.all([
      Payment.countDocuments(),
      Customer.countDocuments(),
      Payment.countDocuments({ agentSource: { $ne: 'unprocessed' } }),
      Payment.countDocuments({ agentSource: 'unprocessed' }),
    ]);

    res.json({
      success: true,
      totalPayments,
      totalCustomers,
      processed,
      unprocessed,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { generateData, loadDemoData, resetDemo, getDataStatus };

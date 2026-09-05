const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const AgentEvent = require('../models/AgentEvent');

// GET /api/human-review — list all pending human review cases
router.get('/', async (req, res) => {
  try {
    const payments = await Payment.find({
      humanReviewRequired: true,
      humanReviewStatus: 'pending',
    }).sort({ amount: -1 }).lean();
    res.json({ success: true, payments, total: payments.length });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/human-review/:paymentId/approve — human approves agent action
router.post('/:paymentId/approve', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { note } = req.body;
    await Payment.updateOne({ paymentId }, { humanReviewStatus: 'approved' });
    const events = await AgentEvent.countDocuments({ paymentId });
    await AgentEvent.create({
      paymentId,
      eventType: 'HUMAN_ACTION_TAKEN',
      description: `Human reviewer approved action${note ? ': ' + note : ''}`,
      data: { action: 'approved', note },
      source: 'human',
      sequenceNumber: events + 1,
    });
    res.json({ success: true, message: 'Action approved' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/human-review/:paymentId/reject — human rejects
router.post('/:paymentId/reject', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { note } = req.body;
    await Payment.updateOne({ paymentId }, { humanReviewStatus: 'rejected', status: 'stopped' });
    const events = await AgentEvent.countDocuments({ paymentId });
    await AgentEvent.create({
      paymentId,
      eventType: 'HUMAN_ACTION_TAKEN',
      description: `Human reviewer rejected action${note ? ': ' + note : ''}`,
      data: { action: 'rejected', note },
      source: 'human',
      sequenceNumber: events + 1,
    });
    res.json({ success: true, message: 'Action rejected' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/human-review/:paymentId/stop — human stops case
router.post('/:paymentId/stop', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { note } = req.body;
    await Payment.updateOne({ paymentId }, { humanReviewStatus: 'rejected', status: 'stopped' });
    const events = await AgentEvent.countDocuments({ paymentId });
    await AgentEvent.create({
      paymentId,
      eventType: 'CASE_STOPPED',
      description: `Human reviewer stopped case${note ? ': ' + note : ''}`,
      data: { action: 'stopped', note },
      source: 'human',
      sequenceNumber: events + 1,
    });
    res.json({ success: true, message: 'Case stopped' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;

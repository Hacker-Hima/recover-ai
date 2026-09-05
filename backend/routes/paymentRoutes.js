const express = require('express');
const router = express.Router();
const { listPayments, getPayment, getPaymentTimeline, getPriorityQueue } = require('../controllers/paymentController');

router.get('/', listPayments);
router.get('/queue/priority', getPriorityQueue);
router.get('/:paymentId', getPayment);
router.get('/:paymentId/timeline', getPaymentTimeline);

module.exports = router;

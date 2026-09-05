const express = require('express');
const router = express.Router();
const { summary, compare, dashboard } = require('../controllers/metricsController');
router.get('/summary', summary);
router.get('/compare', compare);
router.get('/dashboard', dashboard);
module.exports = router;

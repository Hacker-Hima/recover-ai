const express = require('express');
const router = express.Router();
const { startBaseline, getStatus } = require('../controllers/baselineController');
router.post('/run', startBaseline);
router.get('/status', getStatus);
module.exports = router;

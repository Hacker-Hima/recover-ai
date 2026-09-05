const express = require('express');
const router = express.Router();
const { generateData, loadDemoData, resetDemo, getDataStatus } = require('../controllers/dataController');

router.post('/generate', generateData);
router.post('/demo', loadDemoData);
router.delete('/reset', resetDemo);
router.get('/status', getDataStatus);

module.exports = router;

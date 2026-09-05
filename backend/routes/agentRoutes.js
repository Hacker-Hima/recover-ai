const express = require('express');
const router = express.Router();
const { runAgent, getAgentStatus, sseStream } = require('../controllers/agentController');

router.post('/run', runAgent);
router.get('/status', getAgentStatus);
router.get('/events', sseStream);

module.exports = router;

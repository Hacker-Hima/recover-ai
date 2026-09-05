const { processAllPayments, getRunState, getSseClients } = require('../services/agent');
const Payment = require('../models/Payment');

/**
 * POST /api/agent/run
 * Trigger the agent to process all unprocessed payments.
 */
async function runAgent(req, res) {
  try {
    const state = getRunState();
    if (state.isRunning) {
      return res.status(409).json({
        success: false,
        error: 'Agent is already running',
        runState: state,
      });
    }

    const { isDemo = false, batchSize = 100 } = req.body;

    // Start processing in background
    processAllPayments({ source: 'recoverai', isDemo, batchSize }).catch(err => {
      console.error('Agent run error:', err);
    });

    res.json({
      success: true,
      message: 'Agent started',
      runState: getRunState(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/agent/status
 * Current run state.
 */
function getAgentStatus(req, res) {
  res.json({ success: true, runState: getRunState() });
}

/**
 * GET /api/agent/events
 * SSE stream for real-time agent updates.
 */
function sseStream(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send initial state
  res.write(`data: ${JSON.stringify({ type: 'connected', runState: getRunState() })}\n\n`);

  const clients = getSseClients();
  clients.add(res);

  // Heartbeat every 15s
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
  }, 15000);

  req.on('close', () => {
    clients.delete(res);
    clearInterval(heartbeat);
  });
}

module.exports = { runAgent, getAgentStatus, sseStream };

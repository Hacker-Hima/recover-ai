const { runBaseline, getBaselineState } = require('../services/baselineAgent');

async function startBaseline(req, res) {
  try {
    const state = getBaselineState();
    if (state.isRunning) return res.status(409).json({ success: false, error: 'Baseline already running' });

    runBaseline({ batchSize: req.body.batchSize || 100 }).catch(err => console.error('Baseline error:', err));

    res.json({ success: true, message: 'Baseline agent started', state: getBaselineState() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function getStatus(req, res) {
  res.json({ success: true, state: getBaselineState() });
}

module.exports = { startBaseline, getStatus };

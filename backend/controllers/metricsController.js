const { getSummaryMetrics, getComparisonMetrics, getDashboardSummary } = require('../services/metricsService');

async function summary(req, res) {
  try {
    const { source } = req.query;
    const metrics = await getSummaryMetrics(source || null);
    res.json({ success: true, metrics });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
}

async function compare(req, res) {
  try {
    const data = await getComparisonMetrics();
    res.json({ success: true, ...data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
}

async function dashboard(req, res) {
  try {
    const data = await getDashboardSummary();
    res.json({ success: true, ...data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
}

module.exports = { summary, compare, dashboard };

/**
 * RecoverAI Backend Server
 * AI Revenue Recovery Agent for Failed Payments
 *
 * SAFETY: This system uses mock/test data only. No real money is processed.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ──────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ─── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/data', require('./routes/dataRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/agent', require('./routes/agentRoutes'));
app.use('/api/baseline', require('./routes/baselineRoutes'));
app.use('/api/metrics', require('./routes/metricsRoutes'));
app.use('/api/human-review', require('./routes/humanReviewRoutes'));

// Mock payment gateway (internal)
app.use('/mock-gateway', require('./mock-gateway/gateway'));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'RecoverAI Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    safety: 'PROTOTYPE ONLY - No real money processed',
  });
});

// ─── Error Handler ───────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Start ───────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`\n🚀 RecoverAI Backend running on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   ⚠️  PROTOTYPE — No real money processed\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();

module.exports = app;

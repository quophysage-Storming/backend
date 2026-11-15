const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const apiRoutes = require('./routes');

const app = express();

// Security and utility middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// API Routes
app.use('/api', apiRoutes);

// Root route provides API status and documentation endpoints
app.get('/', (req, res) => {
  res.json({
    service: 'SeevPlus OnTime Arrival & Arkesel SMS Backend API',
    status: 'online',
    endpoints: {
      health: 'GET /api/health',
      plans: 'GET /api/payments/plans',
      initializePayment: 'POST /api/payments/initialize',
      confirmPayment: 'POST /api/payments/confirm',
      checkSubscription: 'GET /api/payments/status/:userId',
      paymentHistory: 'GET /api/payments/history',
      registerUser: 'POST /api/users',
      listUsers: 'GET /api/users',
      getUserBadge: 'GET /api/scans/pass/:userId',
      processScan: 'POST /api/scans/process',
      scanHistory: 'GET /api/scans/logs',
      sendSMS: 'POST /api/sms/send',
      smsBalance: 'GET /api/sms/balance',
      smsLogs: 'GET /api/sms/logs'
    }
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  const PORT = config.port;
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 SeevPlus OnTime Arrival Backend Running!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`💳 SeevPlus Plans: Monthly 50 GHS | Yearly 588 GHS`);
    console.log(`📱 Arkesel SMS Mode: ${config.arkesel.apiKey.startsWith('test_') ? 'Mock / Sandbox' : 'Live Gateway'}`);
    console.log(`====================================================`);
  });
}

module.exports = app;

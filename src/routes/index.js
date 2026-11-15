const express = require('express');
const router = express.Router();

const userRoutes = require('./userRoutes');
const paymentRoutes = require('./paymentRoutes');
const scanRoutes = require('./scanRoutes');
const smsRoutes = require('./smsRoutes');

// API Routes
router.use('/users', userRoutes);
router.use('/payments', paymentRoutes);
router.use('/scans', scanRoutes);
router.use('/sms', smsRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'SeevPlus OnTime Arrival & Arkesel SMS Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

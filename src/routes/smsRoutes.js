const express = require('express');
const router = express.Router();
const smsController = require('../controllers/smsController');

// POST /api/sms/send - Send direct SMS via Arkesel
router.post('/send', (req, res) => smsController.sendCustomSMS(req, res));

// GET /api/sms/balance - Get Arkesel SMS credit balance
router.get('/balance', (req, res) => smsController.getBalance(req, res));

// GET /api/sms/logs - Get SMS delivery logs
router.get('/logs', (req, res) => smsController.getLogs(req, res));

module.exports = router;

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// GET /api/payments/plans - List subscription plans (50 GHS Monthly / 588 GHS Yearly)
router.get('/plans', (req, res) => paymentController.getPlans(req, res));

// POST /api/payments/initialize - Initialize payment for subscription
router.post('/initialize', (req, res) => paymentController.initializePayment(req, res));

// POST /api/payments/confirm - Confirm / finalize payment
router.post('/confirm', (req, res) => paymentController.confirmPayment(req, res));

// GET /api/payments/status/:userId - Check user subscription status
router.get('/status/:userId', (req, res) => paymentController.checkSubscription(req, res));

// GET /api/payments/history - List payment transactions
router.get('/history', (req, res) => paymentController.getPayments(req, res));

module.exports = router;

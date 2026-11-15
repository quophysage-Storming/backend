const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// GET /api/payments/plans - List subscription plans (50 GHS Monthly / 588 GHS Yearly)
router.get('/plans', (req, res) => paymentController.getPlans(req, res));

// POST /api/payments/initialize - Initialize payment for subscription (by userId or phone+kid+school)
router.post('/initialize', (req, res) => paymentController.initializePayment(req, res));

// POST /api/payments/confirm - Confirm / finalize payment
router.post('/confirm', (req, res) => paymentController.confirmPayment(req, res));

// GET /api/payments/status - Check user subscription status via query (?phone=... or ?userId=...)
router.get('/status', (req, res) => paymentController.checkSubscription(req, res));

// GET /api/payments/status/:identifier - Check user subscription status by userId or phone
router.get('/status/:identifier', (req, res) => paymentController.checkSubscription(req, res));

// GET /api/payments/history - List payment transactions
router.get('/history', (req, res) => paymentController.getPayments(req, res));

module.exports = router;

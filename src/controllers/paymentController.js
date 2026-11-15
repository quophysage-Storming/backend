const paymentService = require('../services/paymentService');
const db = require('../database');

class PaymentController {
  /**
   * Get available SeevPlus subscription plans (50 GHS monthly / 588 GHS yearly)
   */
  getPlans(req, res) {
    try {
      const plans = paymentService.getPlans();
      res.json({
        success: true,
        merchant: 'SeevPlus OnTime Arrival',
        currency: 'GHS',
        plans
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Initialize SeevPlus payment for monthly or yearly subscription
   */
  initializePayment(req, res) {
    try {
      const { userId, planType, paymentMethod = 'MOMO', momoNumber, momoNetwork } = req.body;

      if (!userId || !planType) {
        return res.status(400).json({
          error: 'userId and planType ("monthly" or "yearly") are required'
        });
      }

      const result = paymentService.initializePayment({
        userId,
        planType,
        paymentMethod,
        momoNumber,
        momoNetwork
      });

      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Confirm or verify payment (Simulated MoMo prompt approval, direct payment, or gateway callback)
   */
  confirmPayment(req, res) {
    try {
      const { reference, status = 'SUCCESS', reason } = req.body;

      if (!reference) {
        return res.status(400).json({ error: 'Payment reference is required' });
      }

      const result = paymentService.processPayment({ reference, status, reason });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Check active subscription status for a given user
   */
  checkSubscription(req, res) {
    try {
      const { userId } = req.params;
      const status = paymentService.checkUserSubscriptionStatus(userId);
      res.json({
        success: true,
        userId,
        ...status
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get payment transactions history
   */
  getPayments(req, res) {
    try {
      const { userId, limit = 50 } = req.query;
      let payments = db.getAll('payments');

      if (userId) {
        payments = payments.filter(p => p.userId === userId);
      }

      res.json({
        success: true,
        count: payments.length,
        payments: payments.slice(-parseInt(limit, 10)).reverse()
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new PaymentController();

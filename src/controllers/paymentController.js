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
   * Supports either userId or (phone + kid + school) from Android App
   */
  initializePayment(req, res) {
    try {
      const {
        userId,
        phone,
        kid,
        school,
        planType,
        paymentMethod = 'MOMO',
        momoNumber,
        momoNetwork
      } = req.body;

      if ((!userId && !phone && !momoNumber) || !planType) {
        return res.status(400).json({
          error: 'Either userId or phone/momoNumber is required, along with planType ("monthly" or "yearly")'
        });
      }

      const result = paymentService.initializePayment({
        userId,
        phone,
        kid,
        school,
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
   * Check active subscription status for a given user or phone number
   */
  checkSubscription(req, res) {
    try {
      const identifier = req.params.identifier || req.params.userId || req.query.phone || req.query.userId;
      if (!identifier) {
        return res.status(400).json({ error: 'User ID or Phone Number is required' });
      }

      const status = paymentService.checkUserSubscriptionStatus(identifier);
      res.json({
        success: true,
        identifier,
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
      const { userId, phone, limit = 50 } = req.query;
      let payments = db.getAll('payments');

      if (userId) {
        payments = payments.filter(p => p.userId === userId);
      }
      if (phone) {
        payments = payments.filter(p => p.userPhone === phone);
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

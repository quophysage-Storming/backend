const arkeselService = require('../services/arkeselService');

class SMSController {
  /**
   * Send custom SMS via Arkesel
   */
  async sendCustomSMS(req, res) {
    try {
      const { recipients, message, metadata } = req.body;

      if (!recipients || !message) {
        return res.status(400).json({
          error: 'recipients and message are required'
        });
      }

      const result = await arkeselService.sendSMS(recipients, message, metadata || { type: 'DIRECT_DISPATCH' });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Check Arkesel SMS Account Balance
   */
  async getBalance(req, res) {
    try {
      const balance = await arkeselService.getBalance();
      res.json(balance);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get SMS delivery logs
   */
  getLogs(req, res) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
      const logs = arkeselService.getLogs(limit);
      res.json({
        success: true,
        count: logs.length,
        logs
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new SMSController();

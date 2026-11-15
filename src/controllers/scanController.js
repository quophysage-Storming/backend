const scanService = require('../services/scanService');
const qrService = require('../services/qrService');

class ScanController {
  /**
   * Process a QR code scan at entrance/checkpoint
   * Accepts Android App QR JSON {"kid":"...","phone":"...","school":"..."},
   * along with device GPS coordinates and location metadata.
   */
  async processScan(req, res) {
    try {
      const {
        token,
        qrData,
        location,
        latitude,
        longitude,
        scannedAt,
        sendNotification = true,
        scannerDevice
      } = req.body;

      const rawInput = token || qrData;

      if (!rawInput) {
        return res.status(400).json({
          error: 'QR code payload (qrData or token) is required'
        });
      }

      const result = await scanService.processScan({
        token: rawInput,
        location,
        latitude,
        longitude,
        scannedAt,
        sendNotification,
        scannerDevice
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get QR pass badge for a user
   */
  async getUserPass(req, res) {
    try {
      const { userId } = req.params;
      const pass = await qrService.generateUserPass(userId);
      res.json({
        success: true,
        pass
      });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  }

  /**
   * Get scan logs / history
   */
  getScanLogs(req, res) {
    try {
      const { userId, guardianPhone, phone, limit } = req.query;
      const logs = scanService.getScanLogs({
        userId,
        guardianPhone: guardianPhone || phone,
        limit: limit ? parseInt(limit, 10) : 50
      });

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

module.exports = new ScanController();

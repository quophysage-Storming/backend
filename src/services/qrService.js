const crypto = require('crypto');
const QRCode = require('qrcode');
const config = require('../config');
const db = require('../database');

class QRService {
  constructor() {
    this.secret = config.ontime.qrSecret;
  }

  /**
   * Create an HMAC signature for user QR data
   */
  sign(data) {
    return crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Generate a tamper-proof signed QR payload token
   * Format: base64(userId|timestamp|signature)
   */
  generateToken(userId) {
    const timestamp = Date.now();
    const dataToSign = `${userId}:${timestamp}`;
    const signature = this.sign(dataToSign);
    const payload = `${userId}:${timestamp}:${signature}`;
    return Buffer.from(payload).toString('base64');
  }

  /**
   * Verify a scanned QR payload token
   */
  verifyToken(token) {
    try {
      if (!token || typeof token !== 'string') {
        return { valid: false, reason: 'Empty or invalid QR code token' };
      }

      // Check if it's base64 encoded or direct userId fallback
      let rawPayload = '';
      try {
        rawPayload = Buffer.from(token, 'base64').toString('utf8');
      } catch (e) {
        rawPayload = token;
      }

      // If user directly scanned their plain userId (for development ease or direct NFC/card ID)
      if (rawPayload.indexOf(':') === -1) {
        const userExists = db.findOne('users', u => u.id === rawPayload);
        if (userExists) {
          return {
            valid: true,
            userId: userExists.id,
            timestamp: Date.now(),
            isLegacyOrDirectId: true
          };
        }
        return { valid: false, reason: 'Invalid QR token format' };
      }

      const parts = rawPayload.split(':');
      if (parts.length < 3) {
        return { valid: false, reason: 'Malformed QR token components' };
      }

      const [userId, timestampStr, signature] = parts;
      const expectedSignature = this.sign(`${userId}:${timestampStr}`);

      if (signature !== expectedSignature) {
        return { valid: false, reason: 'Invalid QR code signature or tampering detected' };
      }

      return {
        valid: true,
        userId,
        timestamp: parseInt(timestampStr, 10)
      };
    } catch (err) {
      return { valid: false, reason: `Verification error: ${err.message}` };
    }
  }

  /**
   * Generate QR Code as DataURL (base64 PNG)
   */
  async generateQRCodeDataURL(payload, options = {}) {
    const defaultOptions = {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: {
        dark: '#1e293b', // slate-800
        light: '#ffffff'
      },
      ...options
    };

    return await QRCode.toDataURL(payload, defaultOptions);
  }

  /**
   * Generate user QR code pass/badge with data URL and signed token
   */
  async generateUserPass(userId) {
    const user = db.findOne('users', u => u.id === userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const token = this.generateToken(userId);
    const qrDataUrl = await this.generateQRCodeDataURL(token);

    return {
      userId: user.id,
      userName: user.name,
      userPhone: user.phone,
      guardianPhone: user.guardianPhone,
      expectedArrivalTime: user.expectedArrivalTime || config.ontime.defaultExpectedArrivalTime,
      token,
      qrDataUrl,
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = new QRService();

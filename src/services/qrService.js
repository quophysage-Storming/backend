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
   * Generate an Android App compatible QR payload
   * Matches the On_Time_Arrival app format: { kid, phone, school }
   */
  generateAppQRPayload({ kid, phone, school }) {
    return JSON.stringify({
      kid: kid || '',
      phone: phone || '',
      school: school || ''
    });
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
   * Supports:
   * 1. Android App JSON format: {"kid":"...", "phone":"...", "school":"..."}
   * 2. Signed HMAC token: base64(userId:timestamp:signature)
   * 3. Plain userId string
   */
  verifyToken(token) {
    try {
      if (!token) {
        return { valid: false, reason: 'Empty QR code token or data' };
      }

      // If token is already an object (parsed JSON from app)
      if (typeof token === 'object') {
        if (token.kid || token.phone || token.school) {
          return {
            valid: true,
            isAppQR: true,
            kid: token.kid || 'Student',
            phone: token.phone || '',
            school: token.school || 'School Checkpoint',
            metadata: token
          };
        }
      }

      let strToken = String(token).trim();

      // Check if it's the Android App's JSON format: {"kid": "...", "phone": "...", "school": "..."}
      if (strToken.startsWith('{') && strToken.endsWith('}')) {
        try {
          const parsed = JSON.parse(strToken);
          if (parsed && (parsed.kid || parsed.phone || parsed.school)) {
            return {
              valid: true,
              isAppQR: true,
              kid: parsed.kid || 'Student',
              phone: parsed.phone || '',
              school: parsed.school || 'School Checkpoint',
              metadata: parsed
            };
          }
        } catch (e) {
          // not valid JSON, continue with other checks
        }
      }

      // Check if it's base64 encoded
      let rawPayload = '';
      try {
        const decoded = Buffer.from(strToken, 'base64').toString('utf8');
        // If decoded is valid JSON
        if (decoded.startsWith('{') && decoded.endsWith('}')) {
          const parsed = JSON.parse(decoded);
          if (parsed && (parsed.kid || parsed.phone || parsed.school)) {
            return {
              valid: true,
              isAppQR: true,
              kid: parsed.kid || 'Student',
              phone: parsed.phone || '',
              school: parsed.school || 'School Checkpoint',
              metadata: parsed
            };
          }
        }
        rawPayload = decoded;
      } catch (e) {
        rawPayload = strToken;
      }

      // If user directly scanned their plain userId (e.g. USR-...)
      if (rawPayload.indexOf(':') === -1) {
        const userExists = db.findOne('users', u => u.id === rawPayload || u.phone === rawPayload || u.guardianPhone === rawPayload);
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
      margin: 1,
      width: 400,
      color: {
        dark: '#14213D', // Match On_Time_Arrival app navy color (0xFF14213D)
        light: '#FFFFFF'
      },
      ...options
    };

    return await QRCode.toDataURL(typeof payload === 'object' ? JSON.stringify(payload) : payload, defaultOptions);
  }

  /**
   * Generate user QR code pass/badge with data URL and signed token
   */
  async generateUserPass(userId) {
    const user = db.findOne('users', u => u.id === userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // App-compatible payload: { kid, phone, school }
    const appPayload = {
      kid: user.name,
      phone: user.guardianPhone || user.phone,
      school: user.institution || 'School'
    };

    const qrDataUrl = await this.generateQRCodeDataURL(appPayload);

    return {
      userId: user.id,
      userName: user.name,
      userPhone: user.phone,
      guardianPhone: user.guardianPhone,
      institution: user.institution,
      expectedArrivalTime: user.expectedArrivalTime || config.ontime.defaultExpectedArrivalTime,
      appPayload,
      qrDataUrl,
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = new QRService();

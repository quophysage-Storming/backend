const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../database');
const { formatGhanaPhoneNumber } = require('../utils/phoneFormatter');

class ArkeselService {
  constructor() {
    this.apiKey = config.arkesel.apiKey;
    this.senderId = config.arkesel.senderId;
    this.smsUrl = config.arkesel.smsUrl;
    this.balanceUrl = config.arkesel.balanceUrl;
  }

  /**
   * Send SMS via Arkesel v2 API
   * @param {string|string[]} recipients - Phone number(s)
   * @param {string} message - SMS message content
   * @param {object} [metadata={}] - Extra tracking metadata (scanId, userId, type)
   */
  async sendSMS(recipients, message, metadata = {}) {
    const rawList = Array.isArray(recipients) ? recipients : [recipients];
    const formattedRecipients = rawList
      .map(p => formatGhanaPhoneNumber(p))
      .filter(Boolean);

    if (formattedRecipients.length === 0) {
      throw new Error('No valid recipients provided for SMS');
    }

    const payload = {
      sender: this.senderId.substring(0, 11), // Arkesel allows max 11 chars
      message: message.trim(),
      recipients: formattedRecipients
    };

    const isTestKey = !this.apiKey || this.apiKey.startsWith('test_') || this.apiKey === 'your_arkesel_api_key_here';

    let resultStatus = 'PENDING';
    let apiResponse = null;
    let errorMessage = null;

    if (isTestKey) {
      // Sandbox / Mock mode for local testing or when real key is not yet added
      console.log(`[Arkesel SMS Mock Mode] To: ${formattedRecipients.join(', ')}`);
      console.log(`[Arkesel SMS Message] "${payload.message}"`);
      resultStatus = 'DELIVERED_MOCK';
      apiResponse = {
        status: 'success',
        code: '1000',
        message: 'SMS logged in mock mode (Set ARKESEL_API_KEY in environment for live dispatch)',
        data: formattedRecipients.map(r => ({
          recipient: r,
          id: `arkesel_mock_${Date.now()}`,
          status: 'successful'
        }))
      };
    } else {
      // Live Arkesel API v2 Call
      try {
        const response = await axios.post(this.smsUrl, payload, {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        apiResponse = response.data;
        resultStatus = 'DELIVERED';
        console.log(`[Arkesel SMS Live Sent] ${JSON.stringify(apiResponse)}`);
      } catch (err) {
        errorMessage = err.response ? JSON.stringify(err.response.data) : err.message;
        resultStatus = 'FAILED';
        console.error('[Arkesel SMS Live Error]', errorMessage);
      }
    }

    // Persist SMS log
    const logEntry = db.insert('smsLogs', {
      id: uuidv4(),
      sender: payload.sender,
      recipients: formattedRecipients,
      message: payload.message,
      status: resultStatus,
      apiResponse,
      errorMessage,
      metadata,
      sentAt: new Date().toISOString()
    });

    return {
      success: resultStatus === 'DELIVERED' || resultStatus === 'DELIVERED_MOCK',
      status: resultStatus,
      smsLogId: logEntry.id,
      recipients: formattedRecipients,
      sender: payload.sender,
      message: payload.message,
      apiResponse,
      error: errorMessage
    };
  }

  /**
   * Send OnTime Arrival SMS notification after QR Code scan
   */
  async sendOnTimeArrivalSMS({ user, arrivalEvaluation, location = 'Main Checkpoint', scanId }) {
    const recipients = [];

    // Send to guardian if available
    if (user.guardianPhone) {
      recipients.push(user.guardianPhone);
    }
    // Also send to student/worker phone if provided
    if (user.phone && !recipients.includes(user.phone)) {
      recipients.push(user.phone);
    }

    if (recipients.length === 0) {
      console.warn(`[Arkesel SMS] No phone numbers found for user ${user.name}`);
      return { success: false, message: 'No phone numbers registered for user' };
    }

    const isOnTime = arrivalEvaluation.status === 'ON_TIME';
    const statusLabel = isOnTime ? 'ON TIME' : 'LATE';

    // Tailored SMS format for OnTime Arrival
    let smsBody = '';
    if (isOnTime) {
      smsBody = `SeevPlus OnTime: Hello, ${user.name} has arrived at ${location} ON TIME at ${arrivalEvaluation.scannedTime} (${arrivalEvaluation.scannedDate}). Safe arrival confirmed!`;
    } else {
      smsBody = `SeevPlus Notice: ${user.name} arrived at ${location} at ${arrivalEvaluation.scannedTime} (${arrivalEvaluation.scannedDate}). Status: Late by ~${arrivalEvaluation.minutesDiff} mins. Expected: ${arrivalEvaluation.expectedTime}.`;
    }

    return await this.sendSMS(recipients, smsBody, {
      type: 'ONTIME_ARRIVAL_SCAN',
      scanId,
      userId: user.id,
      arrivalStatus: statusLabel,
      location
    });
  }

  /**
   * Check Arkesel Account Balance
   */
  async getBalance() {
    if (!this.apiKey || this.apiKey.startsWith('test_')) {
      return {
        success: true,
        mode: 'mock',
        smsBalance: 9999,
        currency: 'GHS',
        message: 'Mock balance for testing'
      };
    }

    try {
      const response = await axios.get(this.balanceUrl, {
        headers: { 'api-key': this.apiKey },
        timeout: 5000
      });
      return {
        success: true,
        mode: 'live',
        data: response.data
      };
    } catch (err) {
      return {
        success: false,
        error: err.response ? err.response.data : err.message
      };
    }
  }

  /**
   * Get recent SMS logs
   */
  getLogs(limit = 50) {
    const all = db.getAll('smsLogs');
    return all.slice(-limit).reverse();
  }
}

module.exports = new ArkeselService();

const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../database');
const qrService = require('./qrService');
const paymentService = require('./paymentService');
const arkeselService = require('./arkeselService');
const { evaluateArrivalTime } = require('../utils/timeHelper');

class ScanService {
  /**
   * Process a QR code scan event at a checkpoint
   * @param {object} params
   * @param {string} params.token - The scanned QR code token or raw user ID
   * @param {string} [params.location='Main Campus Entrance'] - Location of scanner
   * @param {string|Date} [params.scannedAt] - Optional override for time simulation
   * @param {boolean} [params.sendNotification=true] - Whether to trigger Arkesel SMS
   */
  async processScan({ token, location = 'Main Checkpoint', scannedAt = new Date(), sendNotification = true }) {
    const scanTimestamp = scannedAt ? new Date(scannedAt) : new Date();

    // 1. Verify QR Token
    const verification = qrService.verifyToken(token);
    if (!verification.valid) {
      return {
        success: false,
        error: 'INVALID_QR_CODE',
        message: verification.reason || 'The scanned QR code is invalid or has expired'
      };
    }

    const userId = verification.userId;
    const user = db.findOne('users', u => u.id === userId);
    if (!user) {
      return {
        success: false,
        error: 'USER_NOT_FOUND',
        message: `Registered user account for ID ${userId} could not be found`
      };
    }

    // 2. Validate SeevPlus Subscription Status
    const activeSub = paymentService.getActiveSubscription(userId);
    if (!activeSub) {
      // Record scan as rejected due to no active subscription
      const rejectedScan = db.insert('scans', {
        id: uuidv4(),
        userId: user.id,
        userName: user.name,
        location,
        scannedAt: scanTimestamp.toISOString(),
        status: 'REJECTED_NO_SUBSCRIPTION',
        smsSent: false,
        notes: 'User does not have an active SeevPlus OnTime Arrival subscription'
      });

      return {
        success: false,
        error: 'SUBSCRIPTION_INACTIVE',
        message: 'No active OnTime Arrival subscription found. Please subscribe to the 50 GHS monthly or 588 GHS yearly plan to enable arrival check-in and SMS alerts.',
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone
        },
        scanId: rejectedScan.id
      };
    }

    // 3. Evaluate Arrival Time against Expected Time
    const expectedTime = user.expectedArrivalTime || config.ontime.defaultExpectedArrivalTime;
    const graceMinutes = config.ontime.gracePeriodMinutes;
    const arrivalEval = evaluateArrivalTime(expectedTime, scanTimestamp, graceMinutes);

    const scanId = uuidv4();

    // 4. Send Arkesel SMS Notification
    let smsResult = null;
    if (sendNotification) {
      try {
        smsResult = await arkeselService.sendOnTimeArrivalSMS({
          user,
          arrivalEvaluation: arrivalEval,
          location,
          scanId
        });
      } catch (err) {
        console.error('[ScanService] SMS dispatch failed:', err.message);
        smsResult = { success: false, error: err.message };
      }
    }

    // 5. Record scan log in database
    const scanRecord = db.insert('scans', {
      id: scanId,
      userId: user.id,
      userName: user.name,
      userPhone: user.phone,
      guardianPhone: user.guardianPhone,
      subscriptionId: activeSub.id,
      location,
      scannedAt: scanTimestamp.toISOString(),
      expectedTime,
      arrivalStatus: arrivalEval.status, // ON_TIME or LATE
      minutesDiff: arrivalEval.minutesDiff,
      smsSent: smsResult ? smsResult.success : false,
      smsDetails: smsResult,
      isLegacyOrDirectId: !!verification.isLegacyOrDirectId
    });

    return {
      success: true,
      scanId: scanRecord.id,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        guardianPhone: user.guardianPhone,
        institution: user.institution || 'Main Office / School'
      },
      evaluation: {
        arrivalStatus: arrivalEval.status,
        scannedTime: arrivalEval.scannedTime,
        scannedDate: arrivalEval.scannedDate,
        expectedTime: arrivalEval.expectedTime,
        minutesDiff: arrivalEval.minutesDiff,
        isLate: arrivalEval.status === 'LATE'
      },
      subscription: {
        plan: activeSub.planName,
        planType: activeSub.planType,
        validUntil: activeSub.endDate
      },
      smsNotification: smsResult,
      location
    };
  }

  /**
   * Get all scan records, optionally filtered by user or date
   */
  getScanLogs({ userId, limit = 50 } = {}) {
    let scans = db.getAll('scans');
    if (userId) {
      scans = scans.filter(s => s.userId === userId);
    }
    return scans.slice(-limit).reverse();
  }
}

module.exports = new ScanService();

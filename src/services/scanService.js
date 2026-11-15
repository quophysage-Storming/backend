const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../database');
const qrService = require('./qrService');
const paymentService = require('./paymentService');
const arkeselService = require('./arkeselService');
const { formatGhanaPhoneNumber } = require('../utils/phoneFormatter');
const { evaluateArrivalTime } = require('../utils/timeHelper');

class ScanService {
  /**
   * Process a QR code scan event at a checkpoint
   * Handles:
   * 1. Android App's QR format: { kid, phone, school }
   * 2. Device location coordinates (latitude, longitude) & checkpoint name
   * 3. Exact scan timestamp
   * 4. SeevPlus subscription check (50 GHC / 588 GHC)
   * 5. On-time / Late evaluation
   * 6. Arkesel SMS notification to parent's phone number
   */
  async processScan({
    token,
    qrData,
    location,
    latitude,
    longitude,
    scannedAt = new Date(),
    sendNotification = true,
    scannerDevice = 'Android Checkpoint App'
  }) {
    const scanTimestamp = scannedAt ? new Date(scannedAt) : new Date();
    const rawQrInput = token || qrData;

    // 1. Verify / Parse QR Token or App QR Metadata
    const verification = qrService.verifyToken(rawQrInput);
    if (!verification.valid) {
      return {
        success: false,
        error: 'INVALID_QR_CODE',
        message: verification.reason || 'The scanned QR code is invalid or corrupt'
      };
    }

    let user = null;

    // A) Scanned from the On_Time_Arrival Android App: { kid, phone, school }
    if (verification.isAppQR) {
      const kidName = verification.kid.trim();
      const parentPhone = formatGhanaPhoneNumber(verification.phone);
      const schoolName = verification.school.trim();

      // Look up existing user
      user = db.findOne('users', u =>
        (u.guardianPhone === parentPhone || u.phone === parentPhone) &&
        u.name.toLowerCase() === kidName.toLowerCase()
      );

      // If not registered yet, auto-register the student & parent profile
      if (!user) {
        user = db.insert('users', {
          id: `USR-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
          name: kidName,
          phone: parentPhone,
          guardianPhone: parentPhone,
          institution: schoolName,
          expectedArrivalTime: config.ontime.defaultExpectedArrivalTime,
          role: 'student',
          source: 'android_app_qr'
        });
      }
    } else {
      // B) Scanned from standard signed QR pass
      const userId = verification.userId;
      user = db.findOne('users', u => u.id === userId);
      if (!user) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: `Registered user account for ID ${userId} could not be found`
        };
      }
    }

    // 2. Resolve Geolocation Information
    let geoLat = latitude || (location && location.latitude ? location.latitude : null);
    let geoLng = longitude || (location && location.longitude ? location.longitude : null);
    let checkpointName = typeof location === 'string' ? location : (location?.name || user.institution || 'Main Gate Checkpoint');

    let resolvedLocationString = checkpointName;
    if (geoLat && geoLng) {
      const latFixed = Number(geoLat).toFixed(4);
      const lngFixed = Number(geoLng).toFixed(4);
      resolvedLocationString = `${checkpointName} (GPS: ${latFixed}, ${lngFixed})`;
    }

    // 3. Validate SeevPlus Subscription Status (50 GHC / 588 GHC)
    const activeSub = paymentService.getActiveSubscription(user.id) ||
                      paymentService.getActiveSubscription(user.guardianPhone);

    if (!activeSub) {
      const rejectedScan = db.insert('scans', {
        id: uuidv4(),
        userId: user.id,
        userName: user.name,
        guardianPhone: user.guardianPhone,
        institution: user.institution,
        location: resolvedLocationString,
        coordinates: geoLat && geoLng ? { latitude: geoLat, longitude: geoLng } : null,
        scannedAt: scanTimestamp.toISOString(),
        status: 'REJECTED_NO_SUBSCRIPTION',
        smsSent: false,
        scannerDevice,
        notes: 'User does not have an active SeevPlus OnTime Arrival subscription'
      });

      return {
        success: false,
        error: 'SUBSCRIPTION_INACTIVE',
        message: `No active OnTime Arrival subscription found for ${user.name}. Please activate the 50 GHC Monthly or 588 GHC Yearly plan to receive arrival alerts.`,
        user: {
          id: user.id,
          name: user.name,
          guardianPhone: user.guardianPhone,
          school: user.institution
        },
        scanId: rejectedScan.id
      };
    }

    // 4. Evaluate Arrival Time against Expected Cutoff
    const expectedTime = user.expectedArrivalTime || config.ontime.defaultExpectedArrivalTime;
    const graceMinutes = config.ontime.gracePeriodMinutes;
    const arrivalEval = evaluateArrivalTime(expectedTime, scanTimestamp, graceMinutes);

    const scanId = uuidv4();

    // 5. Build and Send Arkesel SMS Notification to Parent/Guardian Phone
    let smsResult = null;
    const recipientPhone = user.guardianPhone || user.phone;

    if (sendNotification && recipientPhone) {
      try {
        const isOnTime = arrivalEval.status === 'ON_TIME';
        let smsText = '';

        if (isOnTime) {
          smsText = `SeevPlus OnTime: Hello, ${user.name} has arrived at ${checkpointName} ON TIME at ${arrivalEval.scannedTime} (${arrivalEval.scannedDate}). Safe arrival confirmed!`;
        } else {
          smsText = `SeevPlus Notice: ${user.name} arrived at ${checkpointName} at ${arrivalEval.scannedTime} (${arrivalEval.scannedDate}). Status: Late by ~${arrivalEval.minutesDiff} mins. Expected: ${arrivalEval.expectedTime}.`;
        }

        smsResult = await arkeselService.sendSMS([recipientPhone], smsText, {
          type: 'ONTIME_ARRIVAL_SCAN',
          scanId,
          userId: user.id,
          kid: user.name,
          arrivalStatus: arrivalEval.status,
          location: resolvedLocationString,
          coordinates: geoLat && geoLng ? { latitude: geoLat, longitude: geoLng } : null
        });
      } catch (err) {
        console.error('[ScanService] SMS dispatch error:', err.message);
        smsResult = { success: false, error: err.message };
      }
    }

    // 6. Record Scan Audit Event
    const scanRecord = db.insert('scans', {
      id: scanId,
      userId: user.id,
      userName: user.name,
      userPhone: user.phone,
      guardianPhone: user.guardianPhone,
      subscriptionId: activeSub.id,
      institution: user.institution,
      location: resolvedLocationString,
      coordinates: geoLat && geoLng ? { latitude: geoLat, longitude: geoLng } : null,
      scannedAt: scanTimestamp.toISOString(),
      scannedTime: arrivalEval.scannedTime,
      scannedDate: arrivalEval.scannedDate,
      expectedTime,
      arrivalStatus: arrivalEval.status, // ON_TIME or LATE
      minutesDiff: arrivalEval.minutesDiff,
      smsSent: smsResult ? smsResult.success : false,
      smsDetails: smsResult,
      scannerDevice
    });

    return {
      success: true,
      scanId: scanRecord.id,
      user: {
        id: user.id,
        name: user.name,
        guardianPhone: user.guardianPhone,
        institution: user.institution
      },
      evaluation: {
        arrivalStatus: arrivalEval.status,
        scannedTime: arrivalEval.scannedTime,
        scannedDate: arrivalEval.scannedDate,
        expectedTime: arrivalEval.expectedTime,
        minutesDiff: arrivalEval.minutesDiff,
        isLate: arrivalEval.status === 'LATE'
      },
      location: {
        displayName: resolvedLocationString,
        checkpoint: checkpointName,
        coordinates: geoLat && geoLng ? { latitude: geoLat, longitude: geoLng } : null
      },
      subscription: {
        plan: activeSub.planName,
        planType: activeSub.planType,
        validUntil: activeSub.endDate
      },
      smsNotification: smsResult
    };
  }

  /**
   * Get all scan records, optionally filtered by user or date
   */
  getScanLogs({ userId, guardianPhone, limit = 50 } = {}) {
    let scans = db.getAll('scans');
    if (userId) {
      scans = scans.filter(s => s.userId === userId);
    }
    if (guardianPhone) {
      const clean = formatGhanaPhoneNumber(guardianPhone);
      scans = scans.filter(s => s.guardianPhone === clean);
    }
    return scans.slice(-limit).reverse();
  }
}

module.exports = new ScanService();

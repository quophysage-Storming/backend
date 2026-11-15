const assert = require('assert');
const config = require('../src/config');
const db = require('../src/database');
const paymentService = require('../src/services/paymentService');
const qrService = require('../src/services/qrService');
const arkeselService = require('../src/services/arkeselService');
const scanService = require('../src/services/scanService');
const { formatGhanaPhoneNumber } = require('../src/utils/phoneFormatter');
const { evaluateArrivalTime } = require('../src/utils/timeHelper');

async function runTests() {
  console.log('🧪 Starting SeevPlus OnTime Arrival & Arkesel SMS Backend Tests...\n');

  // Test 1: Verify Subscription Plans and Pricing
  console.log('Test 1: Verifying SeevPlus Subscription Plans...');
  const plans = paymentService.getPlans();
  assert.strictEqual(plans.length, 2, 'Should have exactly 2 plans (monthly & yearly)');

  const monthlyPlan = paymentService.getPlan('monthly');
  assert.strictEqual(monthlyPlan.amount, 50.00, 'Monthly plan amount should be 50 GHS');
  assert.strictEqual(monthlyPlan.currency, 'GHS');
  assert.strictEqual(monthlyPlan.durationDays, 30);

  const yearlyPlan = paymentService.getPlan('yearly');
  assert.strictEqual(yearlyPlan.amount, 588.00, 'Yearly plan amount should be 588 GHS');
  assert.strictEqual(yearlyPlan.currency, 'GHS');
  assert.strictEqual(yearlyPlan.durationDays, 365);
  console.log('✅ Plan verification passed: Monthly = 50 GHS, Yearly = 588 GHS');

  // Test 2: Phone Number Normalization
  console.log('\nTest 2: Verifying Ghana Phone Number formatting...');
  assert.strictEqual(formatGhanaPhoneNumber('0244123456'), '233244123456');
  assert.strictEqual(formatGhanaPhoneNumber('+233501234567'), '233501234567');
  assert.strictEqual(formatGhanaPhoneNumber('244123456'), '233244123456');
  console.log('✅ Phone formatting passed');

  // Test 3: Android App QR Format Parsing (from DashActivity.java)
  console.log('\nTest 3: Testing Android App QR code parser...');
  const appQrJson = JSON.stringify({
    kid: 'Esi Mensah',
    phone: '+233 24 998 8776',
    school: 'Accra Academy'
  });

  const parsedQr = qrService.verifyToken(appQrJson);
  assert.strictEqual(parsedQr.valid, true);
  assert.strictEqual(parsedQr.isAppQR, true);
  assert.strictEqual(parsedQr.kid, 'Esi Mensah');
  assert.strictEqual(parsedQr.phone, '+233 24 998 8776');
  assert.strictEqual(parsedQr.school, 'Accra Academy');
  console.log('✅ Android App QR structure successfully parsed');

  // Test 4: Check scan blocked before subscription
  console.log('\nTest 4: Verifying unpaid app scan is rejected...');
  const unpaidScan = await scanService.processScan({
    qrData: appQrJson,
    location: 'Main School Gate',
    latitude: 5.5560,
    longitude: -0.1969
  });
  assert.strictEqual(unpaidScan.success, false);
  assert.strictEqual(unpaidScan.error, 'SUBSCRIPTION_INACTIVE');
  console.log('✅ Unpaid scan blocked properly with subscription notice');

  // Test 5: Activate SeevPlus Subscription using Phone Number (App Flow)
  console.log('\nTest 5: Activating SeevPlus Monthly Subscription (50 GHS) by phone...');
  const initPayment = paymentService.initializePayment({
    phone: '+233 24 998 8776',
    kid: 'Esi Mensah',
    school: 'Accra Academy',
    planType: 'monthly',
    paymentMethod: 'MOMO',
    momoNetwork: 'MTN'
  });
  assert.strictEqual(initPayment.success, true);
  assert.strictEqual(initPayment.payment.amount, 50.00);

  const confirmPayment = paymentService.processPayment({
    reference: initPayment.payment.reference,
    status: 'SUCCESS'
  });
  assert.strictEqual(confirmPayment.success, true);

  const subStatus = paymentService.checkUserSubscriptionStatus('+233 24 998 8776');
  assert.strictEqual(subStatus.hasActiveSubscription, true);
  assert.strictEqual(subStatus.daysRemaining, 30);
  console.log('✅ Subscription activated: 50 GHS valid for 30 days');

  // Test 6: Process App Scan with Location & Exact Time - ON TIME
  console.log('\nTest 6: Testing ON-TIME app QR scan with GPS location & Arkesel SMS...');
  const onTimeDate = new Date();
  onTimeDate.setHours(7, 45, 0, 0); // 07:45 AM (Cutoff: 08:00 AM)

  const onTimeResult = await scanService.processScan({
    qrData: appQrJson,
    location: {
      name: 'Accra Academy North Gate',
      latitude: 5.5560,
      longitude: -0.1969
    },
    scannedAt: onTimeDate,
    sendNotification: true
  });

  assert.strictEqual(onTimeResult.success, true);
  assert.strictEqual(onTimeResult.evaluation.arrivalStatus, 'ON_TIME');
  assert.strictEqual(onTimeResult.evaluation.isLate, false);
  assert.strictEqual(onTimeResult.smsNotification.success, true);
  assert.ok(onTimeResult.smsNotification.message.includes('ON TIME'));
  assert.ok(onTimeResult.smsNotification.recipients.includes('233249988776'));
  console.log(`✅ On-time scan succeeded: ${onTimeResult.evaluation.scannedTime} at ${onTimeResult.location.displayName}`);
  console.log(`   SMS sent to parent: "${onTimeResult.smsNotification.message}"`);

  // Test 7: Process App Scan with Location & Exact Time - LATE
  console.log('\nTest 7: Testing LATE app QR scan with GPS location & Arkesel SMS...');
  const lateDate = new Date();
  lateDate.setHours(8, 25, 0, 0); // 08:25 AM (Cutoff: 08:00 + 10 min grace -> Late by 25 mins)

  const lateResult = await scanService.processScan({
    qrData: appQrJson,
    location: 'Accra Academy North Gate',
    latitude: 5.5560,
    longitude: -0.1969,
    scannedAt: lateDate,
    sendNotification: true
  });

  assert.strictEqual(lateResult.success, true);
  assert.strictEqual(lateResult.evaluation.arrivalStatus, 'LATE');
  assert.strictEqual(lateResult.evaluation.isLate, true);
  assert.strictEqual(lateResult.smsNotification.success, true);
  assert.ok(lateResult.smsNotification.message.includes('Late'));
  console.log(`✅ Late scan evaluated: ${lateResult.evaluation.scannedTime} (Late by ${lateResult.evaluation.minutesDiff} mins)`);
  console.log(`   SMS sent to parent: "${lateResult.smsNotification.message}"`);

  // Test 8: Yearly Plan Verification (588 GHS)
  console.log('\nTest 8: Testing 1-Year SeevPlus Plan (588 GHS)...');
  const yearlyInit = paymentService.initializePayment({
    phone: '0501234567',
    kid: 'Kwaku Mensah',
    school: 'Prempeh College',
    planType: 'yearly'
  });
  assert.strictEqual(yearlyInit.payment.amount, 588.00);
  assert.strictEqual(yearlyInit.payment.durationDays, 365);
  console.log('✅ Yearly plan initialization verified (588 GHS)');

  // Test 9: Verify Scan Logs by Guardian Phone
  console.log('\nTest 9: Verifying Scan History Audit Trail...');
  const logs = scanService.getScanLogs({ guardianPhone: '0249988776' });
  assert.ok(logs.length >= 2, 'Should have logged at least 2 scans for this parent');
  console.log(`✅ Audit trail verified (${logs.length} scan logs retrieved)`);

  console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🚀');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});

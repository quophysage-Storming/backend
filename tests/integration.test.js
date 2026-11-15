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

  // Test 3: User Setup
  console.log('\nTest 3: Creating Test User...');
  const testUser = db.insert('users', {
    id: `USR-TEST-${Date.now()}`,
    name: 'Kofi Mensah',
    phone: formatGhanaPhoneNumber('0244998877'),
    guardianPhone: formatGhanaPhoneNumber('0501122334'),
    expectedArrivalTime: '08:00',
    institution: 'University of Ghana'
  });
  assert.ok(testUser.id);
  console.log(`✅ User created: ${testUser.name} (${testUser.id})`);

  // Test 4: Check scan rejection without subscription
  console.log('\nTest 4: Testing QR scan without active subscription...');
  const userToken = qrService.generateToken(testUser.id);
  const unpaidScan = await scanService.processScan({
    token: userToken,
    location: 'Main Gate'
  });
  assert.strictEqual(unpaidScan.success, false);
  assert.strictEqual(unpaidScan.error, 'SUBSCRIPTION_INACTIVE');
  console.log('✅ Scan correctly blocked when user has no active subscription');

  // Test 5: Initialize & Confirm SeevPlus Payment (Monthly: 50 GHS)
  console.log('\nTest 5: Initializing & Confirming SeevPlus Monthly Payment (50 GHS)...');
  const paymentInit = paymentService.initializePayment({
    userId: testUser.id,
    planType: 'monthly',
    paymentMethod: 'MOMO',
    momoNetwork: 'MTN'
  });
  assert.strictEqual(paymentInit.success, true);
  assert.strictEqual(paymentInit.payment.amount, 50.00);

  const paymentConfirm = paymentService.processPayment({
    reference: paymentInit.payment.reference,
    status: 'SUCCESS'
  });
  assert.strictEqual(paymentConfirm.success, true);
  assert.strictEqual(paymentConfirm.subscription.amount, '50 GHS');

  const subStatus = paymentService.checkUserSubscriptionStatus(testUser.id);
  assert.strictEqual(subStatus.hasActiveSubscription, true);
  assert.strictEqual(subStatus.daysRemaining, 30);
  console.log(`✅ SeevPlus subscription activated for 30 days`);

  // Test 6: QR Code Token Generation & Cryptographic Verification
  console.log('\nTest 6: Testing QR Token Generation & Verification...');
  const qrPass = await qrService.generateUserPass(testUser.id);
  assert.ok(qrPass.token);
  assert.ok(qrPass.qrDataUrl.startsWith('data:image/png;base64,'));

  const tokenVerification = qrService.verifyToken(qrPass.token);
  assert.strictEqual(tokenVerification.valid, true);
  assert.strictEqual(tokenVerification.userId, testUser.id);

  // Test invalid token
  const tampered = qrService.verifyToken('invalid:token:12345');
  assert.strictEqual(tampered.valid, false);
  console.log('✅ QR cryptographic token verification passed');

  // Test 7: Scan Evaluation - ON TIME Arrival & Arkesel SMS Trigger
  console.log('\nTest 7: Testing ON TIME Arrival Scan & Arkesel SMS...');
  const onTimeDate = new Date();
  onTimeDate.setHours(7, 50, 0, 0); // 07:50 AM (expected: 08:00 AM)

  const onTimeScan = await scanService.processScan({
    token: qrPass.token,
    location: 'Campus Main Entrance',
    scannedAt: onTimeDate,
    sendNotification: true
  });

  assert.strictEqual(onTimeScan.success, true);
  assert.strictEqual(onTimeScan.evaluation.arrivalStatus, 'ON_TIME');
  assert.strictEqual(onTimeScan.smsNotification.success, true);
  assert.ok(onTimeScan.smsNotification.message.includes('ON TIME'));
  console.log(`✅ On-time scan evaluated: ${onTimeScan.evaluation.scannedTime} - SMS dispatched`);

  // Test 8: Scan Evaluation - LATE Arrival & Arkesel SMS Trigger
  console.log('\nTest 8: Testing LATE Arrival Scan & Arkesel SMS...');
  const lateDate = new Date();
  lateDate.setHours(8, 30, 0, 0); // 08:30 AM (expected 08:00 + 10 min grace -> late)

  const lateScan = await scanService.processScan({
    token: qrPass.token,
    location: 'Campus Main Entrance',
    scannedAt: lateDate,
    sendNotification: true
  });

  assert.strictEqual(lateScan.success, true);
  assert.strictEqual(lateScan.evaluation.arrivalStatus, 'LATE');
  assert.strictEqual(lateScan.smsNotification.success, true);
  assert.ok(lateScan.smsNotification.message.includes('Late'));
  console.log(`✅ Late scan evaluated: ${lateScan.evaluation.scannedTime} (Late by ${lateScan.evaluation.minutesDiff} mins) - SMS dispatched`);

  // Test 9: Verify Arkesel SMS Logs & Balance
  console.log('\nTest 9: Testing Arkesel Balance & Delivery Logs...');
  const balance = await arkeselService.getBalance();
  assert.strictEqual(balance.success, true);

  const logs = arkeselService.getLogs(5);
  assert.ok(logs.length >= 2, 'Should have logged at least 2 SMS messages');
  console.log(`✅ SMS logs verified (${logs.length} messages in audit log)`);

  console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🚀');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});

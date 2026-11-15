/**
 * Time calculation helper for OnTime Arrival verification
 */

/**
 * Check if the scan is ON_TIME or LATE
 * @param {string} expectedTimeStr e.g. "08:00" in 24-hr format
 * @param {Date|string} [scannedAt=new Date()]
 * @param {number} [gracePeriodMinutes=10]
 * @returns {object} { status: 'ON_TIME' | 'LATE', scannedTimeStr, expectedTimeStr, minutesDiff }
 */
function evaluateArrivalTime(expectedTimeStr = '08:00', scannedAt = new Date(), gracePeriodMinutes = 10) {
  const scanDate = scannedAt instanceof Date ? scannedAt : new Date(scannedAt);

  // Parse expected time "HH:mm"
  const [expHours, expMinutes] = expectedTimeStr.split(':').map(n => parseInt(n, 10));

  // Build cutoff date on the same day as scan
  const cutoffDate = new Date(scanDate);
  cutoffDate.setHours(expHours, expMinutes + gracePeriodMinutes, 0, 0);

  const exactExpectedDate = new Date(scanDate);
  exactExpectedDate.setHours(expHours, expMinutes, 0, 0);

  const diffMs = scanDate.getTime() - exactExpectedDate.getTime();
  const minutesDiff = Math.round(diffMs / 60000);

  const isOnTime = scanDate.getTime() <= cutoffDate.getTime();

  // Format readable time e.g. "07:55 AM"
  const scannedTimeStr = scanDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const formattedDateStr = scanDate.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return {
    status: isOnTime ? 'ON_TIME' : 'LATE',
    scannedTime: scannedTimeStr,
    scannedDate: formattedDateStr,
    expectedTime: expectedTimeStr,
    gracePeriodMinutes,
    minutesDiff, // negative if early, positive if late
    scannedAtIso: scanDate.toISOString()
  };
}

module.exports = {
  evaluateArrivalTime
};

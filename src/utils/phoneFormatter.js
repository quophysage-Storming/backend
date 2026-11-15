/**
 * Ghana Phone Number Normalizer & Network Detector for SeevPlus & Arkesel
 */

function formatGhanaPhoneNumber(phone) {
  if (!phone) return null;

  // Remove spaces, dashes, parentheses
  let cleaned = String(phone).trim().replace(/[\s\-\(\)]/g, '');

  // Remove leading '+'
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // If starts with 0 and has 10 digits (e.g. 0244123456)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '233' + cleaned.substring(1);
  }

  // If 9 digits (e.g. 244123456 without 0 or 233)
  if (cleaned.length === 9) {
    cleaned = '233' + cleaned;
  }

  // Ensure it matches 233 + 9 digits (12 digits total)
  if (/^233[0-9]{9}$/.test(cleaned)) {
    return cleaned;
  }

  // Return cleaned version if standard
  return cleaned;
}

function detectNetwork(phone) {
  const formatted = formatGhanaPhoneNumber(phone);
  if (!formatted || formatted.length < 5) return 'UNKNOWN';

  // 233 followed by prefix
  const prefix = formatted.substring(3, 5); // e.g. 24, 54, 55, 59, 20, 50, 27, 57, 26, 56

  if (['24', '54', '55', '59', '25'].includes(prefix)) {
    return 'MTN';
  }
  if (['20', '50'].includes(prefix)) {
    return 'TELECEL';
  }
  if (['27', '57', '26', '56'].includes(prefix)) {
    return 'AT_MONEY';
  }

  return 'OTHER';
}

module.exports = {
  formatGhanaPhoneNumber,
  detectNetwork
};

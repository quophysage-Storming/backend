/**
 * SeevPlus Configuration
 * Dedicated native payment & Arkesel SMS configuration for OnTime Arrival
 */

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // SeevPlus Payment Configuration (Native MoMo & Card Gateway)
  seevplus: {
    merchantName: process.env.SEEVPLUS_MERCHANT_NAME || 'SeevPlus OnTime Arrival',
    merchantId: process.env.SEEVPLUS_MERCHANT_ID || 'SEEVPLUS_GH_001',
    apiKey: process.env.SEEVPLUS_API_KEY || 'seevplus_live_key_gh',
    secretKey: process.env.SEEVPLUS_SECRET_KEY || 'seevplus_secret_token_secure',
    currency: 'GHS',
    // Mobile Money Supported Networks in Ghana
    supportedNetworks: ['MTN', 'TELECEL', 'AT_MONEY'],
    // Subscription Plans specified by user:
    // Monthly: 50 GHS
    // Yearly: 588 GHS
    plans: {
      monthly: {
        id: 'plan_monthly_50',
        name: 'OnTime Arrival Monthly Subscription',
        billingCycle: 'monthly',
        amount: 50.00,
        currency: 'GHS',
        durationDays: 30,
        description: '30-day access to OnTime Arrival QR scanning and instant guardian SMS alerts'
      },
      yearly: {
        id: 'plan_yearly_588',
        name: 'OnTime Arrival Yearly Subscription',
        billingCycle: 'yearly',
        amount: 588.00,
        currency: 'GHS',
        durationDays: 365,
        discountNotice: 'Save 12 GHS compared to 12 monthly payments',
        description: 'Full 1-year access to OnTime Arrival QR scanning and instant guardian SMS alerts'
      }
    }
  },

  // Arkesel SMS API Configuration (v2)
  arkesel: {
    apiKey: process.env.ARKESEL_API_KEY || 'test_arkesel_api_key',
    senderId: process.env.ARKESEL_SENDER_ID || 'SeevPlus',
    smsUrl: process.env.ARKESEL_SMS_URL || 'https://sms.arkesel.com/api/v2/sms/send',
    balanceUrl: process.env.ARKESEL_BALANCE_URL || 'https://sms.arkesel.com/api/v2/clients/balance-details'
  },

  // OnTime Arrival QR & Timing Parameters
  ontime: {
    qrSecret: process.env.QR_SECRET || 'seevplus_secure_qr_hash_secret_2026',
    defaultExpectedArrivalTime: process.env.DEFAULT_ARRIVAL_TIME || '08:00', // HH:mm (24h)
    gracePeriodMinutes: parseInt(process.env.GRACE_PERIOD_MINUTES || '10', 10) // 10 mins grace
  },

  // Database path
  storage: {
    dbFilePath: process.env.DB_FILE_PATH || './data/seevplus_db.json'
  }
};

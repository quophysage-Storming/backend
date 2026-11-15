const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../database');
const { formatGhanaPhoneNumber, detectNetwork } = require('../utils/phoneFormatter');

class PaymentService {
  /**
   * Get all active SeevPlus subscription plans
   */
  getPlans() {
    return Object.values(config.seevplus.plans);
  }

  /**
   * Get a specific plan by key/ID
   */
  getPlan(planType) {
    const key = (planType || '').toLowerCase();
    if (key === 'monthly' || key === 'plan_monthly_50') {
      return config.seevplus.plans.monthly;
    }
    if (key === 'yearly' || key === 'annual' || key === 'plan_yearly_588') {
      return config.seevplus.plans.yearly;
    }
    return null;
  }

  /**
   * Initialize a SeevPlus payment for OnTime Arrival subscription
   */
  initializePayment({ userId, planType, paymentMethod = 'MOMO', momoNumber, momoNetwork }) {
    const user = db.findOne('users', u => u.id === userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const plan = this.getPlan(planType);
    if (!plan) {
      throw new Error('Invalid plan selected. Choose "monthly" (50 GHS) or "yearly" (588 GHS)');
    }

    const targetPhone = momoNumber || user.phone;
    const formattedPhone = formatGhanaPhoneNumber(targetPhone);
    const network = momoNetwork || detectNetwork(formattedPhone);

    const reference = `SEEV-${plan.billingCycle.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const paymentRecord = db.insert('payments', {
      id: uuidv4(),
      reference,
      userId,
      userPhone: formattedPhone,
      userName: user.name,
      planId: plan.id,
      planType: plan.billingCycle,
      planName: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      paymentMethod,
      network,
      status: 'PENDING', // PENDING -> SUCCESS / FAILED
      merchantId: config.seevplus.merchantId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 mins expiry
    });

    return {
      success: true,
      message: `SeevPlus payment initialized for ${plan.name} (${plan.amount} ${plan.currency})`,
      payment: {
        reference,
        amount: plan.amount,
        currency: plan.currency,
        plan: plan.name,
        durationDays: plan.durationDays,
        network,
        phoneNumber: formattedPhone,
        status: 'PENDING',
        ussdPromptInstruction: `A Mobile Money prompt of ${plan.amount} GHS will be sent to ${formattedPhone} (${network}). Approve with your MoMo PIN.`
      }
    };
  }

  /**
   * Process and finalize SeevPlus payment (direct MoMo / Webhook / instant verification)
   */
  processPayment({ reference, status = 'SUCCESS', reason = '' }) {
    const payment = db.findOne('payments', p => p.reference === reference);
    if (!payment) {
      throw new Error(`Payment with reference ${reference} not found`);
    }

    if (payment.status === 'SUCCESS') {
      return {
        success: true,
        message: 'Payment already processed and active',
        payment
      };
    }

    if (status !== 'SUCCESS') {
      db.update('payments', p => p.reference === reference, {
        status: 'FAILED',
        failureReason: reason || 'Transaction declined by provider',
        processedAt: new Date().toISOString()
      });
      return {
        success: false,
        message: 'Payment was not successful',
        reference
      };
    }

    // Mark payment as SUCCESS
    const updatedPayment = db.update('payments', p => p.reference === reference, {
      status: 'SUCCESS',
      paidAt: new Date().toISOString(),
      processedAt: new Date().toISOString()
    });

    // Activate or extend subscription
    const plan = this.getPlan(payment.planType);
    const existingActiveSub = this.getActiveSubscription(payment.userId);

    const now = new Date();
    let startDate = now;

    // If already has active subscription, extend from the current endDate
    if (existingActiveSub && new Date(existingActiveSub.endDate) > now) {
      startDate = new Date(existingActiveSub.endDate);
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const subscription = db.insert('subscriptions', {
      id: uuidv4(),
      userId: payment.userId,
      userPhone: payment.userPhone,
      userName: payment.userName,
      paymentReference: payment.reference,
      planId: plan.id,
      planType: plan.billingCycle,
      planName: plan.name,
      amountPaid: plan.amount,
      currency: plan.currency,
      durationDays: plan.durationDays,
      status: 'ACTIVE',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      autoRenew: false
    });

    return {
      success: true,
      message: `SeevPlus subscription activated successfully! Valid until ${endDate.toDateString()}`,
      payment: updatedPayment,
      subscription: {
        id: subscription.id,
        plan: plan.name,
        amount: `${plan.amount} ${plan.currency}`,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        status: subscription.status
      }
    };
  }

  /**
   * Get active subscription for a user
   */
  getActiveSubscription(userId) {
    const now = new Date();
    const subs = db.find('subscriptions', s => s.userId === userId && s.status === 'ACTIVE');
    if (!subs || subs.length === 0) return null;

    // Check expiry
    for (const sub of subs) {
      if (new Date(sub.endDate) > now) {
        return sub;
      } else {
        // Expired
        db.update('subscriptions', s => s.id === sub.id, { status: 'EXPIRED' });
      }
    }

    return null;
  }

  /**
   * Check user subscription status
   */
  checkUserSubscriptionStatus(userId) {
    const sub = this.getActiveSubscription(userId);
    if (!sub) {
      return {
        hasActiveSubscription: false,
        message: 'No active OnTime Arrival subscription found. Subscribe to Monthly (50 GHC) or Yearly (588 GHC).',
        subscription: null
      };
    }

    const now = new Date();
    const diffMs = new Date(sub.endDate).getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    return {
      hasActiveSubscription: true,
      daysRemaining,
      subscription: {
        id: sub.id,
        planType: sub.planType,
        planName: sub.planName,
        amountPaid: sub.amountPaid,
        currency: sub.currency,
        startDate: sub.startDate,
        endDate: sub.endDate,
        status: sub.status
      }
    };
  }
}

module.exports = new PaymentService();

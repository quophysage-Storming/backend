const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { formatGhanaPhoneNumber } = require('../utils/phoneFormatter');
const paymentService = require('../services/paymentService');
const qrService = require('../services/qrService');

class UserController {
  /**
   * Register a new user (student/worker)
   */
  async createUser(req, res) {
    try {
      const {
        name,
        phone,
        guardianPhone,
        expectedArrivalTime = '08:00',
        institution = 'General School / Office',
        role = 'student' // 'student' | 'employee'
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const formattedUserPhone = formatGhanaPhoneNumber(phone);
      const formattedGuardianPhone = formatGhanaPhoneNumber(guardianPhone);

      const userId = `USR-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      const newUser = db.insert('users', {
        id: userId,
        name: name.trim(),
        phone: formattedUserPhone,
        guardianPhone: formattedGuardianPhone,
        expectedArrivalTime,
        institution,
        role
      });

      // Generate initial QR badge for the user
      const qrPass = await qrService.generateUserPass(newUser.id);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: newUser,
        qrPass
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * List all registered users
   */
  getUsers(req, res) {
    try {
      const users = db.getAll('users').map(user => {
        const subStatus = paymentService.checkUserSubscriptionStatus(user.id);
        return {
          ...user,
          subscription: subStatus
        };
      });
      res.json({ success: true, count: users.length, users });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get single user by ID
   */
  async getUserById(req, res) {
    try {
      const user = db.findOne('users', u => u.id === req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const subStatus = paymentService.checkUserSubscriptionStatus(user.id);
      const qrPass = await qrService.generateUserPass(user.id);

      res.json({
        success: true,
        user,
        subscription: subStatus,
        qrPass
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new UserController();

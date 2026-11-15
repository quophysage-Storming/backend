const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// POST /api/users - Register user
router.post('/', (req, res) => userController.createUser(req, res));

// GET /api/users - List users
router.get('/', (req, res) => userController.getUsers(req, res));

// GET /api/users/:id - Get user by ID (with QR badge and subscription status)
router.get('/:id', (req, res) => userController.getUserById(req, res));

module.exports = router;

const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scanController');

// POST /api/scans/process - Process a QR code scan
router.post('/process', (req, res) => scanController.processScan(req, res));

// GET /api/scans/pass/:userId - Retrieve user QR pass badge
router.get('/pass/:userId', (req, res) => scanController.getUserPass(req, res));

// GET /api/scans/logs - Retrieve scan logs
router.get('/logs', (req, res) => scanController.getScanLogs(req, res));

module.exports = router;

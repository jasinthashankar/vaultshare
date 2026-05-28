const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { getAnalyticsOverview, getAnalyticsLogs } = require('../controllers/fileController');

router.get('/overview', requireAuth, getAnalyticsOverview);
router.get('/logs', requireAuth, getAnalyticsLogs);

module.exports = router;

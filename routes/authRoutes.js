const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { registerUser, loginUser, requestPasswordReset, updatePassword } = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/reset-password-request', requestPasswordReset);
router.post('/update-password', requireAuth, updatePassword);

module.exports = router;

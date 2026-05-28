const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const upload = require('../middleware/upload');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  uploadFile,
  getFiles,
  revokeFile,
  restoreFile,
  deleteFile,
  getFileInfo,
  downloadFile
} = require('../controllers/fileController');

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many uploads, please try again later.' }
});

// Dashboard files route
router.get('/list', requireAuth, getFiles);

// Upload route
router.post('/upload', requireAuth, uploadLimiter, upload.single('file'), uploadFile);

// File management routes
router.post('/revoke/:token', requireAuth, revokeFile);
router.post('/restore/:token', requireAuth, restoreFile);
router.delete('/:token', requireAuth, deleteFile);

// Public access routes (can also be mounted on /f at server level)
router.get('/info/:token', getFileInfo);
router.post('/download/:token', downloadFile);

module.exports = router;

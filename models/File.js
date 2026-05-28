const mongoose = require('mongoose');

const accessLogSchema = new mongoose.Schema({
  ip: { type: String, required: true },
  deviceType: { type: String, required: true },
  reason: { type: String, enum: ['Study', 'Work', 'Personal'], required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const fileSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  originalname: {
    type: String,
    required: true
  },
  cloudinaryId: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  password: {
    type: String,
    default: null
  },
  selfDestruct: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: null
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  downloads: {
    type: Number,
    default: 0
  },
  accessLogs: [accessLogSchema]
}, { timestamps: true });

// TTL Index to automatically delete expired documents
// If expiresAt is set, MongoDB will delete the document when the time is reached
fileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('File', fileSchema);

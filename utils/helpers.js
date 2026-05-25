const { v4: uuidv4 } = require('uuid');

function generateToken() {
  return uuidv4().replace(/-/g, '').substring(0, 12);
}

function getDeviceType(userAgent = '') {
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|tablet/.test(ua)) {
    if (/tablet|ipad/.test(ua)) return 'tablet';
    return 'mobile';
  }
  return 'desktop';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    '0.0.0.0'
  );
}

function isExpired(record) {
  if (record.expiresAt && new Date() > new Date(record.expiresAt)) return true;
  if (record.maxDownloads && record.downloadCount >= record.maxDownloads) return true;
  return false;
}

module.exports = { generateToken, getDeviceType, formatBytes, getClientIp, isExpired };

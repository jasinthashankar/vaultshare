const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Block dangerous file types
  const blocked = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.dll', '.php', '.asp', '.aspx', '.jar'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (blocked.includes(ext)) {
    return cb(new Error('File type not allowed for security reasons'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
    files: 1
  }
});

module.exports = upload;

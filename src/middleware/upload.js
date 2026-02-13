const multer = require('multer');
const path = require('path');
const config = require('../config');

const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || getExtFromMime(file.mimetype);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, name);
  },
});

function getExtFromMime(mime) {
  const map = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/tiff': '.tiff',
  };
  return map[mime] || '';
}

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Allowed: PDF, JPEG, PNG, TIFF'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.UPLOAD_MAX_SIZE_MB * 1024 * 1024,
  },
});

module.exports = { upload, ALLOWED_MIMES };

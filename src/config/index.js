require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/seedscan-ocr',
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  JWT_SECRET: process.env.JWT_SECRET,
  API_KEY: process.env.API_KEY,
  UPLOAD_MAX_SIZE_MB: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '20', 10),
  VISION_TIMEOUT_MS: parseInt(process.env.VISION_TIMEOUT_MS || '60000', 10),
};

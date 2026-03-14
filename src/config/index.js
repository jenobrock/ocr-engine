require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/seedscan-ocr',
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  SENDER_EMAIL: process.env.SENDER_EMAIL || 'noreply@seed-connect.info',
  APP_URL: process.env.APP_URL || 'https://ocr.seed-connect.com',
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  JWT_SECRET: process.env.JWT_SECRET,
  API_KEY: process.env.API_KEY,
  UPLOAD_MAX_SIZE_MB: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '20', 10),
  VISION_TIMEOUT_MS: parseInt(process.env.VISION_TIMEOUT_MS || '60000', 10),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  AI_CLEANING_CONFIDENCE_THRESHOLD: parseFloat(process.env.AI_CLEANING_CONFIDENCE_THRESHOLD || '0.8', 10),
  AI_CLEANING_MAX_CHARS: parseInt(process.env.AI_CLEANING_MAX_CHARS || '12000', 10),
};

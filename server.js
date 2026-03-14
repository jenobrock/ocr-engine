require('dotenv').config();
const app = require('./src/app');
const { connectDB } = require('./src/config/database');

const PORT = process.env.PORT || 4000;

// Prevent silent crashes — log and keep running
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`OCR Engine running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });

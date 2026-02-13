const mongoose = require('mongoose');
const config = require('./index');

function connectDB() {
  return new Promise((resolve, reject) => {
    mongoose.connect(config.MONGODB_URI).then(resolve).catch(reject);
  });
}

mongoose.connection.on('open', () => {
  console.log('MongoDB connected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

module.exports = { connectDB };

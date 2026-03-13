const mongoose = require('mongoose');

const demoRequestSchema = new mongoose.Schema({
  name:    { type: String, trim: true },
  email:   { type: String, required: true, trim: true, lowercase: true },
  company: { type: String, trim: true },
  message: { type: String, trim: true },
  status:  { type: String, enum: ['pending', 'contacted', 'done'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('DemoRequest', demoRequestSchema);

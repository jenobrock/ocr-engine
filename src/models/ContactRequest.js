const mongoose = require('mongoose');

const contactRequestSchema = new mongoose.Schema({
  name:    { type: String, trim: true },
  email:   { type: String, required: true, trim: true, lowercase: true },
  subject: { type: String, trim: true },
  message: { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('ContactRequest', contactRequestSchema);

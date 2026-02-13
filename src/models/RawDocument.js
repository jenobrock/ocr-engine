const mongoose = require('mongoose');

const rawDocumentSchema = new mongoose.Schema(
  {
    sourceOcrId: { type: mongoose.Schema.Types.ObjectId, ref: 'OcrDocument' },
    raw_ocr: {
      text: { type: String, default: '' },
      blocks: { type: Array, default: [] },
      metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    document_type: {
      type: String,
      enum: ['school', 'health', 'admin', 'unknown'],
      default: 'unknown',
    },
    upload_date: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['pending_cleaning', 'cleaning', 'cleaned', 'failed'],
      default: 'pending_cleaning',
    },
  },
  { timestamps: true }
);

rawDocumentSchema.index({ sourceOcrId: 1 });
rawDocumentSchema.index({ status: 1 });
rawDocumentSchema.index({ upload_date: -1 });

module.exports = mongoose.model('RawDocument', rawDocumentSchema);

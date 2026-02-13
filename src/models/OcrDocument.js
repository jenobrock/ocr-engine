const mongoose = require('mongoose');

const ocrDocumentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    schoolId: { type: String, required: true },
    uploadedBy: { type: String, default: '' },
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'processed', 'failed'],
      default: 'uploaded',
    },
    filePath: { type: String },
    mimeType: { type: String },
    fileSize: { type: Number },
    visionResponse: { type: mongoose.Schema.Types.Mixed },
    fullText: { type: String },
    confidence: { type: Number },
    pages: { type: Array, default: [] },
    errorLog: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  }
);

ocrDocumentSchema.index({ schoolId: 1 });
ocrDocumentSchema.index({ createdAt: -1 });
ocrDocumentSchema.index({ status: 1 });
ocrDocumentSchema.index({ uploadedBy: 1 });

module.exports = mongoose.model('OcrDocument', ocrDocumentSchema);

const mongoose = require('mongoose');

const cleanedDocumentSchema = new mongoose.Schema(
  {
    rawDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'RawDocument' },
    ocrDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'OcrDocument' },
    cleaned_data: { type: mongoose.Schema.Types.Mixed, default: {} },
    schema: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    detected_fields:  { type: Array, default: () => [] },
    validation_errors: { type: Array, default: () => [] },
    ai_errors:         { type: Array, default: () => [] },
    confidence: { type: Number, default: null },
    status: {
      type: String,
      enum: ['validated', 'needs_review', 'rejected'],
      default: 'needs_review',
    },
    validated_at: { type: Date, default: null },
  },
  { timestamps: true }
);

cleanedDocumentSchema.index({ rawDocumentId: 1 });
cleanedDocumentSchema.index({ ocrDocumentId: 1 });
cleanedDocumentSchema.index({ status: 1 });

module.exports = mongoose.model('CleanedDocument', cleanedDocumentSchema);

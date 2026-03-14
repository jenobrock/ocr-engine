const mongoose = require('mongoose');
const Mixed = mongoose.Schema.Types.Mixed;

const cleanedDocumentSchema = new mongoose.Schema(
  {
    rawDocumentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'RawDocument' },
    ocrDocumentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'OcrDocument' },
    cleaned_data:   { type: Mixed, default: {} },
    schema:         { type: Mixed, default: null },
    detected_fields:  { type: Mixed, default: [] },
    validation_errors:{ type: Mixed, default: [] },
    ai_errors:        { type: Mixed, default: [] },
    confidence:     { type: Number, default: null },
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

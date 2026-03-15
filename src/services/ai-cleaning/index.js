const fs = require('fs').promises;
const path = require('path');
const OcrDocument = require('../../models/OcrDocument');
const RawDocument = require('../../models/RawDocument');
const CleanedDocument = require('../../models/CleanedDocument');
const config = require('../../config');
const { preprocess } = require('./preprocess');
const { runCleaning } = require('./openai.service');
const { postValidate } = require('./postValidate');

const CONFIDENCE_THRESHOLD = config.AI_CLEANING_CONFIDENCE_THRESHOLD ?? 0.8;

// MIME types that can be sent as images to OpenAI Vision
const VISION_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Try to load the document file as a base64 image for OpenAI vision.
 * Only supports image MIME types (not PDF — GPT doesn't accept PDF directly).
 * @param {string} filePath
 * @param {string} mimeType
 * @returns {Promise<{ base64: string, mimeType: string } | null>}
 */
async function loadImageForVision(filePath, mimeType) {
  if (!filePath || !VISION_IMAGE_TYPES.includes(mimeType)) return null;
  try {
    const buffer = await fs.readFile(filePath);
    return { base64: buffer.toString('base64'), mimeType };
  } catch (e) {
    console.warn('[AI] Could not read image for vision input:', e.message);
    return null;
  }
}

/**
 * Build raw_ocr from OcrDocument.
 */
function buildRawOcrFromOcrDocument(ocrDoc) {
  const text = ocrDoc.fullText || '';
  const blocks = ocrDoc.pages || [];
  const metadata = {
    fileName: ocrDoc.fileName,
    schoolId: ocrDoc.schoolId,
    uploadedBy: ocrDoc.uploadedBy,
    mimeType: ocrDoc.mimeType,
  };
  return { text, blocks, metadata };
}

/**
 * Run full AI cleaning pipeline: OCR text + optional image → OpenAI → post-validate → save.
 * @param {string} ocrDocumentId
 * @param {object} options - { documentType, country, language }
 */
async function runAICleaning(ocrDocumentId, options = {}) {
  const ocrDoc = await OcrDocument.findById(ocrDocumentId);
  if (!ocrDoc) {
    const err = new Error('OCR document not found');
    err.statusCode = 404;
    throw err;
  }
  if (ocrDoc.status !== 'processed') {
    const err = new Error('OCR document must be processed before AI cleaning');
    err.statusCode = 400;
    throw err;
  }

  const rawOcr = buildRawOcrFromOcrDocument(ocrDoc);
  const rawDoc = new RawDocument({
    sourceOcrId: ocrDocumentId,
    raw_ocr: rawOcr,
    document_type: 'school',
    upload_date: ocrDoc.createdAt || new Date(),
    status: 'cleaning',
  });
  await rawDoc.save();

  let cleanedDoc;
  try {
    const preparedText = preprocess(rawOcr.text);

    // Attempt to load the original file as image for OpenAI vision
    const imageData = await loadImageForVision(ocrDoc.filePath, ocrDoc.mimeType);

    if (imageData) {
      console.log(`[AI] Vision mode: sending image (${ocrDoc.mimeType}) + OCR text to GPT-4o`);
    } else {
      console.log(`[AI] Text-only mode: sending OCR text to GPT-4o (${ocrDoc.mimeType})`);
    }

    const aiResult = await runCleaning(preparedText, {
      documentType: 'school',
      country: options.country || 'DRC',
      language: options.language || 'French',
      imageData, // null for PDFs, base64 object for images
      zoneTexts: options.zoneTexts || null, // zone-based extraction if provided
    });

    const { valid: postValid, errors: postErrors } = postValidate(
      aiResult.cleaned_data,
      aiResult.schema_proposal
    );
    const allErrors = [...(aiResult.errors || []), ...postErrors];

    let status = 'validated';
    if (!postValid || allErrors.length > 0) status = 'needs_review';
    if (aiResult.confidence < CONFIDENCE_THRESHOLD) status = 'needs_review';
    if (!postValid && postErrors.some((e) => e.startsWith('invalid_') || e.startsWith('future_'))) {
      status = 'rejected';
    }

    cleanedDoc = new CleanedDocument({
      rawDocumentId: rawDoc._id,
      ocrDocumentId: ocrDocumentId,
      cleaned_data: aiResult.cleaned_data,
      schema: aiResult.schema_proposal,
      detected_fields: aiResult.detected_fields || [],
      validation_errors: allErrors,
      confidence: aiResult.confidence,
      status,
      validated_at: status === 'validated' ? new Date() : null,
    });
    await cleanedDoc.save();

    rawDoc.status = 'cleaned';
    await rawDoc.save();

    return {
      cleanedDocumentId: cleanedDoc._id.toString(),
      status: cleanedDoc.status,
      confidence: cleanedDoc.confidence,
    };
  } catch (err) {
    rawDoc.status = 'failed';
    await rawDoc.save();
    if (!cleanedDoc) {
      cleanedDoc = new CleanedDocument({
        rawDocumentId: rawDoc._id,
        ocrDocumentId: ocrDocumentId,
        cleaned_data: {},
        schema: null,
        detected_fields: [],
        validation_errors: [],
        ai_errors: [err.message],
        confidence: 0,
        status: 'rejected',
      });
      await cleanedDoc.save();
    }
    throw err;
  }
}

module.exports = {
  runAICleaning,
  buildRawOcrFromOcrDocument,
  preprocess,
};

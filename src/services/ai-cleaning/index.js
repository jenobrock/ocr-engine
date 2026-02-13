const OcrDocument = require('../../models/OcrDocument');
const RawDocument = require('../../models/RawDocument');
const CleanedDocument = require('../../models/CleanedDocument');
const config = require('../../config');
const { preprocess } = require('./preprocess');
const { runCleaning } = require('./openai.service');
const { postValidate } = require('./postValidate');

const DOCUMENT_TYPES = ['school', 'health', 'admin', 'unknown'];
const CONFIDENCE_THRESHOLD = config.AI_CLEANING_CONFIDENCE_THRESHOLD ?? 0.8;

/**
 * Build raw_ocr from OcrDocument.
 * @param {object} ocrDoc
 * @returns {{ text: string, blocks: Array, metadata: object }}
 */
function buildRawOcrFromOcrDocument(ocrDoc) {
  const text = ocrDoc.fullText || '';
  const blocks = ocrDoc.pages || (ocrDoc.visionResponse && ocrDoc.visionResponse.fullTextAnnotation?.pages) || [];
  const metadata = {
    fileName: ocrDoc.fileName,
    schoolId: ocrDoc.schoolId,
    uploadedBy: ocrDoc.uploadedBy,
    mimeType: ocrDoc.mimeType,
  };
  return { text, blocks, metadata };
}

/**
 * Run full AI cleaning pipeline: read OCR -> raw -> preprocess -> OpenAI -> post-validate -> save.
 * @param {string} ocrDocumentId - OcrDocument._id
 * @param {object} options - { documentType, country, language }
 * @returns {Promise<{ cleanedDocumentId: string, status: string, confidence: number }>}
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

  const documentType = DOCUMENT_TYPES.includes(options.documentType)
    ? options.documentType
    : 'unknown';

  const rawOcr = buildRawOcrFromOcrDocument(ocrDoc);
  const rawDoc = new RawDocument({
    sourceOcrId: ocrDocumentId,
    raw_ocr: rawOcr,
    document_type: documentType,
    upload_date: ocrDoc.createdAt || new Date(),
    status: 'cleaning',
  });
  await rawDoc.save();

  let cleanedDoc;
  try {
    const preparedText = preprocess(rawOcr.text);
    const aiResult = await runCleaning(preparedText, {
      documentType,
      country: options.country || 'DRC',
      language: options.language || 'French',
    });

    const { valid: postValid, errors: postErrors } = postValidate(
      aiResult.cleaned_data,
      aiResult.schema_proposal
    );
    const allErrors = [...(aiResult.errors || []), ...postErrors];

    let status = 'validated';
    if (!postValid || allErrors.length > 0) {
      status = 'needs_review';
    } else if (aiResult.confidence < CONFIDENCE_THRESHOLD) {
      status = 'needs_review';
    }
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

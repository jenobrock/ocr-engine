const express = require('express');
const mongoose = require('mongoose');
const CleanedDocument = require('../models/CleanedDocument');
const { auth } = require('../middleware/auth');
const { runAICleaning } = require('../services/ai-cleaning');

const router = express.Router();

router.use(auth);

/**
 * @openapi
 * /api/ai-cleaning/process/{ocrDocumentId}:
 *   post:
 *     summary: Run AI cleaning and structuring on an OCR document
 *     parameters: [{ name: ocrDocumentId, in: path, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               documentType: { type: string, enum: [school, health, admin, unknown] }
 *               country: { type: string }
 *               language: { type: string }
 *     responses:
 *       200: { description: { cleanedDocumentId, status, confidence } }
 *       400: { description: OCR not processed yet }
 *       404: { description: OCR document not found }
 *       502: { description: AI cleaning failed }
 */
router.post('/process/:ocrDocumentId', async (req, res, next) => {
  try {
    const ocrDocumentId = req.params.ocrDocumentId;
    if (!mongoose.Types.ObjectId.isValid(ocrDocumentId)) {
      return res.status(404).json({ error: 'OCR document not found' });
    }
    const options = {
      documentType: req.body.documentType || 'unknown',
      country: req.body.country || 'DRC',
      language: req.body.language || 'French',
    };
    const result = await runAICleaning(ocrDocumentId, options);
    res.json(result);
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    if (err.statusCode === 503 || err.code === 'OPENAI_NOT_CONFIGURED') {
      return res.status(503).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * @openapi
 * /api/ai-cleaning/result/{id}:
 *   get:
 *     summary: Get cleaned document result by id
 *     parameters: [{ name: id, in: path, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Cleaned document (cleaned_data, schema, confidence, status, validation_errors) }
 *       404: { description: Not found }
 */
router.get('/result/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Cleaned document not found' });
    }
    const doc = await CleanedDocument.findById(id)
      .populate('rawDocumentId', 'raw_ocr document_type status')
      .populate('ocrDocumentId', 'fileName schoolId');
    if (!doc) {
      return res.status(404).json({ error: 'Cleaned document not found' });
    }
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/ai-cleaning/list:
 *   get:
 *     summary: List cleaned documents (paginated)
 *     parameters:
 *       - name: ocrDocumentId
 *         in: query
 *         schema: { type: string }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [validated, needs_review, rejected] }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20 }
 *       - name: offset
 *         in: query
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: { items, total } }
 */
router.get('/list', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const filter = {};
    if (req.query.ocrDocumentId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.ocrDocumentId)) {
        return res.status(400).json({ error: 'Invalid ocrDocumentId' });
      }
      filter.ocrDocumentId = req.query.ocrDocumentId;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [items, total] = await Promise.all([
      CleanedDocument.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      CleanedDocument.countDocuments(filter),
    ]);
    res.json({ items, total });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/ai-cleaning/{id}/validate:
 *   patch:
 *     summary: Validate a cleaned document schema and mark as validated
 *     parameters: [{ name: id, in: path, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tableName: { type: string }
 */
router.patch('/:id/validate', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Cleaned document not found' });
    }
    const doc = await CleanedDocument.findById(id);
    if (!doc) return res.status(404).json({ error: 'Cleaned document not found' });

    doc.status = 'validated';
    doc.validated_at = new Date();

    // Allow overriding the table name during validation
    if (req.body.tableName && doc.schema) {
      doc.schema = { ...doc.schema.toObject?.() ?? doc.schema, table_name: req.body.tableName };
    }

    await doc.save();
    res.json({ id: doc._id.toString(), status: doc.status, validated_at: doc.validated_at });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

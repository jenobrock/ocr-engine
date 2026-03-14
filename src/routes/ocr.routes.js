const express = require('express');
const mongoose = require('mongoose');
const OcrDocument = require('../models/OcrDocument');
const { upload } = require('../middleware/upload');
const { auth } = require('../middleware/auth');
const { runOcr } = require('../services/vision.service');

const router = express.Router();

router.use(auth);

/**
 * @openapi
 * /api/ocr/upload:
 *   post:
 *     summary: Upload a document (PDF, JPG, PNG, TIFF)
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, schoolId]
 *             properties:
 *               file: { type: string, format: binary }
 *               schoolId: { type: string }
 *               uploadedBy: { type: string }
 *     responses:
 *       201: { description: Created, content: { application/json: { schema: { type: object, properties: { id: {}, fileName: {}, status: {} } } } } }
 *       400: { description: No file or missing schoolId }
 *       401: { description: Unauthorized }
 *       413: { description: File too large }
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const schoolId = req.body.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }
    const doc = new OcrDocument({
      fileName: req.file.originalname,
      schoolId,
      uploadedBy: req.body.uploadedBy || '',
      status: 'uploaded',
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
    });
    await doc.save();
    res.status(201).json({
      id: doc._id.toString(),
      fileName: doc.fileName,
      status: doc.status,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/ocr/process/{id}:
 *   post:
 *     summary: Run OCR on an uploaded document
 *     parameters: [{ name: id, in: path, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: OCR completed }
 *       404: { description: Document not found }
 *       409: { description: Already processed or in progress }
 *       502: { description: OCR failed }
 */
router.post('/process/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const doc = await OcrDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (doc.status === 'processing') {
      return res.status(409).json({ error: 'OCR already in progress' });
    }
    if (doc.status === 'processed') {
      return res.status(409).json({ error: 'Document already processed' });
    }

    doc.status = 'processing';
    doc.errorLog = null;
    doc.updatedAt = new Date();
    await doc.save();

    try {
      const { rawResponse, fullText, confidence, pages } = await runOcr(
        doc.filePath,
        doc.mimeType
      );
      doc.visionResponse = rawResponse;
      doc.fullText = fullText;
      doc.confidence = confidence;
      doc.pages = pages;
      doc.status = 'processed';
      doc.errorLog = null;
      doc.updatedAt = new Date();
      await doc.save();
      return res.json({ id: doc._id.toString(), status: 'processed' });
    } catch (ocrErr) {
      doc.status = 'failed';
      doc.errorLog = {
        message: ocrErr.message || 'OCR failed',
        code: ocrErr.code || 'UNKNOWN',
        at: new Date(),
      };
      doc.updatedAt = new Date();
      await doc.save();
      const status = ocrErr.code === 'VISION_NOT_CONFIGURED' ? 503
        : ocrErr.code === 429 ? 429
        : ocrErr.code === 8 ? 503
        : 502;
      return res.status(status).json({
        error: ocrErr.message || 'OCR processing failed',
      });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/ocr/result/{id}:
 *   get:
 *     summary: Get full OCR result for a document
 *     parameters: [{ name: id, in: path, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Document with visionResponse, fullText, confidence, pages }
 *       404: { description: Document not found }
 */
router.get('/result/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const doc = await OcrDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/ocr/list:
 *   get:
 *     summary: List documents by school (paginated)
 *     parameters:
 *       - name: schoolId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [uploaded, processing, processed, failed] }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20 }
 *       - name: offset
 *         in: query
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: { items: [], total: number } }
 *       400: { description: schoolId required }
 */
router.get('/list', async (req, res, next) => {
  try {
    const schoolId = req.query.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId query parameter is required' });
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const status = req.query.status;

    const filter = { schoolId };
    if (status) filter.status = status;

    const [items, total] = await Promise.all([
      OcrDocument.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      OcrDocument.countDocuments(filter),
    ]);
    res.json({ items, total });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

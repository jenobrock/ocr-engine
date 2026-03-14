const fs = require('fs').promises;
const { getVisionClient } = require('../config/vision');
const config = require('../config');

/**
 * Extract full text and word-level confidence from Vision API page responses.
 * Works for both annotateFile (PDF/TIFF) and documentTextDetection (images).
 * @param {Array} pages - fullTextAnnotation.pages
 * @returns {{ pagesSummary: Array, confidence: number }}
 */
function extractPagesData(pages) {
  let totalConf = 0;
  let confCount = 0;
  const pagesSummary = [];

  for (const page of pages) {
    let pageText = '';
    for (const block of (page.blocks || [])) {
      for (const para of (block.paragraphs || [])) {
        let paraText = '';
        for (const word of (para.words || [])) {
          const wordText = (word.symbols || []).map((s) => s.text || '').join('');
          const lastSym = word.symbols && word.symbols[word.symbols.length - 1];
          const breakType = lastSym?.property?.detectedBreak?.type;
          const spacer = (
            breakType === 'SPACE' ||
            breakType === 'EOL_SURE_SPACE' ||
            breakType === 'LINE_BREAK'
          ) ? ' ' : '';
          paraText += wordText + spacer;

          if (word.confidence != null) {
            totalConf += word.confidence;
            confCount++;
          }
        }
        pageText += paraText.trim() + '\n';
      }
    }
    pagesSummary.push({
      text: pageText.trim(),
      width: page.width,
      height: page.height,
    });
  }

  let confidence = confCount > 0 ? Math.round((totalConf / confCount) * 1000) / 1000 : null;
  return { pagesSummary, confidence };
}

/**
 * Run OCR on an image file (JPG, PNG, TIFF single-page, WebP).
 */
async function runOcrImage(client, buffer) {
  const [result] = await client.documentTextDetection({ image: { content: buffer } });

  const fta = result?.fullTextAnnotation;
  if (!fta) return { fullText: '', pages: [], confidence: 0 };

  const fullText = fta.text || '';
  const { pagesSummary, confidence } = extractPagesData(fta.pages || []);

  const finalConf = confidence !== null
    ? confidence
    : (fullText.trim().length > 0 ? 0.75 : 0);

  return { fullText, pages: pagesSummary, confidence: finalConf };
}

/**
 * Run OCR on a PDF or multi-page TIFF using batchAnnotateFiles (proper PDF support).
 */
async function runOcrPdf(client, buffer, mimeType) {
  const [result] = await client.batchAnnotateFiles({
    requests: [{
      inputConfig: {
        content: buffer,
        mimeType: mimeType, // 'application/pdf' or 'image/tiff'
      },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      // Vision API sync limit: up to 5 pages per request
      pages: [1, 2, 3, 4, 5],
    }],
  });

  // batchAnnotateFiles wraps results one level deeper
  const responses = result?.responses?.[0]?.responses || [];
  let fullText = '';
  const pages = [];
  let totalConf = 0;
  let confCount = 0;

  for (const resp of responses) {
    const fta = resp.fullTextAnnotation;
    if (!fta) continue;

    fullText += (fta.text || '') + '\n';

    const { pagesSummary, confidence } = extractPagesData(fta.pages || []);
    pages.push(...pagesSummary);

    if (confidence !== null) {
      totalConf += confidence;
      confCount++;
    }
  }

  fullText = fullText.trim();
  const confidence = confCount > 0
    ? Math.round((totalConf / confCount) * 1000) / 1000
    : (fullText.length > 0 ? 0.75 : 0);

  return { fullText, pages, confidence };
}

async function runOcr(filePath, mimeType) {
  const client = getVisionClient();
  const buffer = await fs.readFile(filePath);

  const isPdf = mimeType === 'application/pdf';
  const isMultiTiff = mimeType === 'image/tiff';

  let fullText = '';
  let confidence = 0;
  let pages = [];

  await Promise.race([
    (async () => {
      const result = (isPdf || isMultiTiff)
        ? await runOcrPdf(client, buffer, mimeType)
        : await runOcrImage(client, buffer);

      fullText = result.fullText;
      confidence = result.confidence;
      pages = result.pages;
    })(),
    new Promise((_, rej) =>
      setTimeout(
        () => rej(new Error('Vision API timeout')),
        config.VISION_TIMEOUT_MS
      )
    ),
  ]);

  console.log(`[Vision] fullText length=${fullText.length}, pages=${pages.length}, confidence=${confidence}`);

  return {
    rawResponse: null, // avoid storing large Vision response in DB
    fullText,
    confidence,
    pages,
  };
}

module.exports = { runOcr };

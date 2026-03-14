const fs = require('fs').promises;
const { getVisionClient } = require('../config/vision');
const config = require('../config');

/**
 * Extract full text and word-level confidence from Vision API page list.
 * Vision API structure: page → blocks → paragraphs → words → symbols
 * @param {Array} pages - fullTextAnnotation.pages
 * @returns {{ pagesSummary: Array, confidence: number|null }}
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
          // Concatenate symbols to get word text
          const wordText = (word.symbols || []).map((s) => s.text || '').join('');
          // Detect space after word via detectedBreak
          const lastSym = word.symbols && word.symbols[word.symbols.length - 1];
          const breakType = lastSym?.property?.detectedBreak?.type;
          const spacer = (breakType === 'SPACE' || breakType === 'EOL_SURE_SPACE' || breakType === 'LINE_BREAK') ? ' ' : '';
          paraText += wordText + spacer;

          // Collect word-level confidence (most reliably populated field)
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

  let confidence = null;
  if (confCount > 0) {
    confidence = Math.round((totalConf / confCount) * 1000) / 1000;
  }

  return { pagesSummary, confidence };
}

async function runOcr(filePath, mimeType) {
  const client = getVisionClient();
  const buffer = await fs.readFile(filePath);

  const request = { image: { content: buffer } };

  const [result] = await Promise.race([
    client.documentTextDetection(request),
    new Promise((_, rej) =>
      setTimeout(
        () => rej(new Error('Vision API timeout')),
        config.VISION_TIMEOUT_MS
      )
    ),
  ]);

  const fullTextAnnotation = result?.fullTextAnnotation;
  let fullText = '';
  let confidence = null;
  let pages = [];

  if (fullTextAnnotation) {
    // Use the top-level text shortcut provided by Vision API
    fullText = fullTextAnnotation.text || '';

    if (fullTextAnnotation.pages && fullTextAnnotation.pages.length) {
      const extracted = extractPagesData(fullTextAnnotation.pages);
      pages = extracted.pagesSummary;
      confidence = extracted.confidence;
    }

    // If confidence is still null but text was found, Vision API didn't return
    // word-level scores — fall back to a conservative default
    if (confidence === null && fullText.trim().length > 0) {
      confidence = 0.75;
    }
  }

  // If absolutely no text was found, confidence stays 0
  if (confidence === null) {
    confidence = 0;
  }

  console.log(`[Vision] fullText length=${fullText.length}, pages=${pages.length}, confidence=${confidence}`);

  return {
    rawResponse: result ? JSON.parse(JSON.stringify(result)) : null,
    fullText,
    confidence,
    pages,
  };
}

module.exports = { runOcr };

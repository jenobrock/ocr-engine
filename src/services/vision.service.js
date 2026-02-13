const fs = require('fs').promises;
const { getVisionClient } = require('../config/vision');
const config = require('../config');

async function runOcr(filePath, mimeType) {
  const client = getVisionClient();
  const buffer = await fs.readFile(filePath);

  const isPdf = mimeType === 'application/pdf';
  const request = {
    image: { content: buffer },
    ...(isPdf && { imageContext: { } }),
  };

  const [result] = await Promise.race([
    client.documentTextDetection(request),
    new Promise((_, rej) =>
      setTimeout(
        () => rej(new Error('Vision API timeout')),
        config.VISION_TIMEOUT_MS
      )
    ),
  ]);

  const rawResponse = result;
  const fullTextAnnotation = result.fullTextAnnotation;

  let fullText = '';
  let confidence = null;
  const pages = [];

  if (fullTextAnnotation) {
    fullText = fullTextAnnotation.text || '';
    if (fullTextAnnotation.pages && fullTextAnnotation.pages.length) {
      let totalConf = 0;
      let confCount = 0;
      for (const page of fullTextAnnotation.pages) {
        const pageText = (page.blocks || [])
          .map((b) => (b.lines || []).map((l) => (l.text || '')).join(' '))
          .join('\n');
        pages.push({
          text: pageText,
          width: page.width,
          height: page.height,
        });
        if (page.confidence != null) {
          totalConf += page.confidence;
          confCount++;
        }
      }
      if (confCount > 0) confidence = totalConf / confCount;
    }
  }

  return {
    rawResponse: rawResponse ? JSON.parse(JSON.stringify(rawResponse)) : null,
    fullText,
    confidence,
    pages,
  };
}

module.exports = { runOcr };

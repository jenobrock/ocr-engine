const config = require('../../config');

/**
 * Clean special characters and noise, normalize paragraphs, limit size for prompt.
 * @param {string} rawText - Raw OCR text
 * @returns {string} Prepared text for OpenAI
 */
function preprocess(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t+/g, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  text = lines.join('\n');

  const maxChars = config.AI_CLEANING_MAX_CHARS || 12000;
  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + '\n[... texte tronqué ...]';
  }

  return text;
}

module.exports = { preprocess };

const OpenAI = require('openai').default;
const config = require('../../config');
const { buildPrompt } = require('./prompt');

function getClient() {
  if (!config.OPENAI_API_KEY) {
    const err = new Error('Clé OpenAI non configurée. Ajoutez OPENAI_API_KEY dans le fichier .env du serveur.');
    err.code = 'OPENAI_NOT_CONFIGURED';
    err.statusCode = 503;
    throw err;
  }
  return new OpenAI({ apiKey: config.OPENAI_API_KEY });
}

/**
 * Parse AI response: strip optional markdown code block wrapper.
 */
function parseJsonResponse(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('Empty or invalid response from OpenAI');
  }
  let str = content.trim();
  const codeBlock = str.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  if (codeBlock) str = codeBlock[1].trim();
  return JSON.parse(str);
}

/**
 * Validate the expected shape of the AI response.
 */
function validateAiResponseShape(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return { valid: false, errors: ['Response is not an object'] };
  if (typeof obj.cleaned_data !== 'object' || obj.cleaned_data === null) errors.push('cleaned_data must be an object');
  if (!Array.isArray(obj.detected_fields)) errors.push('detected_fields must be an array');
  if (!Array.isArray(obj.errors)) errors.push('errors must be an array');
  const conf = obj.confidence;
  if (typeof conf !== 'number' || conf < 0 || conf > 1) errors.push('confidence must be a number between 0 and 1');
  if (!obj.schema_proposal || typeof obj.schema_proposal !== 'object') {
    errors.push('schema_proposal must be an object');
  } else {
    if (typeof obj.schema_proposal.table_name !== 'string') errors.push('schema_proposal.table_name must be a string');
    if (!Array.isArray(obj.schema_proposal.fields)) errors.push('schema_proposal.fields must be an array');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Build the message content for OpenAI.
 * If imageData is provided, sends image + text (GPT-4o vision).
 * Otherwise, sends text only.
 *
 * @param {string} prompt
 * @param {{ base64: string, mimeType: string } | null} imageData
 * @returns {Array} messages[].content
 */
function buildUserContent(prompt, imageData) {
  if (!imageData) {
    // Text-only mode (PDF or image read failed)
    return prompt;
  }

  // Vision mode: image first, then the text prompt
  return [
    {
      type: 'image_url',
      image_url: {
        url: `data:${imageData.mimeType};base64,${imageData.base64}`,
        detail: 'high', // high = better for handwriting, fine details
      },
    },
    {
      type: 'text',
      text: prompt,
    },
  ];
}

/**
 * Call OpenAI and return structured result.
 * Uses GPT-4o with vision when an image is available, GPT-4o-mini for text-only.
 *
 * @param {string} preparedText - Preprocessed OCR text
 * @param {object} options - { documentType, country, language, imageData }
 */
async function runCleaning(preparedText, options = {}) {
  const client = getClient();

  const prompt = buildPrompt({
    text: preparedText,
    documentType: options.documentType || 'school',
    country: options.country || 'DRC',
    language: options.language || 'French',
  });

  const hasImage = !!options.imageData;

  // Use gpt-4o for vision (image), gpt-4o-mini for text-only
  const model = hasImage
    ? 'gpt-4o'
    : (config.OPENAI_MODEL || 'gpt-4o-mini');

  const systemPrompt = hasImage
    ? 'You are an expert at reading DRC school bulletin documents. You have been given the document image AND the OCR text. Use BOTH to extract accurate data — prefer what you see in the image for handwritten values where OCR may be wrong. Return only valid JSON.'
    : 'You are an expert at reading DRC school bulletin documents. Return only valid JSON. No markdown, no explanation.';

  const userContent = buildUserContent(prompt, options.imageData || null);

  console.log(`[AI] Calling OpenAI model=${model}, vision=${hasImage}`);

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: 0.1, // Low temperature for precise, consistent extraction
    max_tokens: 4096,
  });

  const content = response.choices?.[0]?.message?.content;
  const parsed = parseJsonResponse(content);
  const { valid, errors: shapeErrors } = validateAiResponseShape(parsed);
  if (!valid) {
    throw new Error(`Invalid AI response shape: ${shapeErrors.join('; ')}`);
  }

  return {
    cleaned_data: parsed.cleaned_data || {},
    detected_fields: parsed.detected_fields || [],
    errors: parsed.errors || [],
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    schema_proposal: parsed.schema_proposal || { table_name: 'bulletin_scolaire', fields: [] },
  };
}

module.exports = {
  runCleaning,
  parseJsonResponse,
  validateAiResponseShape,
};

const OpenAI = require('openai').default;
const config = require('../../config');
const { buildPrompt } = require('./prompt');

function getClient() {
  if (!config.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey: config.OPENAI_API_KEY });
}

/**
 * Parse AI response: handle optional markdown code block.
 * @param {string} content
 * @returns {object}
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
 * Validate that the parsed object has the expected shape.
 * @param {object} obj
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateAiResponseShape(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['Response is not an object'] };
  }
  if (typeof obj.cleaned_data !== 'object' || obj.cleaned_data === null) {
    errors.push('cleaned_data must be an object');
  }
  if (!Array.isArray(obj.detected_fields)) {
    errors.push('detected_fields must be an array');
  }
  if (!Array.isArray(obj.errors)) {
    errors.push('errors must be an array');
  }
  const conf = obj.confidence;
  if (typeof conf !== 'number' || conf < 0 || conf > 1) {
    errors.push('confidence must be a number between 0 and 1');
  }
  if (!obj.schema_proposal || typeof obj.schema_proposal !== 'object') {
    errors.push('schema_proposal must be an object');
  } else {
    if (typeof obj.schema_proposal.table_name !== 'string') {
      errors.push('schema_proposal.table_name must be a string');
    }
    if (!Array.isArray(obj.schema_proposal.fields)) {
      errors.push('schema_proposal.fields must be an array');
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Call OpenAI and return structured result.
 * @param {string} preparedText
 * @param {object} options - { documentType, country, language }
 * @returns {Promise<{ cleaned_data, detected_fields, errors, confidence, schema_proposal }>}
 */
async function runCleaning(preparedText, options = {}) {
  const client = getClient();
  const prompt = buildPrompt({
    text: preparedText,
    documentType: options.documentType || 'unknown',
    country: options.country || 'DRC',
    language: options.language || 'French',
  });

  const response = await client.chat.completions.create({
    model: config.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You return only valid JSON. No markdown, no explanation.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
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
    schema_proposal: parsed.schema_proposal || { table_name: 'documents', fields: [] },
  };
}

module.exports = {
  runCleaning,
  parseJsonResponse,
  validateAiResponseShape,
};

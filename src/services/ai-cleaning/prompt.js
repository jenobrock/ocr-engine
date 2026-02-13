/**
 * Build the structured prompt for OpenAI document cleaning.
 * @param {object} opts - { text, documentType, country, language }
 * @returns {string} Prompt text
 */
function buildPrompt(opts) {
  const {
    text = '',
    documentType = 'unknown',
    country = 'DRC',
    language = 'French',
  } = opts;

  return `You are a document cleaning and structuring AI.

Country: ${country}
Language: ${language}

Task:
- Fix OCR errors
- Normalize names
- Normalize dates
- Validate values
- Extract structured fields
- Detect missing fields
- Propose database schema

Document type: ${documentType}

OCR Text:
"""
${text}
"""

Return ONLY valid JSON with exactly these keys (no markdown, no code block):
- cleaned_data: object with cleaned and normalized fields
- detected_fields: array of field names identified
- errors: array of strings (e.g. "missing_birth_date", "invalid_score")
- confidence: number between 0 and 1
- schema_proposal: object with table_name (string) and fields (array of { name, type, required? })`;
}

module.exports = { buildPrompt };

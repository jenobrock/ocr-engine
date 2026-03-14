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

  const hasText = text && text.trim().length > 10;

  return `You are an expert document structuring AI specialized in ${country} administrative documents.

Language: ${language}
Country: ${country}
Document type hint: ${documentType}

Your mission:
1. Read the OCR text carefully
2. Fix all OCR errors (e.g. "l3" → "13", "0" vs "O", broken words)
3. Extract EVERY meaningful piece of information as a key-value pair
4. Normalize all dates to ISO format (YYYY-MM-DD)
5. Normalize names (proper casing)
6. Propose a descriptive table_name (e.g. "school_report", "birth_certificate", "invoice", "identity_card") — NEVER use "unknown_document"
7. List all detected fields
8. Rate your confidence honestly

OCR Text:
"""
${hasText ? text : '[EMPTY — the document has no readable text or OCR failed]'}
"""

${!hasText ? `Since the text is empty or unreadable, return your best guess with confidence: 0.1 and status fields reflecting this.` : ''}

Return ONLY a single valid JSON object with EXACTLY these keys:
{
  "cleaned_data": {
    /* Every extracted field as key: value. Even for unknown docs, extract anything useful.
       Example: { "nom": "Jean Mukeba", "date_naissance": "1995-03-12", "etablissement": "École Primaire du Centre" } */
  },
  "detected_fields": [
    /* Array of field name strings that were found. Example: ["nom", "date_naissance", "classe"] */
  ],
  "errors": [
    /* Array of issue strings. Example: ["missing_signature", "date_illegible"] */
  ],
  "confidence": /* Float 0.0–1.0. Be honest. Low OCR quality = lower confidence. */,
  "schema_proposal": {
    "table_name": /* Descriptive snake_case name. NEVER "unknown_document". Examples: "bulletin_scolaire", "acte_naissance", "facture", "fiche_eleve" */,
    "fields": [
      /* { "name": "nom", "type": "string", "required": true }, ... */
    ]
  }
}

IMPORTANT: Return ONLY the JSON. No markdown. No backticks. No explanation.`;
}

module.exports = { buildPrompt };

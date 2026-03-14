/**
 * Build the specialized prompt for school bulletin (bulletin scolaire) documents.
 * @param {object} opts - { text, documentType, country, language }
 * @returns {string}
 */
function buildPrompt(opts) {
  const {
    text = '',
    country = 'DRC',
    language = 'French',
  } = opts;

  const hasText = text && text.trim().length > 10;

  return `You are an expert AI specialized in extracting structured data from African school report cards (bulletins scolaires).

Country: ${country}
Language: ${language}
Document type: bulletin_scolaire (school report card)

${hasText ? `OCR Text extracted from the document:
"""
${text}
"""` : `[DOCUMENT EMPTY — OCR produced no readable text. Return best-effort result with confidence: 0.05]`}

─── YOUR TASK ───────────────────────────────────────────────────────────────

Extract ALL of the following fields. If a field is not found, set it to null (never omit it).

STUDENT INFO:
- nom_eleve          → Last name of the student
- prenom_eleve       → First name(s) of the student
- genre              → "M" or "F" (if detectable)
- date_naissance     → Date of birth ISO format YYYY-MM-DD (if present)
- matricule          → Student ID / registration number (if present)

SCHOOL INFO:
- etablissement      → School name
- province           → Province or region
- ville              → City
- code_etablissement → School code (if present)
- directeur          → School director's name (if present)

ACADEMIC CONTEXT:
- annee_scolaire     → Academic year, e.g. "2023-2024"
- classe             → Class/grade, e.g. "6ème A", "3ème Scientifique"
- section            → Section/track, e.g. "Littéraire", "Scientifique", "Pédagogique"
- trimestre          → "1er trimestre", "2ème trimestre", "3ème trimestre", or "Annuel"

GRADES (matieres):
- matieres           → JSON array of subject objects. Each subject:
  {
    "nom": "Mathématiques",
    "note": 14,           ← grade obtained (number, or null)
    "max": 20,            ← maximum possible (default 20 if not shown)
    "coeff": 2,           ← coefficient/weight (number, or null)
    "points": 28          ← note × coeff (compute if not given)
  }
  Include ALL subjects found in the bulletin.

SUMMARY:
- total_points       → Sum of all weighted points (number)
- total_max          → Maximum possible weighted total (number)
- pourcentage        → Percentage score (total_points / total_max × 100), rounded to 2 decimals
- moyenne            → Average grade (total_points / total_max × max_grade), e.g. out of 20
- rang               → Class rank, e.g. "3ème" or 3
- effectif_classe    → Number of students in class (if present)
- mention            → Honor mention: "Très bien", "Bien", "Assez bien", "Passable", "Échec", or null

METADATA:
- date_bulletin      → Date the bulletin was issued (ISO format or as written)
- observations       → Any teacher/director observations or comments (string or null)

─── OUTPUT FORMAT ───────────────────────────────────────────────────────────

Return ONLY a single valid JSON object with EXACTLY these keys:

{
  "cleaned_data": {
    "nom_eleve": ...,
    "prenom_eleve": ...,
    "genre": ...,
    "date_naissance": ...,
    "matricule": ...,
    "etablissement": ...,
    "province": ...,
    "ville": ...,
    "code_etablissement": ...,
    "directeur": ...,
    "annee_scolaire": ...,
    "classe": ...,
    "section": ...,
    "trimestre": ...,
    "matieres": [...],
    "total_points": ...,
    "total_max": ...,
    "pourcentage": ...,
    "moyenne": ...,
    "rang": ...,
    "effectif_classe": ...,
    "mention": ...,
    "date_bulletin": ...,
    "observations": ...
  },
  "detected_fields": [/* list of field names that were actually found (non-null) */],
  "errors": [/* any issues found, e.g. "note_illisible_mathematiques", "rang_absent" */],
  "confidence": /* 0.0–1.0 based on how much text was readable and how many fields found */,
  "schema_proposal": {
    "table_name": "bulletin_scolaire",
    "fields": [
      { "name": "nom_eleve", "type": "string", "required": true },
      { "name": "prenom_eleve", "type": "string", "required": true },
      { "name": "genre", "type": "string", "required": false },
      { "name": "date_naissance", "type": "date", "required": false },
      { "name": "matricule", "type": "string", "required": false },
      { "name": "etablissement", "type": "string", "required": true },
      { "name": "province", "type": "string", "required": false },
      { "name": "ville", "type": "string", "required": false },
      { "name": "code_etablissement", "type": "string", "required": false },
      { "name": "directeur", "type": "string", "required": false },
      { "name": "annee_scolaire", "type": "string", "required": true },
      { "name": "classe", "type": "string", "required": true },
      { "name": "section", "type": "string", "required": false },
      { "name": "trimestre", "type": "string", "required": true },
      { "name": "matieres", "type": "json", "required": true },
      { "name": "total_points", "type": "number", "required": false },
      { "name": "total_max", "type": "number", "required": false },
      { "name": "pourcentage", "type": "number", "required": false },
      { "name": "moyenne", "type": "number", "required": false },
      { "name": "rang", "type": "string", "required": false },
      { "name": "effectif_classe", "type": "number", "required": false },
      { "name": "mention", "type": "string", "required": false },
      { "name": "date_bulletin", "type": "date", "required": false },
      { "name": "observations", "type": "string", "required": false }
    ]
  }
}

CRITICAL RULES:
- table_name MUST always be "bulletin_scolaire"
- ALL 24 keys in cleaned_data must be present (set to null if not found)
- matieres MUST be an array (empty array [] if no grades found)
- confidence: count non-null fields / 24, multiply by readability factor
- Return ONLY the JSON. No markdown, no backtick, no explanation.`;
}

module.exports = { buildPrompt };

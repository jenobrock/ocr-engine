/**
 * Specialized prompt for DRC school bulletin (bulletin scolaire) extraction.
 * Handles mixed printed labels + handwritten values.
 * @param {object} opts - { text, country, language }
 * @returns {string}
 */
function buildPrompt(opts) {
  const { text = '' } = opts;
  const hasText = text && text.trim().length > 10;

  return `You are an expert AI specialized in reading DRC (Democratic Republic of Congo) school report cards (bulletins scolaires).

These documents contain MIXED content:
- PRINTED labels (e.g. "PROVINCE:", "ÉLÈVE:", "N° PERM:")
- HANDWRITTEN values filled in by school staff (names, numbers, dates)

OCR of handwritten text often contains errors. You MUST:
- Correct obvious OCR errors in handwritten words (e.g. "Nord-Kivu" → correct if garbled)
- Recognize partial words and reconstruct them
- Handle mixed case, accent errors, and spacing issues

${hasText
  ? `Raw OCR text from the document:\n"""\n${text}\n"""`
  : `[EMPTY — OCR could not read the document. Return nulls with confidence: 0.02]`}

════════════════════════════════════════════════════════
PHASE 1 — HEADER EXTRACTION (top priority)
════════════════════════════════════════════════════════

The bulletin header always contains these fields as printed labels followed by handwritten values.
Extract them precisely:

┌─────────────────────────────────────────────────────────────┐
│  PROVINCE:        _______________ (handwritten)             │
│  VILLE:           _______________ (handwritten)             │
│  COMMUNE:         _______________ (handwritten)             │
│  ÉCOLE:           _______________ (handwritten)             │
│  ÉLÈVE:           _______________ (handwritten — FULL NAME) │
│  SEXE:            ___ (M or F, handwritten)                 │
│  NÉ(E) À:         _______________ (place of birth, HW)      │
│  LE:              _______________ (date of birth, HW)       │
│  CLASSE:          _______________ (handwritten)             │
│  N° PERM:         _______________ (permanent number, HW)    │
└─────────────────────────────────────────────────────────────┘

Field extraction rules:
- "province"      → text after label "PROVINCE" or "PROV"
- "ville"         → text after label "VILLE" or "CITY"
- "commune"       → text after label "COMMUNE"
- "etablissement" → text after label "ÉCOLE", "ECOLE", "ETABLISSEMENT", or school name
- "nom_eleve"     → FULL NAME after label "ÉLÈVE", "ELEVE", "NOM" — keep exactly as written
- "sexe"          → "M" or "F" after label "SEXE", "S" (normalize: "Masculin"→"M", "Féminin"→"F")
- "lieu_naissance"→ city after "NÉ(E) À", "NE A", "LIEU DE NAISSANCE"
- "date_naissance"→ date after "LE", "DATE DE NAISSANCE" → normalize to YYYY-MM-DD if possible
- "classe"        → value after "CLASSE", e.g. "6ème A", "3ème B", "4ème Scientifique"
- "numero_perm"   → long number after "N° PERM", "NUPERM", "N PERM", "NO PERM", "#PERM"

HANDWRITING TIPS:
- "0" and "O" are often confused in names and numbers
- "l" and "1" are often confused in N° PERM
- Accents (é, è, ê) may be missing or garbled — apply them to French words
- Names may be in ALL CAPS (OCR artifacts) — normalize to Title Case
- N° PERM is typically 10–20 digits, may have spaces or dashes

════════════════════════════════════════════════════════
PHASE 2 — GRADES TABLE EXTRACTION
════════════════════════════════════════════════════════

After the header, the bulletin contains a table of subjects and grades.
Extract all subjects as an array:

- "matieres" → array of: { "nom": string, "note": number|null, "max": number, "coeff": number|null, "points": number|null }
  - "max" defaults to 20 if not shown
  - Compute "points" = note × coeff if not given
  - Include ALL subjects, even if note is illegible (set note: null)

Summary fields (usually at the bottom of the table):
- "annee_scolaire"  → e.g. "2023-2024" (printed or handwritten)
- "trimestre"       → "1er trimestre", "2ème trimestre", "3ème trimestre", or "Annuel"
- "total_points"    → sum of all weighted points
- "total_max"       → maximum possible weighted total
- "pourcentage"     → total_points / total_max × 100, round to 2 decimals
- "moyenne"         → average out of 20
- "rang"            → class rank (string like "3ème" or number)
- "effectif_classe" → number of students in class
- "mention"         → "Très bien" | "Bien" | "Assez bien" | "Passable" | "Échec"
- "directeur"       → director name (usually at bottom with signature)
- "observations"    → any comments

════════════════════════════════════════════════════════
OUTPUT
════════════════════════════════════════════════════════

Return ONLY one valid JSON object. ALL keys must be present (null if not found):

{
  "cleaned_data": {
    "province":        string | null,
    "ville":           string | null,
    "commune":         string | null,
    "etablissement":   string | null,
    "nom_eleve":       string | null,
    "sexe":            "M" | "F" | null,
    "lieu_naissance":  string | null,
    "date_naissance":  string | null,
    "classe":          string | null,
    "numero_perm":     string | null,
    "annee_scolaire":  string | null,
    "trimestre":       string | null,
    "matieres":        [],
    "total_points":    number | null,
    "total_max":       number | null,
    "pourcentage":     number | null,
    "moyenne":         number | null,
    "rang":            string | null,
    "effectif_classe": number | null,
    "mention":         string | null,
    "directeur":       string | null,
    "observations":    string | null
  },
  "detected_fields": [ /* names of non-null fields */ ],
  "errors": [ /* e.g. "numero_perm_illisible", "note_illisible_mathematiques" */ ],
  "confidence": /* 0.0–1.0. Count non-null fields / 22, weight header fields more */ ,
  "schema_proposal": {
    "table_name": "bulletin_scolaire",
    "fields": [
      { "name": "province",        "type": "string",  "required": false },
      { "name": "ville",           "type": "string",  "required": false },
      { "name": "commune",         "type": "string",  "required": false },
      { "name": "etablissement",   "type": "string",  "required": true  },
      { "name": "nom_eleve",       "type": "string",  "required": true  },
      { "name": "sexe",            "type": "string",  "required": false },
      { "name": "lieu_naissance",  "type": "string",  "required": false },
      { "name": "date_naissance",  "type": "date",    "required": false },
      { "name": "classe",          "type": "string",  "required": true  },
      { "name": "numero_perm",     "type": "string",  "required": false },
      { "name": "annee_scolaire",  "type": "string",  "required": true  },
      { "name": "trimestre",       "type": "string",  "required": true  },
      { "name": "matieres",        "type": "json",    "required": true  },
      { "name": "total_points",    "type": "number",  "required": false },
      { "name": "total_max",       "type": "number",  "required": false },
      { "name": "pourcentage",     "type": "number",  "required": false },
      { "name": "moyenne",         "type": "number",  "required": false },
      { "name": "rang",            "type": "string",  "required": false },
      { "name": "effectif_classe", "type": "number",  "required": false },
      { "name": "mention",         "type": "string",  "required": false },
      { "name": "directeur",       "type": "string",  "required": false },
      { "name": "observations",    "type": "string",  "required": false }
    ]
  }
}

CRITICAL: table_name MUST be "bulletin_scolaire". Return ONLY JSON, no markdown, no backticks.`;
}

module.exports = { buildPrompt };

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

The DRC bulletin uses a detailed per-period structure. Each subject has grades across:
  1ère Période (1P) · 2ème Période (2P) · 3ème Période (3P) · 4ème Période (4P)
  Examen 1er Semestre (ExS1) · Total 1er Semestre (TotS1)
  Examen 2ème Semestre (ExS2) · Total 2ème Semestre (TotS2)
  Total Général

CRITICAL — "matieres" array rules:
- Extract ONLY the subject name from the left column ("nom"). Do NOT include max values or notes from that column.
- For each subject, fill in the 9 period/score columns below (null if not found or illegible):

  { "nom": string,
    "coeff": number | null,
    "max_periode": number | null,   // max points per period (often 10 or 20)
    "max_examen":  number | null,   // max points for each semester exam (often 30 or 50)
    "max_total":   number | null,   // max total général for this subject
    "periode_1":   number | null,   // 1ère Période / 1P
    "periode_2":   number | null,   // 2ème Période / 2P
    "periode_3":   number | null,   // 3ème Période / 3P
    "periode_4":   number | null,   // 4ème Période / 4P
    "examen_s1":   number | null,   // Examen 1er Semestre
    "total_s1":    number | null,   // Total 1er Semestre
    "examen_s2":   number | null,   // Examen 2ème Semestre
    "total_s2":    number | null,   // Total 2ème Semestre
    "total_general": number | null  // Total Général pour ce cours
  }

- Include ALL subjects even if all notes are null.
- total_s1 = periode_1 + periode_2 + examen_s1 (compute if missing)
- total_s2 = periode_3 + periode_4 + examen_s2 (compute if missing)
- total_general = total_s1 + total_s2 (compute if missing)

Summary fields (bottom of table):
- "annee_scolaire"  → e.g. "2023-2024"
- "semestre"        → "1er semestre" | "2ème semestre" | "Annuel" (replaces trimestre)
- "total_points"    → sum of all subjects' total_general × coeff
- "total_max"       → maximum possible total
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
    "semestre":        string | null,
    "matieres": [
      {
        "nom": string, "coeff": number|null,
        "max_periode": number|null, "max_examen": number|null, "max_total": number|null,
        "periode_1": number|null, "periode_2": number|null,
        "periode_3": number|null, "periode_4": number|null,
        "examen_s1": number|null, "total_s1": number|null,
        "examen_s2": number|null, "total_s2": number|null,
        "total_general": number|null
      }
    ],
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

/**
 * Build a zone-based prompt when the user has manually defined document regions.
 * Each zone text is already extracted by Vision API and corresponds to a specific
 * semantic area of the bulletin. This allows OpenAI to reconstruct the grades matrix
 * precisely: zone_cours row i + zone_periodes col j = zone_notes cell (i, j).
 *
 * @param {object} zoneTexts - { zone_administrative?, zone_eleve?, zone_cours?,
 *                               zone_periodes?, zone_notes?, zone_total? }
 * @returns {string}
 */
function buildZonePrompt(zoneTexts) {
  const z = zoneTexts || {};

  const section = (title, text) => {
    if (!text || !text.trim()) return '';
    return `\n=== ${title} ===\n${text.trim()}\n`;
  };

  const zonesBlock = [
    section(
      'ZONE ADMINISTRATIVE (Province, Ville, Commune, École)',
      z.zone_administrative
    ),
    section(
      'ZONE INFORMATIONS ÉLÈVE (Élève, Sexe, Né(e)à, Le, Classe, N°Perm)',
      z.zone_eleve
    ),
    section(
      'ZONE LISTE DES COURS — NOMS UNIQUEMENT, une matière par ligne (pas de maxima, pas de notes). Ligne 1 = matière 1, ligne 2 = matière 2…',
      z.zone_cours
    ),
    section(
      'ZONE PÉRIODES — en-têtes de colonnes de gauche à droite. Ordre attendu: 1ère Période, 2ème Période, 3ème Période, 4ème Période, Examen S1, Total S1, Examen S2, Total S2, Total Général',
      z.zone_periodes
    ),
    section(
      'ZONE NOTES — matrice des notes : ligne i = matière i de zone_cours, colonne j = période j de zone_periodes. Colonnes attendues: 1P, 2P, 3P, 4P, ExamS1, TotS1, ExamS2, TotS2, TotalGén',
      z.zone_notes
    ),
    section(
      'ZONE TOTAUX (Total général, Pourcentage, Rang, Mention, Effectif, Directeur, Année scolaire, Semestre)',
      z.zone_total
    ),
  ].filter(Boolean).join('');

  const hasContent = zonesBlock.trim().length > 0;

  return `You are an expert AI specialized in reading DRC (Democratic Republic of Congo) school report cards (bulletins scolaires).

The document has been split into semantic zones by the user and each zone has been OCR'd separately.
Use the zones to reconstruct the full bulletin data accurately.

CRITICAL RULE FOR GRADES TABLE:
- zone_cours lists ONLY subject NAMES (no maxima, no totals) — line i = subject i
- zone_periodes lists column HEADERS (do not include maxima row) — 9 expected columns:
    1ère Période (1P) | 2ème Période (2P) | 3ème Période (3P) | 4ème Période (4P)
    | Examen S1 | Total S1 | Examen S2 | Total S2 | Total Général
- zone_notes is a matrix: row i = subject i from zone_cours, column j = period j from zone_periodes
  Example: zone_cours line 1 = "Maths", zone_periodes col 1 = "1P" → zone_notes row 1 col 1 = Maths 1P grade
- If fewer than 9 period columns are visible, map what is present and leave others null
- total_s1 = periode_1 + periode_2 + examen_s1 (compute if not given)
- total_s2 = periode_3 + periode_4 + examen_s2 (compute if not given)
- total_general = total_s1 + total_s2 (compute if not given)

${hasContent
  ? `Document zones extracted by OCR:\n${zonesBlock}`
  : '[EMPTY — no zones provided. Return nulls with confidence: 0.02]'}

OCR of handwritten text often contains errors. You MUST:
- Correct obvious OCR errors in handwritten words
- Reconstruct partial words from context
- Handle mixed case, accent errors, and spacing issues
- Normalize names to Title Case, sexe to "M" or "F", dates to YYYY-MM-DD

════════════════════════════════════════════════════════
ZONES MAPPING TO FIELDS
════════════════════════════════════════════════════════

zone_administrative → province, ville, commune, etablissement
zone_eleve          → nom_eleve, sexe, lieu_naissance, date_naissance, classe, numero_perm
zone_cours + zone_periodes + zone_notes → matieres[] array (cross-reference the three zones)
zone_total          → total_points, total_max, pourcentage, moyenne, rang, effectif_classe,
                      mention, directeur, observations, annee_scolaire, semestre

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
    "semestre":        string | null,
    "matieres": [
      {
        "nom": string, "coeff": number|null,
        "max_periode": number|null, "max_examen": number|null, "max_total": number|null,
        "periode_1": number|null, "periode_2": number|null,
        "periode_3": number|null, "periode_4": number|null,
        "examen_s1": number|null, "total_s1": number|null,
        "examen_s2": number|null, "total_s2": number|null,
        "total_general": number|null
      }
    ],
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
  "errors": [],
  "confidence": /* 0.0–1.0 based on how many fields were successfully extracted */,
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
      { "name": "semestre",        "type": "string",  "required": false },
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

module.exports = { buildPrompt, buildZonePrompt };

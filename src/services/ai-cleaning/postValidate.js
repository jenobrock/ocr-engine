/**
 * Post-validation rules specialized for school bulletins (bulletin_scolaire).
 * @param {object} cleaned_data
 * @param {object} schema_proposal
 * @returns {{ valid: boolean, errors: string[] }}
 */
function postValidate(cleaned_data, schema_proposal = {}) {
  const errors = [];

  if (!cleaned_data || typeof cleaned_data !== 'object') {
    return { valid: false, errors: ['cleaned_data is missing or invalid'] };
  }

  const tableName = schema_proposal?.table_name || 'unknown';

  // ── Bulletin scolaire specific rules ────────────────────────────────────────
  if (tableName === 'bulletin_scolaire') {

    // ── Header fields ─────────────────────────────────────────────────────────
    if (!cleaned_data.nom_eleve) {
      errors.push('missing_student_name');
    }
    if (!cleaned_data.etablissement) {
      errors.push('missing_school_name');
    }
    if (!cleaned_data.classe) {
      errors.push('missing_class');
    }

    // N° PERM: must be numeric-ish (digits, spaces, dashes allowed)
    if (cleaned_data.numero_perm) {
      const perm = String(cleaned_data.numero_perm).replace(/[\s\-]/g, '');
      if (!/^\d{6,25}$/.test(perm)) {
        errors.push('numero_perm_format_invalide');
      }
    }

    // Sexe
    if (cleaned_data.sexe !== null && cleaned_data.sexe !== undefined) {
      const s = String(cleaned_data.sexe).trim().toUpperCase();
      if (s !== 'M' && s !== 'F') {
        errors.push('sexe_invalide');
      }
    }

    // Date de naissance
    if (cleaned_data.date_naissance) {
      const d = parseDate(cleaned_data.date_naissance);
      const today = new Date();
      if (d && d > today) errors.push('future_date_naissance');
    }

    // Academic year
    if (!cleaned_data.annee_scolaire) {
      errors.push('missing_academic_year');
    }

    // Academic year format (e.g. "2023-2024")
    if (cleaned_data.annee_scolaire) {
      const yearPattern = /^\d{4}-\d{4}$/;
      if (!yearPattern.test(String(cleaned_data.annee_scolaire))) {
        errors.push('invalid_annee_scolaire_format');
      } else {
        const [start, end] = String(cleaned_data.annee_scolaire).split('-').map(Number);
        if (end !== start + 1) errors.push('invalid_annee_scolaire_range');
      }
    }

    // Subjects validation — new per-period structure
    const matieres = cleaned_data.matieres;
    if (matieres !== null && matieres !== undefined) {
      if (!Array.isArray(matieres)) {
        errors.push('matieres_not_array');
      } else if (matieres.length === 0) {
        errors.push('no_subjects_found');
      } else {
        let computedTotal = 0;
        let computedMax = 0;

        for (const mat of matieres) {
          if (!mat.nom) { errors.push('subject_missing_name'); continue; }

          const totalGen = mat.total_general !== null && mat.total_general !== undefined
            ? Number(mat.total_general) : null;

          // Validate that individual period notes are non-negative
          for (const pKey of ['periode_1', 'periode_2', 'periode_3', 'periode_4', 'examen_s1', 'examen_s2']) {
            if (mat[pKey] !== null && mat[pKey] !== undefined) {
              const v = Number(mat[pKey]);
              if (!isNaN(v) && v < 0) {
                errors.push(`negative_note_${mat.nom.replace(/\s+/g, '_').toLowerCase()}_${pKey}`);
              }
            }
          }

          // Accumulate totals for cross-check
          if (totalGen !== null && !isNaN(totalGen)) {
            computedTotal += totalGen;
          }
        }

        // Cross-check global totals if provided (very loose tolerance — handwritten values)
        if (
          cleaned_data.total_points !== null && cleaned_data.total_points !== undefined &&
          computedTotal > 0
        ) {
          const diff = Math.abs(Number(cleaned_data.total_points) - computedTotal);
          if (diff > 20) { // generous tolerance — handwriting OCR errors are common
            errors.push('total_points_mismatch');
          }
        }
      }
    }

    // Percentage bounds
    if (cleaned_data.pourcentage !== null && cleaned_data.pourcentage !== undefined) {
      const pct = Number(cleaned_data.pourcentage);
      if (!isNaN(pct) && (pct < 0 || pct > 100)) {
        errors.push('invalid_pourcentage');
      }
    }

    // Moyenne bounds (out of 20)
    if (cleaned_data.moyenne !== null && cleaned_data.moyenne !== undefined) {
      const moy = Number(cleaned_data.moyenne);
      if (!isNaN(moy) && (moy < 0 || moy > 20)) {
        errors.push('invalid_moyenne');
      }
    }


    // Mention consistency with moyenne
    if (cleaned_data.mention && cleaned_data.pourcentage !== null && cleaned_data.pourcentage !== undefined) {
      const pct = Number(cleaned_data.pourcentage);
      const mention = String(cleaned_data.mention).toLowerCase();
      if (!isNaN(pct)) {
        const expectedMention = getMention(pct);
        if (expectedMention && !mention.includes(expectedMention.toLowerCase())) {
          errors.push('mention_inconsistent_with_score');
        }
      }
    }

  } else {
    // ── Generic rules for non-school documents ───────────────────────────────
    const fields = schema_proposal.fields || [];
    const requiredNames = fields.filter((f) => f.required).map((f) => f.name);
    for (const name of requiredNames) {
      const val = cleaned_data[name];
      if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
        errors.push(`missing_required_${name}`);
      }
    }
    const scoreKeys = ['average', 'score', 'moyenne', 'note', 'average_score', 'score_final'];
    for (const key of scoreKeys) {
      const val = cleaned_data[key];
      if (typeof val === 'number' && (val < 0 || val > 100)) {
        errors.push(`invalid_score_${key}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function getMention(pct) {
  if (pct >= 90) return 'Très bien';
  if (pct >= 80) return 'Bien';
  if (pct >= 70) return 'Assez bien';
  if (pct >= 50) return 'Passable';
  return 'Échec';
}

function parseDate(val) {
  if (val instanceof Date) return val;
  if (typeof val !== 'string') return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

module.exports = { postValidate };

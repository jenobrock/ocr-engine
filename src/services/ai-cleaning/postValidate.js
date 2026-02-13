/**
 * Post-validation rules: reject or flag invalid values.
 * @param {object} cleaned_data - The cleaned_data object from AI
 * @param {object} schema_proposal - The schema_proposal from AI (optional)
 * @returns {{ valid: boolean, errors: string[] }}
 */
function postValidate(cleaned_data, schema_proposal = {}) {
  const errors = [];
  if (!cleaned_data || typeof cleaned_data !== 'object') {
    return { valid: false, errors: ['cleaned_data is missing or invalid'] };
  }

  const fields = schema_proposal.fields || [];
  const requiredNames = (fields.filter((f) => f.required)).map((f) => f.name);

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

  const dateKeys = ['date', 'birth_date', 'date_naissance', 'academic_year', 'year'];
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  for (const key of dateKeys) {
    const val = cleaned_data[key];
    if (val === undefined || val === null) continue;
    const d = parseDate(val);
    if (d && d > today) {
      errors.push(`future_date_${key}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function parseDate(val) {
  if (val instanceof Date) return val;
  if (typeof val !== 'string') return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

module.exports = { postValidate };

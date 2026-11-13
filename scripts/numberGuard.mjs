/**
 * Extracts numeric tokens like $3,240, 3,240, 18%, 2030 from text after removing {placeholders}.
 * @param {string} text
 * @returns {{ raw: string, value: number }[]}
 */
export function extractNumbersFromText(text) {
  const withoutPlaceholders = text.replace(/\{[^}]+\}/g, " ");
  const matches = withoutPlaceholders.match(/\$?\d[\d,]*(?:\.\d+)?%?/g);
  if (!matches) return [];

  return matches.map((raw) => {
    const cleaned = raw.replace(/[$,%]/g, "");
    return { raw, value: Number(cleaned) };
  });
}

/**
 * Extracts placeholder names like {cash}, {plan}, {name} from text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractPlaceholders(text) {
  const names = [];
  const regex = /\{([a-zA-Z0-9_]+)\}/g;
  let match = regex.exec(text);
  while (match !== null) {
    names.push(match[1]);
    match = regex.exec(text);
  }
  return names;
}

function hasOwn(obj, key) {
  return Boolean(obj) && Object.prototype.hasOwnProperty.call(obj, key);
}

function isExemptCount(num) {
  return Number.isInteger(num) && num >= 0 && num <= 4;
}

/**
 * Validates one family JSON object against the number & fact guard rules.
 * @param {any} family
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateFamily(family) {
  const errors = [];
  const facts = family?.facts && typeof family.facts === "object" ? family.facts : {};
  const factValues = new Set(Object.values(facts));

  const checkStrings = [];

  if (typeof family?.headline === "string") {
    checkStrings.push({ field: "headline", text: family.headline, allowName: false, allowPlan: false });
  }

  for (const q of family?.questions ?? []) {
    if (!hasOwn(facts, q.planFactKey)) {
      errors.push(`Question "${q.id}": planFactKey "${q.planFactKey}" is missing from facts.`);
    }
    if (typeof q.prompt === "string") {
      checkStrings.push({
        field: `questions.${q.id}.prompt`,
        text: q.prompt,
        allowName: true,
        allowPlan: false,
      });
    }
    if (typeof q.revealSentence === "string") {
      checkStrings.push({
        field: `questions.${q.id}.revealSentence`,
        text: q.revealSentence,
        allowName: true,
        allowPlan: true,
      });
    }
    for (const [idx, opt] of (q.options ?? []).entries()) {
      if (typeof opt?.label === "string") {
        checkStrings.push({
          field: `questions.${q.id}.options[${idx}].label`,
          text: opt.label,
          allowName: false,
          allowPlan: false,
        });
      }
    }
  }

  for (const rec of family?.recommendations ?? []) {
    if (rec.scoreAfterFactKey !== undefined && !hasOwn(facts, rec.scoreAfterFactKey)) {
      errors.push(
        `Recommendation "${rec.id}": scoreAfterFactKey "${rec.scoreAfterFactKey}" is missing from facts.`
      );
    }
    if (typeof rec.label === "string") {
      checkStrings.push({
        field: `recommendations.${rec.id}.label`,
        text: rec.label,
        allowName: false,
        allowPlan: false,
      });
    }
    if (typeof rec.detail === "string") {
      checkStrings.push({
        field: `recommendations.${rec.id}.detail`,
        text: rec.detail,
        allowName: false,
        allowPlan: false,
      });
    }
  }

  for (const item of checkStrings) {
    for (const placeholder of extractPlaceholders(item.text)) {
      if (placeholder === "name" && item.allowName) continue;
      if (placeholder === "plan" && item.allowPlan) continue;
      if (!hasOwn(facts, placeholder)) {
        errors.push(`${item.field}: placeholder "{${placeholder}}" references a missing fact.`);
      }
    }

    for (const { raw, value } of extractNumbersFromText(item.text)) {
      if (!Number.isFinite(value)) {
        errors.push(`${item.field}: could not parse number "${raw}".`);
        continue;
      }
      if (!factValues.has(value) && !isExemptCount(value)) {
        errors.push(
          `${item.field}: number "${raw}" (${value}) is not in facts and not an exempt count (0-4).`
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

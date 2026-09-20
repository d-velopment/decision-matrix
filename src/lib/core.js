export const METRICS = ['balance', 'range', 'fear', 'uncertainty', 'calm', 'interest', 'result'];

export function normalize(values) {
  if (!values.length || !values.every(Number.isFinite)) throw new TypeError('Expected finite inputs');
  const bounded = values.map(value => Math.min(100, Math.max(1, value)));
  const total = bounded.reduce((sum, value) => sum + value, 0);
  return bounded.map(value => 100 * value / total);
}

// Accepts the original Excel scale. This function deliberately performs no normalization.
export function calculateMetrics(contributions) {
  if (!contributions.length || !contributions.every(Number.isFinite)) throw new TypeError('Expected contributions');
  const count = contributions.length;
  const hi = Math.max(...contributions);
  const lo = Math.min(...contributions);
  const balance = contributions.reduce((sum, value) => sum + value, 0) / count;
  const range = (hi - lo) / count;
  const fear = (hi + lo) / count;
  const uncertainty = lo === 0 ? null : hi / Math.abs(lo);
  const uncertaintyEffective = uncertainty ?? 0.5;
  const calm = hi === 0 ? null : Math.abs(lo) / hi - uncertaintyEffective;
  const calmEffective = calm ?? 0.5;
  const interest = (balance + fear + uncertaintyEffective + calmEffective) * (range + fear);
  const result = balance * interest;
  return { balance, range, fear, uncertainty, calm, interest, result };
}

export function calculateNormalized(weights, negatives, positives) {
  if (!weights.length || negatives.length !== weights.length || positives.length !== weights.length) {
    throw new TypeError('Mismatched matrix');
  }
  const count = negatives[0].length;
  if (!count || ![...negatives, ...positives].every(row => row.length === count)) throw new TypeError('Mismatched options');
  return Array.from({ length: count }, (_, option) => calculateMetrics(weights.map((weight, pair) =>
    (positives[pair][option] - negatives[pair][option]) * weight / 100)));
}

export function calculateDecision(state) {
  const weights = normalize(state.pairs.map(pair => pair.importanceRaw));
  const negatives = state.pairs.map(pair => normalize(state.options.map(option => pair.ratingsByOptionId[option.id].negativeRaw)));
  const positives = state.pairs.map(pair => normalize(state.options.map(option => pair.ratingsByOptionId[option.id].positiveRaw)));
  return calculateNormalized(weights, negatives, positives).map((metrics, index) => ({ ...state.options[index], ...metrics }));
}

// Display-only min/max scaling. Raw metrics and their downstream calculations stay intact.
export function normalizeResults(results) {
  const bounds = Object.fromEntries(METRICS.map(metric => {
    const values = results.map(option => option[metric]).filter(Number.isFinite);
    if (!values.length) return [metric, [null, null]];
    // Bounds are deliberately expanded to whole 100-percentage-point steps.
    // Raw metrics are fractions, so -2.78 becomes -3.00 (-278% -> -300%)
    // and 2.38 becomes 3.00 (238% -> 300%).
    return [metric, [Math.floor(Math.min(...values)), Math.ceil(Math.max(...values))]];
  }));
  return results.map(option => {
    const row = { ...option };
    for (const metric of METRICS) {
      const value = option[metric];
      const [min, max] = bounds[metric];
      row[metric] = !Number.isFinite(value) ? null : min === null || max === null ? null : min === max ? 0.5
        : Math.max(0, Math.min(1, (value - min) / (max - min)));
    }
    return row;
  });
}

// Takes already normalized display results; rank tied whole percentages densely.
export function podium(results) {
  const eligible = results.filter(option => Number.isFinite(option.result))
    .map(option => ({ ...option, score: Math.round(option.result * 100) }))
    .sort((a, b) => b.score - a.score);
  const scores = [...new Set(eligible.map(option => option.score))].slice(0, 3);
  return [0, 1, 2].map(index => ({ place: index + 1, options: eligible.filter(option => option.score === scores[index]) }));
}

export function percentage(value) {
  return value === null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(2)}%`;
}

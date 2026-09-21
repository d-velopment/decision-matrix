/**
 * Validation helpers for suggestion requests and provider responses.
 *
 * Imported by: server/ai.js and server/ai-openai.js.
 */

/** Check that an API field is a string within its protocol length limit. */
const isText = (value, max) => typeof value === 'string' && value.length <= max;

/** Validate a pair collection against the server's input limits. */
const validPairs = (pairs, maxItems) =>
  Array.isArray(pairs) &&
  pairs.length <= maxItems &&
  pairs.every((pair) => pair && isText(pair.negativeLabel, 160) && isText(pair.positiveLabel, 160));

/** Validate a string collection against the server's input limits. */
const validTexts = (values, maxItems, maxLength) =>
  Array.isArray(values) && values.length <= maxItems && values.every((value) => isText(value, maxLength));

/** Validate the user-controlled suggestion request before invoking a provider. */
export function validRequest(value) {
  if (!value || !isText(value.description, 6000) || !['initial', 'more', 'reply'].includes(value.intent)) return false;
  return (
    validTexts(value.options, 6, 160) &&
    validPairs(value.pairs, 30) &&
    validTexts(value.suggestedOptions ?? [], 6, 160) &&
    validPairs(value.suggestedPairs ?? [], 30) &&
    Array.isArray(value.messages) &&
    value.messages.length <= 20 &&
    value.messages.every(
      (message) => message && ['assistant', 'user'].includes(message.role) && isText(message.content, 6000),
    ) &&
    value.dismissed &&
    ['options', 'pairs'].every((type) => validTexts(value.dismissed[type], 100, 321))
  );
}

/** Validate the strict shape returned by an AI suggestion provider. */
export function validSuggestions(value) {
  return (
    value &&
    isText(value.message, 700) &&
    Array.isArray(value.mentionedOptions) &&
    value.mentionedOptions.length <= 6 &&
    value.mentionedOptions.every(
      (item) =>
        item && isText(item.label, 160) && item.label.trim() && isText(item.evidence, 400) && item.evidence.trim(),
    ) &&
    validTexts(value.options, 6, 160) &&
    value.options.every((text) => text.trim()) &&
    validPairs(value.pairs, 30) &&
    value.pairs.every((pair) => pair.negativeLabel.trim() && pair.positiveLabel.trim())
  );
}

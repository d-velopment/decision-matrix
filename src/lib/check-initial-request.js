/**
 * Conservative, dependency-free input screening for browsers or Node.
 * This checks obvious noise, not meaning or whether a decision is sensible.
 * Unknown languages and ambiguous inputs pass. No input is stored or modified.
 * @returns {{action: 'pass'|'clarify', reason: string, message: string|null}}
 */
export function checkInitialRequest(input) {
  const clarify = (reason, message = 'Tell me a little about the choice you’re facing.') =>
    ({ action: 'clarify', reason, message });
  const pass = { action: 'pass', reason: 'no_obvious_issue', message: null };
  const text = typeof input === 'string' ? input.normalize('NFKC').trim() : '';
  if (!text) return clarify('empty', 'What decision are you facing?');

  const withoutLinks = text.replace(/(?:https?:\/\/|www\.)[^\s]+/giu, '');
  if (withoutLinks !== text && !/[\p{L}\p{N}]/u.test(withoutLinks)) return clarify('links_only');
  if (!/\p{L}/u.test(text)) return clarify('no_words');

  const compact = text.replace(/\s/gu, '').toLocaleLowerCase('en');
  if (/^(.)\1{5,}$/u.test(compact)) return clarify('repeated_character');
  const words = text.toLocaleLowerCase('en').match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length >= 6 && new Set(words).size === 1) return clarify('repeated_word');

  // Only exact, context-free English phrases prompt a local clarification.
  // Never require English keywords or a minimum word count to pass.
  const english = text.toLowerCase().replace(/[’]/g, "'").replace(/[.!?,]+$/g, '').trim();
  if (/^(?:help(?: me)?|hi|hello|i (?:don't|do not) know(?: what to do)?|i(?:'m| am) (?:stuck|unsure)|i (?:can't|cannot) decide|what should i do)$/.test(english)) {
    return clarify('needs_context', 'What decision are you facing, and which options are you considering?');
  }
  return pass;
}

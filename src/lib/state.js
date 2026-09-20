import { ensureControls, validControls } from './radial.js';

export const STORAGE_KEY = 'decision-matrix:v1';
export const MAX_OPTIONS = 6;
export const MAX_PAIRS = 30;
const id = () => crypto.randomUUID();
export const key = text => text.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
export const pairKey = pair => `${key(pair.negativeLabel)}|${key(pair.positiveLabel)}`;

export function createState() {
  return { schemaVersion: 1, id: id(), description: '', messages: [], options: [], pairs: [],
    suggestions: { options: [], pairs: [] }, dismissed: { options: [], pairs: [] }, recognizedOptions: [],
    currentStep: 'prepare', preparePage: 'mind', currentPairId: null, inputRevision: 0, lastCalculatedRevision: null };
}
export function touch(state) { state.inputRevision++; }
export function addOption(state, label = '') {
  if (state.options.length >= MAX_OPTIONS) return null;
  const option = { id: id(), label };
  state.options.push(option);
  for (const pair of state.pairs) {
    pair.ratingsByOptionId[option.id] = { negativeRaw: 50, positiveRaw: 50 };
    ensureControls(pair, state.options);
  }
  touch(state);
  return option;
}
export function addPair(state, negativeLabel = '', positiveLabel = '') {
  if (state.pairs.length >= MAX_PAIRS) return null;
  const pair = { id: id(), negativeLabel, positiveLabel, importanceRaw: 50,
    ratingsByOptionId: Object.fromEntries(state.options.map(option => [option.id, { negativeRaw: 50, positiveRaw: 50 }])) };
  state.pairs.push(pair);
  ensureControls(pair, state.options);
  state.currentPairId ??= pair.id;
  touch(state);
  return pair;
}
export function removeOption(state, optionId) {
  const item = state.options.find(option => option.id === optionId);
  if (!item) return;
  state.dismissed.options.push(key(item.label));
  state.options = state.options.filter(option => option.id !== optionId);
  for (const pair of state.pairs) {
    delete pair.ratingsByOptionId[optionId];
    ensureControls(pair, state.options);
  }
  touch(state);
}
export function removePair(state, pairId) {
  const item = state.pairs.find(pair => pair.id === pairId);
  if (!item) return;
  state.dismissed.pairs.push(pairKey(item));
  state.pairs = state.pairs.filter(pair => pair.id !== pairId);
  if (state.currentPairId === pairId) state.currentPairId = state.pairs[0]?.id ?? null;
  touch(state);
}
export function canCalculate(state) {
  return state.options.length >= 2 && state.options.length <= MAX_OPTIONS && state.pairs.length >= 1 && state.pairs.length <= MAX_PAIRS &&
    state.options.every(option => option.label.trim()) && state.pairs.every(pair => pair.negativeLabel.trim() && pair.positiveLabel.trim());
}

export function addMentionedOptions(state, labels) {
  state.recognizedOptions ??= [];
  const seen = new Set([...state.options.map(option => key(option.label)), ...state.dismissed.options, ...state.recognizedOptions]);
  for (const label of labels) {
    if (typeof label !== 'string' || !label.trim() || label.length > 160) continue;
    if (seen.has(key(label))) {
      if (!state.recognizedOptions.includes(key(label))) state.recognizedOptions.push(key(label));
      continue;
    }
    if (!addOption(state, label.trim())) break;
    seen.add(key(label));
    state.recognizedOptions.push(key(label));
  }
  state.suggestions.options = state.suggestions.options.filter(label => !seen.has(key(label)));
}

// Suggestions are merged into a separate inbox, never directly into accepted inputs.
export function mergeSuggestions(state, response, requestedDecisionId) {
  if (state.id !== requestedDecisionId) return false;
  const optionKeys = new Set([...state.options.map(option => key(option.label)), ...state.suggestions.options.map(key), ...state.dismissed.options]);
  for (const label of response.options) if (!optionKeys.has(key(label))) {
    state.suggestions.options.push(label); optionKeys.add(key(label));
  }
  state.suggestions.options = state.suggestions.options.slice(0, MAX_OPTIONS - state.options.length);
  const pairKeys = new Set([...state.pairs.map(pairKey), ...state.suggestions.pairs.map(pairKey), ...state.dismissed.pairs]);
  for (const pair of response.pairs) if (!pairKeys.has(pairKey(pair))) {
    state.suggestions.pairs.push(pair); pairKeys.add(pairKey(pair));
  }
  state.suggestions.pairs = state.suggestions.pairs.slice(0, MAX_PAIRS - state.pairs.length);
  return true;
}

const raw = value => Number.isInteger(value) && value >= 0 && value <= 100;
const text = (value, max) => typeof value === 'string' && value.length <= max;
export function isValidState(state) {
  try {
    if (state.schemaVersion !== 1 || !text(state.id, 100) || !text(state.description, 6000) ||
      !Array.isArray(state.options) || state.options.length > MAX_OPTIONS || !Array.isArray(state.pairs) || state.pairs.length > MAX_PAIRS) return false;
    if (!state.options.every(option => text(option.id, 100) && text(option.label, 160))) return false;
    if (state.recognizedOptions !== undefined && (!Array.isArray(state.recognizedOptions) || !state.recognizedOptions.every(label => text(label, 160)))) return false;
    if (new Set(state.options.map(option => option.id)).size !== state.options.length) return false;
    if (new Set(state.pairs.map(pair => pair.id)).size !== state.pairs.length) return false;
    if (!state.pairs.every(pair => text(pair.id, 100) && text(pair.negativeLabel, 160) && text(pair.positiveLabel, 160) && raw(pair.importanceRaw) && validControls(pair.controls, state.options) &&
      state.options.every(option => raw(pair.ratingsByOptionId[option.id].negativeRaw) && raw(pair.ratingsByOptionId[option.id].positiveRaw)))) return false;
    if (!['prepare', 'evaluate', 'results'].includes(state.currentStep) || !['mind', 'options', 'criteria'].includes(state.preparePage ?? 'mind') || !Number.isInteger(state.inputRevision) || state.inputRevision < 0) return false;
    if (state.lastCalculatedRevision !== null && !Number.isInteger(state.lastCalculatedRevision)) return false;
    if (!Array.isArray(state.messages) || state.messages.length > 100 || !state.messages.every(message => ['user', 'assistant'].includes(message.role) && text(message.content, 6000))) return false;
    if (!Array.isArray(state.suggestions.options) || state.suggestions.options.length > MAX_OPTIONS || !state.suggestions.options.every(label => text(label, 160))) return false;
    if (!Array.isArray(state.suggestions.pairs) || state.suggestions.pairs.length > MAX_PAIRS || !state.suggestions.pairs.every(pair => text(pair.negativeLabel, 160) && text(pair.positiveLabel, 160))) return false;
    if (!['options', 'pairs'].every(type => Array.isArray(state.dismissed[type]) && state.dismissed[type].every(value => text(value, 321)))) return false;
    return true;
  } catch { return false; }
}
export function loadState(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY));
    if (isValidState(parsed)) {
      parsed.recognizedOptions ??= [];
      parsed.preparePage ??= parsed.description.trim() ? 'options' : 'mind';
      for (const pair of parsed.pairs) ensureControls(pair, parsed.options);
      if (!parsed.pairs.some(pair => pair.id === parsed.currentPairId)) parsed.currentPairId = parsed.pairs[0]?.id ?? null;
      if (!canCalculate(parsed) || (parsed.currentStep === 'results' && parsed.inputRevision !== parsed.lastCalculatedRevision)) parsed.currentStep = 'prepare';
      return parsed;
    }
  } catch { /* Unavailable or damaged browser storage must not crash the app. */ }
  return createState();
}
export function saveState(storage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}

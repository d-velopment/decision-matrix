/**
 * Deterministic local suggestion provider used when the app runs in demo mode.
 *
 * Imported by: server/ai.js.
 */

import { extractOptions } from '../src/lib/extract-options.js';

const EN_PAIRS = [
  ['Emotional tension', 'Peace of mind'],
  ['Financial uncertainty', 'Financial stability'],
  ['Distance from loved ones', 'Closeness to loved ones'],
  ['Feeling out of place', 'A sense of belonging'],
  ['Limited opportunities', 'Room to grow'],
  ['Lack of personal time', 'Time for yourself'],
  ['Everyday friction', 'Everyday ease'],
  ['Lack of independence', 'Freedom to choose'],
  ['Fear of the unfamiliar', 'Excitement about discovery'],
  ['Loss of routine', 'A comfortable rhythm'],
  ['Difficulty making connections', 'Meaningful connections'],
  ['Unclear direction', 'A sense of purpose'],
  ['Limited flexibility', 'Ability to change course'],
  ['High demands on energy', 'Energy for what matters'],
];

const RU_PAIRS = [
  ['Душевное напряжение', 'Душевное спокойствие'],
  ['Финансовая неопределённость', 'Финансовая стабильность'],
  ['Удалённость от родных', 'Близость к родным'],
  ['Чувство отчуждения', 'Чувство принадлежности'],
  ['Ограниченность возможностей', 'Возможности для развития'],
  ['Недостаток личного времени', 'Время для себя'],
  ['Бытовые трудности', 'Бытовой комфорт'],
  ['Недостаток самостоятельности', 'Свобода выбора'],
  ['Страх неизвестного', 'Радость открытий'],
  ['Потеря привычного уклада', 'Комфортный ритм жизни'],
  ['Сложность новых контактов', 'Значимые связи'],
  ['Неясность направления', 'Ощущение смысла'],
  ['Ограниченная гибкость', 'Возможность изменить курс'],
  ['Истощение сил', 'Энергия для важного'],
];

/** Build a lowercase pair key for demo suggestion deduplication. */
const pairKey = (pair) => `${pair.negativeLabel.toLowerCase().trim()}|${pair.positiveLabel.toLowerCase().trim()}`;

/** Produce deterministic local suggestions when the app is in demo mode. */
export function demoSuggestions(payload) {
  const mentionedOptions = extractOptions(payload.description).map((label) => ({ label, evidence: label }));
  const conversation = payload.messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join(' ');
  const ru = /[а-яё]/i.test(payload.description + conversation);
  const relocation = /mov|relocat|city|cities|переез|город|лондон|таллин/i.test(payload.description);
  if (payload.description.trim().length < 16 && !payload.messages.some((message) => message.role === 'user')) {
    return {
      message: ru
        ? 'Какой выбор вы рассматриваете и какие варианты у вас уже есть?'
        : 'What decision are you considering, and which options do you already have in mind?',
      mentionedOptions,
      options: [],
      pairs: [],
    };
  }
  const options = ru
    ? relocation
      ? ['Остаться на месте', 'Переехать', 'Попробовать временный переезд']
      : ['Сохранить текущий вариант', 'Выбрать перемены', 'Попробовать постепенно']
    : relocation
      ? ['Stay where I am', 'Make the move', 'Try a temporary move']
      : ['Keep my current direction', 'Make a change', 'Try a gradual transition'];
  const seenOptions = new Set(
    [...payload.options, ...(payload.suggestedOptions ?? []), ...payload.dismissed.options].map((value) =>
      value.toLowerCase().trim(),
    ),
  );
  const seenPairs = new Set(
    [...payload.pairs, ...(payload.suggestedPairs ?? [])].map(pairKey).concat(payload.dismissed.pairs),
  );
  return {
    mentionedOptions,
    message: ru
      ? 'Это примеры для знакомства с приложением. Оставьте подходящие варианты и пары или добавьте свои.'
      : 'These are sample suggestions to explore the app. Keep what fits, edit anything, or add your own.',
    options:
      payload.options.length >= 2 && payload.intent !== 'more'
        ? []
        : options.filter((option) => !seenOptions.has(option.toLowerCase())).slice(0, 6 - payload.options.length),
    pairs: (ru ? RU_PAIRS : EN_PAIRS)
      .map(([negativeLabel, positiveLabel]) => ({ negativeLabel, positiveLabel }))
      .filter((pair) => !seenPairs.has(pairKey(pair)))
      .slice(0, Math.min(payload.intent === 'more' ? 4 : 8, 30 - payload.pairs.length)),
  };
}

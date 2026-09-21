/**
 * JSON schema shared by the OpenAI response contract and server validation.
 *
 * Imported by: server/ai-validation.js and server/ai-openai.js.
 */

const label = { type: 'string', minLength: 1, maxLength: 160 };

export const suggestionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    message: { type: 'string', maxLength: 700 },
    mentionedOptions: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { label, evidence: { type: 'string', minLength: 1, maxLength: 400 } },
        required: ['label', 'evidence'],
      },
    },
    options: { type: 'array', maxItems: 6, items: label },
    pairs: {
      type: 'array',
      maxItems: 30,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { negativeLabel: label, positiveLabel: label },
        required: ['negativeLabel', 'positiveLabel'],
      },
    },
  },
  required: ['message', 'mentionedOptions', 'options', 'pairs'],
};

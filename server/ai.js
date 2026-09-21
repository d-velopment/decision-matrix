/**
 * Public suggestion-provider facade used by the HTTP server and tests.
 *
 * Imported by: server/index.js and tests/server.test.js.
 * Provider implementations live in ai-demo.js and ai-openai.js.
 */

export { suggestionSchema } from './ai-schema.js';
export { validRequest, validSuggestions } from './ai-validation.js';
export { openAISuggestions } from './ai-openai.js';
export { demoSuggestions } from './ai-demo.js';

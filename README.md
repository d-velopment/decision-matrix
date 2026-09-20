# Decision Matrix

A Svelte 5 app for comparing personal decisions. OpenAI can help suggest options and pairs of experiences; all ratings, normalization, ranking, and saved decisions remain in the browser.

Explicit alternatives in the description are added to Your options automatically. Preparation shows pair labels only. Evaluation provides a pair-importance slider and two independent draggable circles: negative (red) and positive (green). Move each center toward an option, or drag option labels around the ring. Touch and keyboard arrows work too. All positions are saved locally.

The final table scales each metric column independently between outward-rounded bounds: the lower bound is floored to a whole 100-percentage-point step and the upper bound is ceiled to one. Thus −278% uses −300% and 238% uses 300%. The podium uses the same normalized Result column. Constant columns display 50%, undefined values remain dashes, and all options can rank, including those whose raw results were negative. Flames are no longer shown. The original formulas remain unchanged internally.

Offline option extraction handles common English/Russian lists and choice phrases. The live OpenAI provider can also extract alternatives from freer descriptions when exploring with AI, with supporting source text. New ideas from AI still require acceptance. Removed or renamed options are not re-added by repeated extraction.

## Run locally

Requires Node.js 22.12+ (or 24+) and npm.

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:3000. No API key is needed: the default **demo mode** returns deterministic example suggestions in English or Russian. These are labelled as sample suggestions, not real AI responses. Manual entry, calculations, and local saving work in either mode.

The app stores only the latest decision in localStorage. “Start over” requires confirmation. Browser storage is specific to the browser and origin (including port).

## Enable OpenAI

Copy `.env.example` to `.env`, then edit locally:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
HOST=127.0.0.1
PORT=3000
```

Restart the Node.js server. The key stays server-side; `.env` is ignored by Git. API use is separately billed by OpenAI. Never put a key in a `VITE_` variable or frontend source.

The server calls the Responses API with a strict JSON schema and `store: false`. It sends the description, relevant conversation, and option/pair labels, not numeric ratings. Live suggestions follow the user's language; the fixed interface is English. Sample mode supports only English/Russian examples. API failures are intentionally silent in the interface and never clear inputs.

The optional live provider has contract tests with a mocked network response. **A real paid OpenAI request has not been made or verified.** The model is configurable; access depends on the API account.

Official implementation references: [Responses structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [Svelte 5 state](https://svelte.dev/docs/svelte/$state).

## Development

Use two terminals:

```sh
npm run dev:server
```

```sh
npm run dev
```

Vite serves the frontend and proxies `/api` to the Node.js server on port 3000. For a production-style local preview, use `npm run build && npm start` instead.

## Tests

```sh
npm test
npx playwright install chromium
npm run test:e2e
```

Alternatively, use an installed Chrome binary without downloading Chromium:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:e2e
```

Browser tests build the app and start a separate demo server on port 3100. Tests never make paid API calls.

- All 28 metrics from the original Excel workbook are checked with a 1e-8 absolute tolerance, bypassing new input processing.
- Separate tests cover hidden input normalization, final column normalization, radial distance scoring, control independence, undefined values, ties, editing, persistence, and input limits.
- Server tests check request validation, private file access, origin checks, and the OpenAI response contract.
- Browser tests cover the complete manual workflow, multilingual sample suggestions, automatic option extraction, independent joysticks, draggable ring labels, touch/keyboard input, refresh, reset, stale requests, silent failures, and mobile layout.

The regression fixture is `tests/fixtures/excel.json`. It contains the supplied workbook's sample inputs and cached outputs. Do not treat those sample data as a new user's answers. To regenerate it, install Python's openpyxl separately and run:

```sh
python3 scripts/extract_excel.py "/path/to/diagram_worcestershire 2023.xlsx"
```

## Structure

```text
src/App.svelte            Preparation, evaluation, AI conversation, and navigation
src/components/          Importance slider, circular joysticks, icons, and results
src/lib/core.js           Pure calculation and ranking functions
src/lib/state.js          Raw input model, additive suggestions, local persistence
src/lib/radial.js         Joystick geometry and distance-to-rating mapping
src/lib/extract-options.js Offline recognition of explicit alternatives
server/index.js          Node.js static server and API endpoint
server/ai.js             OpenAI provider, response schema, demo provider
tests/                   Excel fixture, unit/server tests, Playwright scenarios
SPEC.md                  Agreed behavior and calculation contract
PROGRESS.md              Work state and continuation notes
```

## Scope

This MVP is configured for local use. It does not include public-site authentication or a deployment configuration. Before publicly exposing a server with a paid API key, add access control and an appropriate usage budget. The server currently binds to loopback by default, checks request origin, caps input/output sizes, limits request rate/concurrency, and serves only built frontend assets.

Metric names are preserved from the source workbook. They are mathematical scores of user-entered preferences, not psychological measurements or diagnoses.

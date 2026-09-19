# Decision Matrix — MVP specification

Status: ready for implementation. This document records agreed product behavior. Items explicitly marked **implementation default** are proposed technical choices, not additional user requirements.

## 1. Purpose and scope

Help a person compare 2–6 possible decisions using personally relevant pairs of negative and positive states. AI helps articulate the situation, alternatives, and criteria. The person owns all inputs; deterministic JavaScript computes the results locally.

The app does not require the user to justify, correct, or adjust their choices. Unchanged default sliders are valid. It does not claim that its scores diagnose emotional or clinical conditions.

MVP includes one locally saved decision, AI-assisted setup, manual editing, an importance slider and two circular joysticks per pair, a three-place podium, and an expandable results table. No accounts, cloud decision history, or time-of-day metric.

## 2. Language

- Code, project documentation, and fixed interface copy are English.
- AI conversation and generated option/pair labels use the client's language, inferred from their description and subsequent messages.
- User-entered labels remain exactly as entered; calculation does not depend on their text.
- Fixed metric names: Balance, Range, Fear, Uncertainty, Calm, Interest, Result.

## 3. User flow

### A. Describe and prepare

1. The user describes the decision they cannot make.
   Explicit alternatives in the description appear immediately in Your options. Offline extraction handles common English/Russian lists and choice phrases; the live AI can identify alternatives in more general prose and supplies a verbatim evidence excerpt. Automatically added alternatives remain editable and removable. Repeated extraction must not revive removed alternatives or old names after a user rename.
2. AI may ask clarifying questions when useful.
3. AI proposes both decision options and problem pairs in the same preparation stage. Approving the options first is not required.
4. Each pair has a negative item first and a positive alternative second. They describe independent experiences, not complementary percentages. Both can be strongly associated with the same option.
5. The user can add, delete, and edit every option and pair. Manual add controls are always visible, including before AI responds and when AI is unavailable.
6. Make it personal shows pair labels only, with no sliders. Every new pair starts at the same raw importance of 50. Importance is adjusted later, on the evaluation screen.
7. “Suggest more” generates additional suggestions only. It must never rewrite accepted labels, remove existing entries, reset inputs, or modify weights. AI-invented alternatives require acceptance; alternatives already mentioned by the user are added directly, subject to evidence, deduplication, and the option limit.
8. Maximum accepted content: 6 options and 30 pairs. Minimum for calculation: 2 options and 1 complete pair.

**Implementation defaults:** initially request 8–12 relevant pairs, subject to context and the 30-pair cap. Display extra suggestions for explicit acceptance, with additions constrained by remaining capacity. Avoid duplicate suggestions and previously removed suggestions where possible. A structurally incomplete item prevents calculation with a neutral indication of the missing label; all numeric slider positions are valid.

### B. Evaluate

1. After collecting pairs, the user evaluates options one pair per screen.
2. The screen exposes a single importance slider at the top, then two independent circular controls: reddish for the negative item, greenish for the positive item.
3. Importance endpoints: “Not important” and “Very important”. Each circular control places the option labels around a ring and one draggable joystick in the center. Moving the joystick closer to an option gives that option a larger internal share.
4. Users can drag option labels around their ring to arrange their relative positions. Grip marks and a visible instruction explain this. Both joystick and label movement support touch and keyboard arrows. Home or “Center” returns a joystick to equal preference. No numeric scores are shown on these controls.
5. Every new importance slider starts at 50; every new joystick starts at the center, giving all options raw 50 values. Importance, negative joystick, and positive joystick are independent. Both circles have independent, persisted option arrangements for every pair.
6. The user can freely navigate between pairs and options, return to preparation, and add or remove items before calculating.
7. Input positions persist through navigation. Renaming any option or pair preserves its inputs even if its meaning changes completely.
8. Adding or removing items preserves every remaining raw input. Only the internal normalized values change. Default ring layouts may rebalance for the new number of options; manually arranged surviving labels retain their angles. New labels enter the largest available angular gap in a manually arranged ring.
9. “Calculate” is available when the minimum structurally valid content exists. Users do not need to touch any controls.

**Implementation default:** raw values are integers from 0 to 100, default 50. These numeric values are an internal input representation, not visible percentages. Existing saved slider assessments are preserved when loaded into the new interface. Where saved ratings cannot be represented exactly by a centered joystick, the control states that previous ratings are retained until the user moves it; no silent conversion changes the result.

### C. Results and revision

- Always display the entire podium: places 1, 2, and 3, including empty places.
- Only options with an unrounded Result >= 0 are eligible.
- Rank eligible options by Result rounded to a whole percentage point. Use dense ranking: ties share a place and the next distinct score takes the next place, without gaps.
- Show up to three distinct ranks. Every option tied at a displayed rank is shown there.
- Give the first-place option(s) prominent large labels.
- If no options qualify, show “No options” alongside the empty podium.
- Add a flame to each option whose unrounded Result is strictly greater than 1 (100%). Exactly 100% does not qualify.
- Any flame explanation is tied to the user's assessments, for example “Your ratings indicate a strong desire for change.” It is not a diagnosis or an instruction to change their life.
- An expandable table includes every option, including negative results and options outside the podium, and all seven metrics.
- The table formats numeric results as percentages with two decimal places. Undefined metrics display an em dash.
- The user can return to any input, edit, and calculate again.

**Implementation defaults:** equal-ranked options retain their creation order. Editing after calculation marks the previous results as outdated internally; a new “Calculate” action produces the new results. Returning to editing never resets answers.

## 4. Deterministic calculation contract

### 4.1 Raw versus normalized values

#### Circular distance input

For each negative/positive control, store joystick coordinates inside the unit disc and one angle per option. An option is at `(cos(angle), sin(angle))`. Compute its Euclidean distance `d` from the joystick (0–2) and derive:

```
raw = round(clamp(100 * (1 - d / 2), 0, 100))
```

At the center, every option is distance 1 and receives raw 50. At an option's location it receives raw 100; an exactly opposite option receives raw 0. Then apply the agreed zero-floor and normalization below, independently for each circle. Moving one circle never changes the other circle or the importance value. The distance curve is an implementation choice; the downstream Excel formulas are unchanged.

#### Normalization

Raw user values and normalized calculation values are separate. Persist the raw values and derive normalized values without mutating them.

For each vector of raw inputs x:

```
bounded[i] = min(100, max(1, x[i]))
normalized[i] = 100 * bounded[i] / sum(bounded)
```

Apply this independently to:

1. The importance values across all pairs.
2. Each pair's negative-item association values across all options.
3. Each pair's positive-item association values across all options.

The 1–100 bound is applied BEFORE normalization. Normalized values may fall below 1; do not clamp again or round intermediate values.

Example: visible raw inputs 100, 0, 0, 0 remain unchanged. Internally they become 100, 1, 1, 1 and normalize to approximately 97.0874, 0.9709, 0.9709, 0.9709 percent.

There is no visible percentage redistribution. Moving the joystick or a ring label derives association inputs from geometry, then normalizes them internally. Importance values are independently normalized across pairs. Deleting or adding an item triggers fresh normalization.

### 4.2 Contribution per pair and option

Let n be the number of pairs, W[i] the normalized importance, P[i,j] the normalized positive association, and N[i,j] the normalized negative association. All three are expressed on a 0–100 scale, following the Excel input convention.

```
c[i,j] = (P[i,j] - N[i,j]) * W[i] / 100
```

For each option j:

```
hi = max(c[:,j])
lo = min(c[:,j])

Balance = sum(c[:,j]) / n
Range = (hi - lo) / n
Fear = (hi + lo) / n
Uncertainty = hi / abs(lo)
Calm = abs(lo) / hi - Uncertainty
Interest = (Balance + Fear + Uncertainty + Calm) * (Range + Fear)
Result = Balance * Interest
```

Preserve the formulas and scales from Excel, including division by the number of pairs. Do not replace these formulas with a different weighted-score method or interpret the metric names as validated psychological measurements.

The sum of Balance across options is zero, subject to floating-point precision. Excel's auxiliary check `1 - sum(Balance)` is therefore 1 (displayed as 100%); it is not an additional score or a rescaling of each Balance. This check need not appear in the UI.

### 4.3 Undefined values

- Detect division by zero explicitly; never display NaN or Infinity.
- Undefined Uncertainty displays an em dash and supplies 0.5 to downstream calculations.
- Undefined Calm displays an em dash and supplies 0.5 to downstream calculations.
- Interest and Result use these effective internal values and remain calculable.
- When Calm can be evaluated but Uncertainty is undefined, use Uncertainty's effective value of 0.5 in its formula.
- Store display validity separately from the effective numeric value; do not show the fallback as an observed score.

For a fully uniform default state, all contributions are zero. Balance, Range, Fear, Interest, and Result are zero; Uncertainty and Calm display em dashes. Every option shares first place. No warning or request to revise inputs is shown.

### 4.4 Display and ranking

Scores use the original Excel scale: a numeric Result of 0.5123 displays as 51.23% in the table and ranks as 51%.

Order of operations:

1. Compute full-precision metrics.
2. Exclude Result < 0 from podium eligibility.
3. Determine flame status from Result > 1.
4. Compute the ranking key as `Math.round(Result * 100)` for eligible options.
5. Assign dense ranks to distinct keys in descending order.
6. Format the table separately to two decimal places.

Do not base thresholds on formatted table values. For example, -0.4% is excluded; 100.4% qualifies for a flame even though its ranking key is 100%.

## 5. Editing and persistence

- Save only the latest decision locally in the browser, including description, AI conversation needed to resume, accepted options/pairs, raw inputs, and navigation position.
- Automatically save after changes. Reloading restores the last state without making a new AI request.
- Use stable IDs for options and pairs; labels and array positions must not be storage keys for evaluations.
- A new option receives midpoint association values in both items of every existing pair.
- A new pair receives midpoint importance and midpoint associations for every option.
- Joystick coordinates and option angles are persisted per pair and per pole. Switching between pairs, reloading, or revisiting results restores them.
- Older saved states without control geometry migrate non-destructively. The initial circle is centered and existing non-midpoint ratings stay effective until interaction. Adding/removing options after an assessment likewise preserves surviving ratings until the circle is moved.
- Removing an item deletes only its associated data. All surviving inputs remain unchanged.
- “Start over” asks for confirmation before discarding the saved decision. Cancelling preserves everything; confirming resets the local state.

**Implementation default:** use a versioned localStorage document for the MVP. Do not persist derived percentages as authoritative inputs. Keep previous valid state if a persistence operation fails rather than clearing it.

Suggested conceptual data model:

```
DecisionState
  schemaVersion
  id
  description
  contentLanguage
  messages[]
  options[]: { id, label }
  pairs[]:
    id
    negativeLabel
    positiveLabel
    importanceRaw
    ratingsByOptionId: { negativeRaw, positiveRaw }
    controls:
      negative: { x, y, angles, arranged, legacy }
      positive: { x, y, angles, arranged, legacy }
  recognizedOptions[]
  currentStep
  currentPairId
  inputRevision
  lastCalculatedRevision
```

Derived metrics include both display availability and an effective numeric value where required.

## 6. AI and server boundary

- Frontend: Svelte 5 (confirmed after specification). Use Svelte's reactive state for UI and separate pure JavaScript modules for calculations.
- Build tooling: Vite. Node.js serves the built frontend and same-origin API.
- Development without paid API access: an explicitly labelled demo provider returns sample suggestions. Live OpenAI mode is opt-in via server configuration.

- Use OpenAI through a Node.js server.
- Keep the project's OpenAI API key in server-side environment configuration; never ship it in browser code or browser storage.
- The browser sends the description, relevant conversation, and current labels needed for clarification or suggestions. Numeric evaluations are not required for AI suggestions.
- AI can return clarification questions, explicitly mentioned options with evidence, or proposed options and pairs. It must not compute scores or choose the winner. Application code validates mentioned alternatives before adding them; invented alternatives remain proposals.
- Treat responses as proposals. Validate their structure and enforce item limits in application code.
- Preserve current work while a request runs. If the user edits, deletes, or resets during a request, its eventual response cannot overwrite those changes or reintroduce a previous decision.
- On AI request failure, show no error message or automatic advice. End any loading indicator, preserve state, and leave manual add controls available. The user may retry.
- No application database is required. The browser's local persistence does not imply that data sent to the external AI service stays on the device.

**Implementation defaults:** a single Node.js service serves the client and a same-origin AI endpoint; a configurable OpenAI model is selected during implementation. Validate requests, cap payload/output sizes, and avoid logging decision contents. Responses use structured data. Timeouts release loading state; no silent repeated retries that could duplicate suggestions.

## 7. Verification and acceptance

### A. Legacy Excel parity

Source: `diagram_worcestershire 2023.xlsx`, sheets `Решение` and `Ответы`.

Create a dedicated reference fixture from the source values and formulas. This test path bypasses new input flooring and normalization and verifies the original calculation engine directly. Compare every metric for all four options against independently recomputed Excel formulas and cached outputs, allowing for precision in cached values.

Known reference Result values:

| Option | Numeric Result | Percentage display |
| --- | ---: | ---: |
| Москва | 0.04993333333 | 4.99% |
| Йыхви | 0.6221925926 | 62.22% |
| Таллин | -0.02454044444 | -2.45% |
| Лондон | -0.04155555556 | -4.16% |

Reference weighted contribution totals are 1.05, 8.3, -0.85, and -8.5 respectively; Balance divides those by 15.

**Implementation default:** absolute tolerance 1e-8 for comparison to rounded cached reference metrics. Do not alter formulas merely to match displayed rounded text.

### B. New input rules

Test independently from legacy parity:

- Floor zero to one before normalization; each normalized vector sums to 100 within numerical tolerance.
- Preserve raw 100/0/0/0 while deriving 100/103 and 1/103 shares.
- All-zero and all-midpoint vectors normalize equally.
- Adding, deleting, renaming, and navigating preserve surviving raw inputs.
- Circular distance yields equal values at center for 2–6 options, favors nearer options, and is clamped to the unit disc.
- Dragging option labels changes their angle and derived distance; both poles stay independent.
- Mouse, touch, keyboard, reset-to-center, geometry persistence, and legacy-state migration are covered.
- Explicit alternatives are auto-added once, respecting deletions, renames, and capacity.
- Adding a pair reduces existing normalized weights proportionally without moving sliders.
- Undefined Uncertainty and Calm show dashes and supply 0.5 downstream.
- Fully equal inputs give all options first place with zero Result.
- A single pair and two options produce finite downstream scores under the fallback rules.

### C. Results and interaction

- Negative results never enter the podium; zero is eligible.
- All-negative results leave the full podium visible with “No options”.
- Values rounding to the same whole percent share a rank, and ranks are dense.
- Only three distinct ranks appear; tied entries are never dropped to fit three individual slots.
- Flame threshold uses the unrounded result and is strictly above 100%.
- Table includes all options with two decimal places or the appropriate dash.
- Calculate works with untouched sliders, at least one pair, and 2–6 options.
- Enforce the 30-pair and 6-option maximums for manual and AI additions.
- Language behavior separates English interface copy from user-language content.
- Refresh restores the latest decision, and reset requires confirmation.
- AI failures release loading state without visible error messages or lost inputs.
- Late AI responses cannot overwrite newer edits or a reset decision.

## 8. Implementation sequence

1. Extract the Excel reference fixture and implement pure calculation functions with parity tests.
2. Implement raw state, hidden normalization, edge-case tests, and local persistence.
3. Build preparation with labels only and evaluation with an importance slider and two circular joysticks, plus manual editing.
4. Build podium ranking and the expandable metrics table.
5. Add the Node.js/OpenAI suggestion flow with validated additive responses.
6. Verify the complete workflow, persistence, multilingual content, keyboard use, and failure behavior.

## 9. Explicitly outside the MVP

- Multiple saved decisions, user accounts, and cloud synchronization.
- Automatic factual research about cities or other alternatives.
- Psychological diagnosis, therapeutic advice, or automatic correction of user preferences.
- Additional scoring models, sensitivity analysis, and the spreadsheet's illustrative time metric.
- Changes to the agreed formulas beyond specified input processing and undefined-value handling.

Deployment destination, visual theme, and the specific OpenAI model can be chosen during implementation; they do not change the calculation contract.

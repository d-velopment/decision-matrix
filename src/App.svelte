<script>
  import { onMount, tick } from 'svelte';
  import Icon from './components/Icon.svelte';
  import Slider from './components/Slider.svelte';
  import Joystick from './components/Joystick.svelte';
  import { moveControl, moveOption } from './lib/radial.js';
  import { extractOptions } from './lib/extract-options.js';
  import Results from './components/Results.svelte';
  import { calculateDecision } from './lib/core.js';
  import { createState, loadState, saveState, touch, addOption, addPair, removeOption, removePair, canCalculate, mergeSuggestions, addMentionedOptions, key, pairKey } from './lib/state.js';

  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  let state = $state(loadState(storage));
  let provider = $state('demo');
  let busy = $state(false);
  let reply = $state('');
  let dialog;
  let controller;
  let requestNumber = 0;
  let extractionTimer;
  let saveAvailable = $state(true);
  const ready = $derived(canCalculate(state));
  const pairIndex = $derived(state.pairs.findIndex(pair => pair.id === state.currentPairId));
  const currentPair = $derived(state.pairs[pairIndex]);
  const results = $derived(state.currentStep === 'results' && ready ? calculateDecision(state) : []);
  const suggestionCount = $derived(state.suggestions.options.length + state.suggestions.pairs.length);

  $effect(() => { saveAvailable = saveState(storage, state); });
  onMount(() => {
    fetch('/api/config').then(r => r.json()).then(config => { provider = config.provider; }).catch(() => {});
    return () => { controller?.abort(); clearTimeout(extractionTimer); };
  });

  function changed() { touch(state); }
  function extractMentioned() { clearTimeout(extractionTimer); addMentionedOptions(state, extractOptions(state.description)); }
  function descriptionChanged(event) {
    state.description = event.currentTarget.value;
    changed(); clearTimeout(extractionTimer);
    extractionTimer = setTimeout(extractMentioned, 900);
  }
  function descriptionBlurred() {
    // Let the click that moved focus finish before auto-added rows change layout.
    clearTimeout(extractionTimer);
    extractionTimer = setTimeout(extractMentioned, 150);
  }
  function setStep(step) {
    if (step !== 'prepare' && !ready) return;
    if (step === 'results') state.lastCalculatedRevision = state.inputRevision;
    state.currentStep = step;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function navigatePair(offset) {
    state.currentPairId = state.pairs[(pairIndex + offset + state.pairs.length) % state.pairs.length].id;
  }
  async function addManualOption() {
    const option = addOption(state);
    if (option) { await tick(); document.getElementById(`option-${option.id}`)?.focus(); }
  }
  async function addManualPair() {
    const pair = addPair(state);
    if (pair) { await tick(); document.getElementById(`negative-${pair.id}`)?.focus(); }
  }
  function acceptOption(label) {
    if (state.options.length >= 6) return;
    if (!state.options.some(option => key(option.label) === key(label))) addOption(state, label);
    state.suggestions.options = state.suggestions.options.filter(item => item !== label);
  }
  function acceptPair(pair) {
    if (state.pairs.length >= 30) return;
    if (!state.pairs.some(item => pairKey(item) === pairKey(pair))) addPair(state, pair.negativeLabel, pair.positiveLabel);
    state.suggestions.pairs = state.suggestions.pairs.filter(item => pairKey(item) !== pairKey(pair));
  }
  function acceptAll() {
    for (const option of [...state.suggestions.options]) acceptOption(option);
    for (const pair of [...state.suggestions.pairs]) acceptPair(pair);
  }
  function dismiss(type, item) {
    const itemKey = type === 'options' ? key(item) : pairKey(item);
    state.dismissed[type].push(itemKey);
    state.suggestions[type] = state.suggestions[type].filter(value => (type === 'options' ? key(value) : pairKey(value)) !== itemKey);
  }
  async function suggest(intent = 'initial') {
    if (busy) return;
    if (intent === 'reply' && !reply.trim()) return;
    if (intent === 'reply') { state.messages.push({ role: 'user', content: reply.trim() }); reply = ''; }
    extractMentioned();
    const decisionId = state.id;
    const descriptionAtRequest = state.description;
    const number = ++requestNumber;
    controller = new AbortController();
    const currentController = controller;
    const timeout = setTimeout(() => currentController.abort(), 30000);
    busy = true;
    try {
      const response = await fetch('/api/suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ description: state.description, intent,
          options: state.options.map(option => option.label),
          pairs: state.pairs.map(({ negativeLabel, positiveLabel }) => ({ negativeLabel, positiveLabel })),
          messages: state.messages.slice(-20),
          dismissed: { options: state.dismissed.options.slice(-100), pairs: state.dismissed.pairs.slice(-100) },
        }),
      });
      if (!response.ok) return;
      const data = await response.json();
      if (state.id !== decisionId || number !== requestNumber) return;
      if (!Array.isArray(data.options) || !Array.isArray(data.pairs)) return;
      if (state.description === descriptionAtRequest && Array.isArray(data.mentionedOptions)) {
        const source = [state.description, ...state.messages.filter(message => message.role === 'user').map(message => message.content)].join('\n').toLocaleLowerCase();
        const grounded = data.mentionedOptions.filter(item => item && typeof item.label === 'string' && typeof item.evidence === 'string' && item.evidence.trim() && source.includes(item.evidence.toLocaleLowerCase()));
        addMentionedOptions(state, grounded.map(item => item.label));
      }
      mergeSuggestions(state, data, decisionId);
      if (typeof data.message === 'string' && data.message) state.messages.push({ role: 'assistant', content: data.message });
      state.messages = state.messages.slice(-100);
    } catch { /* Intentionally quiet: manual editing is always available. */ }
    finally { clearTimeout(timeout); if (number === requestNumber) busy = false; }
  }
  function reset() {
    clearTimeout(extractionTimer);
    controller?.abort(); requestNumber++; busy = false; reply = '';
    state = createState(); dialog.close();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
</script>

<svelte:head><title>Decision Matrix — {state.currentStep === 'results' ? 'Your way forward' : 'A little clarity'}</title></svelte:head>

<div class="app-shell">
  <header class="site-header">
    <a class="brand" href="/" aria-label="Decision Matrix home"><img src="/favicon.svg" alt="" width="36" height="36" /><span>decision<span class="brand-light">matrix</span></span></a>
    <div class="header-right"><span class="save-state"><span class="tiny-dot"></span>{saveAvailable ? 'Saved on this device' : 'This session only'}</span><button class="text-button reset" onclick={() => dialog.showModal()}><Icon name="reset" size={16} /><span>Start over</span></button></div>
  </header>

  <nav class="step-nav" aria-label="Decision steps">
    {#each [['prepare', 'Make space'], ['evaluate', 'Weigh it up'], ['results', 'Find clarity']] as [step, label], index}
      <button class:active={state.currentStep === step} aria-current={state.currentStep === step ? 'step' : undefined} disabled={step !== 'prepare' && !ready} onclick={() => setStep(step)}><span class="step-number">0{index + 1}</span>{label}</button>
      {#if index < 2}<span class="step-line"></span>{/if}
    {/each}
  </nav>

  <main>
    {#if state.currentStep === 'prepare'}
      <div class="page-heading"><div><div class="eyebrow"><span class="tiny-dot"></span> BIG DECISIONS. YOUR OWN PERSPECTIVE.</div><h1>A little clarity.<br /><em>A way forward.</em></h1></div><p>Lay out your options. Make room for what matters.<br class="desktop" /> See where your own feelings lead you.</p></div>

      <div class="prepare-layout">
        <aside class="situation-panel">
          <div class="section-label"><span class="section-number">01</span> THE DECISION</div>
          <h2>What’s on your mind?</h2><p class="muted">A move, a new direction, or something entirely your own.</p>
          <label class="sr-only" for="description">Describe your decision</label>
          <textarea id="description" maxlength="6000" rows="6" placeholder="I’m trying to decide whether to…" value={state.description} oninput={descriptionChanged} onblur={descriptionBlurred}></textarea>
          <p class="description-hint">Options you mention appear in your list automatically.</p>
          <button class="button primary full" disabled={busy || !state.description.trim()} onclick={() => suggest(state.options.length || state.pairs.length ? 'more' : 'initial')}><Icon name="spark" />{busy ? 'Thinking…' : 'Explore with AI'}{#if !busy}<Icon name="arrow" size={18} />{/if}</button>
          {#if provider === 'demo'}<p class="demo-note"><span class="demo-dot"></span> Demo mode · sample suggestions, no API calls</p>{:else}<p class="demo-note">Your description is shared with OpenAI for suggestions.</p>{/if}
          {#if state.messages.length}
            <div class="conversation" aria-label="AI conversation" aria-live="polite">
              {#each state.messages as message, index}<div class="message {message.role}"><span>{message.role === 'assistant' ? (provider === 'demo' ? 'SAMPLE ASSISTANT' : 'ASSISTANT') : 'YOU'}</span><p dir="auto">{message.content}</p></div>{/each}
            </div>
            <form class="reply-form" onsubmit={event => { event.preventDefault(); suggest('reply'); }}><label class="sr-only" for="reply">Reply to assistant</label><textarea id="reply" rows="2" maxlength="6000" placeholder="Add a little more context…" bind:value={reply}></textarea><button class="button secondary full" disabled={busy || !reply.trim()} type="submit">Send reply <Icon name="arrow" size={16} /></button></form>
          {/if}
          <div class="quiet-note"><Icon name="shield" size={20} /><p>Your ratings and results stay in your browser. This space is yours to change.</p></div>
        </aside>

        <div class="workspace">
          <section class="options-section" aria-label="Your options">
            <div class="section-header"><div><div class="section-label"><span class="section-number">02</span> THE POSSIBILITIES</div><h2>Your options <span class="count">{state.options.length} / 6</span></h2></div><button class="text-button" onclick={addManualOption} disabled={state.options.length >= 6}><Icon name="plus" size={16} />Add option</button></div>
            <div class="option-list">
              {#each state.options as option, index (option.id)}
                <div class="option-row"><span class="option-letter">{String.fromCharCode(65 + index)}</span><label class="sr-only" for={`option-${option.id}`}>Option {index + 1}</label><input id={`option-${option.id}`} maxlength="160" dir="auto" placeholder="Name this possibility…" bind:value={option.label} oninput={changed} /><button class="icon-button" aria-label={`Remove option ${index + 1}`} onclick={() => removeOption(state, option.id)}><Icon name="close" size={16} /></button></div>
              {:else}<div class="empty-state"><span class="empty-symbol">↗</span><p>A few possibilities.<br /><span>Add your own, or explore with AI.</span></p></div>{/each}
            </div>
          </section>

          <section aria-label="What matters to you">
            <div class="section-header"><div><div class="section-label"><span class="section-number">03</span> WHAT MATTERS</div><h2>Make it personal <span class="count">{state.pairs.length} / 30</span></h2></div><button class="text-button" onclick={addManualPair} disabled={state.pairs.length >= 30}><Icon name="plus" size={16} />Add pair</button></div>
            <p class="section-description">Two sides of an experience. Keep the pairs that feel relevant.</p>
            <div class="pair-list">
              {#each state.pairs as pair, index (pair.id)}
                <article class="pair-card">
                  <div class="pair-card-top"><span class="pair-index">PAIR {String(index + 1).padStart(2, '0')}</span><button class="icon-button" aria-label={`Remove pair ${index + 1}`} onclick={() => removePair(state, pair.id)}><Icon name="close" size={16} /></button></div>
                  <div class="pair-labels"><label><span class="pole-label"><span class="pole-dot negative"></span>Negative</span><input id={`negative-${pair.id}`} aria-label={`Negative state ${index + 1}`} maxlength="160" dir="auto" placeholder="What feels difficult?" bind:value={pair.negativeLabel} oninput={changed} /></label><span class="pair-divider">↔</span><label><span class="pole-label"><span class="pole-dot positive"></span>Positive</span><input aria-label={`Positive state ${index + 1}`} maxlength="160" dir="auto" placeholder="Its positive alternative…" bind:value={pair.positiveLabel} oninput={changed} /></label></div>
                </article>
              {:else}<div class="empty-state pair-empty"><span class="empty-symbol">↔</span><p>What pulls you in? What holds you back?<br /><span>Your first pair starts here.</span></p></div>{/each}
            </div>
          </section>

          {#if suggestionCount}
            <section class="suggestions" aria-label="Suggestions">
              <div class="section-header"><div><div class="eyebrow"><Icon name="spark" size={14} /> A FEW POSSIBILITIES</div><h2>Keep what feels right</h2></div><button class="text-button" onclick={acceptAll} disabled={state.options.length >= 6 && state.pairs.length >= 30}>Add all <Icon name="plus" size={16} /></button></div>
              {#if state.suggestions.options.length}<h3 class="suggestion-type">OPTIONS</h3>{/if}
              {#each state.suggestions.options as option}<div class="suggestion-row"><span dir="auto">{option}</span><button class="small-button" disabled={state.options.length >= 6} onclick={() => acceptOption(option)}>Add</button><button class="icon-button" aria-label={`Dismiss ${option}`} onclick={() => dismiss('options', option)}><Icon name="close" size={16} /></button></div>{/each}
              {#if state.suggestions.pairs.length}<h3 class="suggestion-type">PAIRS</h3>{/if}
              {#each state.suggestions.pairs as pair}<div class="suggestion-row"><span class="suggested-pair" dir="auto">{pair.negativeLabel}<span class="muted"> ↔ </span>{pair.positiveLabel}</span><button class="small-button" disabled={state.pairs.length >= 30} onclick={() => acceptPair(pair)}>Add</button><button class="icon-button" aria-label={`Dismiss ${pair.negativeLabel}`} onclick={() => dismiss('pairs', pair)}><Icon name="close" size={16} /></button></div>{/each}
            </section>
          {/if}
          {#if state.options.length || state.pairs.length}<button class="text-button more-button" disabled={busy || !state.description.trim() || (state.options.length >= 6 && state.pairs.length >= 30)} onclick={() => suggest('more')}><Icon name="spark" size={16} />{busy ? 'Thinking…' : 'Suggest more'}</button>{/if}
          <div class="continue-bar"><p>{ready ? 'Everything is yours to adjust along the way.' : 'Add at least 2 named options and 1 complete pair.'}</p><button class="button primary" disabled={!ready} onclick={() => setStep('evaluate')}>Weigh my options <Icon name="arrow" /></button></div>
        </div>
      </div>
    {:else if state.currentStep === 'evaluate' && currentPair}
      <div class="evaluation-heading"><div><div class="eyebrow"><span class="tiny-dot"></span> ONE EXPERIENCE AT A TIME</div><h1>How does it feel?</h1><p class="muted">Move each center toward the options you associate with that feeling.</p></div><button class="text-button" onclick={() => setStep('prepare')}><Icon name="back" size={16} />Edit options & pairs</button></div>
      <div class="evaluation-layout">
        <aside class="pair-navigation"><div class="section-label">YOUR PAIRS <span class="count">{state.pairs.length}</span></div>{#each state.pairs as pair, index (pair.id)}<button class:chosen={pair.id === state.currentPairId} aria-current={pair.id === state.currentPairId ? 'step' : undefined} onclick={() => { state.currentPairId = pair.id; }}><span>{String(index + 1).padStart(2, '0')}</span><span dir="auto">{pair.positiveLabel}</span>{#if pair.id === state.currentPairId}<Icon name="arrow" size={15} />{/if}</button>{/each}</aside>
        <section class="evaluation-card">
          <div class="evaluation-title"><div class="eyebrow">PAIR {String(pairIndex + 1).padStart(2, '0')} OF {String(state.pairs.length).padStart(2, '0')}</div><h2 dir="auto">{currentPair.negativeLabel}<span>&nbsp;&amp;&nbsp;</span>{currentPair.positiveLabel}</h2></div>
          <div class="importance-block"><h3>How much does this matter to you?</h3><Slider importance label="Importance of this pair" value={currentPair.importanceRaw} onchange={value => { currentPair.importanceRaw = value; changed(); }} /></div>
          <div class="association-columns">
            {#each ['negative', 'positive'] as pole}
              <section class="association-column {pole}"><span class="pole-label"><span class="pole-dot {pole}"></span>{pole === 'negative' ? 'NEGATIVE EXPERIENCE' : 'POSITIVE ALTERNATIVE'}</span><h3 dir="auto">{currentPair[`${pole}Label`]}</h3>
                {#key currentPair.id}
                  <Joystick options={state.options} control={currentPair.controls[pole]} label={currentPair[`${pole}Label`]} tone={pole}
                    onmove={(x, y) => { moveControl(currentPair, state.options, pole, x, y); changed(); }}
                    onrotate={(optionId, radians) => { moveOption(currentPair, state.options, pole, optionId, radians); changed(); }} />
                {/key}
              </section>
            {/each}
          </div>
          <div class="evaluation-footer"><button class="text-button" disabled={pairIndex === 0} onclick={() => navigatePair(-1)}><Icon name="back" size={18} />Previous</button><span class="pair-position">{pairIndex + 1} / {state.pairs.length}</span>{#if pairIndex < state.pairs.length - 1}<button class="button secondary" onclick={() => navigatePair(1)}>Next pair <Icon name="arrow" size={18} /></button>{:else}<button class="button primary" onclick={() => setStep('results')}>Calculate <Icon name="arrow" size={18} /></button>{/if}</div>
        </section>
      </div>
      {#if pairIndex < state.pairs.length - 1}<div class="calculate-anytime"><button class="text-button" onclick={() => setStep('results')}>Calculate now <Icon name="arrow" size={16} /></button></div>{/if}
    {:else if state.currentStep === 'results'}
      <Results {results} onedit={() => setStep('evaluate')} />
    {/if}
  </main>
  <footer class="site-footer"><span>Less noise. More perspective.</span><span>Made for your kind of decision.</span></footer>
</div>

<dialog bind:this={dialog} class="reset-dialog"><form method="dialog"><div class="eyebrow">A FRESH PAGE</div><h2>Start over?</h2><p>This will clear your current decision, options, and ratings from this device.</p><div class="dialog-actions"><button class="button secondary" value="cancel">Keep my decision</button><button class="button primary" type="button" onclick={reset}>Start over</button></div></form></dialog>

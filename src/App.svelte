<script>
  import { onMount, tick } from 'svelte';
  import Icon from './components/Icon.svelte';
  import Slider from './components/Slider.svelte';
  import Joystick from './components/Joystick.svelte';
  import Guide from './components/Guide.svelte';
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
  let aiContextReady = $state(false);
  let reply = $state('');
  let gazeX = $state(0);
  let gazeY = $state(0);
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
    const trackGaze = event => {
      gazeX = Math.max(-2.5, Math.min(2.5, (event.clientX / window.innerWidth - 0.5) * 5));
      gazeY = Math.max(-2, Math.min(2, (event.clientY / window.innerHeight - 0.42) * 4));
    };
    window.addEventListener('pointermove', trackGaze, { passive: true });
    return () => { controller?.abort(); clearTimeout(extractionTimer); window.removeEventListener('pointermove', trackGaze); };
  });

  function changed() { touch(state); }
  function facePartStyle(part) {
    const intensity = Math.max(0, Math.min(100, currentPair?.importanceRaw ?? 50));
    if (part === 'brows') {
      const lift = intensity * 0.05 - 2.5;
      const tilt = 0;
      return `transform:translateY(${lift}px) rotate(${tilt}deg)`;
    }
    const progress = intensity / 100;
    const mouthWidth = 1.2 - 0.2 * progress;
    const mouthRotation = -3 * (1 - progress);
    const skewX = 9 * (1 - progress);
    const skewY = -10 * (1 - progress);
    return `transform:scaleX(${mouthWidth}) rotate(${mouthRotation}deg) skew(${skewX}deg, ${skewY}deg)`;
  }
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
  function setPreparePage(page) {
    state.currentStep = 'prepare';
    state.preparePage = page;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function navigatePair(offset) {
    state.currentPairId = state.pairs[(pairIndex + offset + state.pairs.length) % state.pairs.length].id;
    requestAnimationFrame(() => {
      const target = window.matchMedia('(max-width: 740px)').matches ? '.evaluation-layout' : '.evaluation-heading';
      document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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
  function acceptAllOptions() {
    for (const option of [...state.suggestions.options]) acceptOption(option);
  }
  function acceptAllPairs() {
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
      aiContextReady = Boolean(state.options.length || state.suggestions.options.length);
      if (typeof data.message === 'string' && data.message) state.messages.push({ role: 'assistant', content: data.message });
      state.messages = state.messages.slice(-100);
    } catch { /* Intentionally quiet: manual editing is always available. */ }
    finally { clearTimeout(timeout); if (number === requestNumber) busy = false; }
  }
  function reset() {
    clearTimeout(extractionTimer);
    controller?.abort(); requestNumber++; busy = false; reply = ''; aiContextReady = false;
    state = createState(); dialog.close();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
</script>

<svelte:head><title>Decision Matrix — {state.currentStep === 'results' ? 'Your way forward' : 'A little clarity'}</title></svelte:head>

{#snippet navigation()}
  <nav class="step-nav" aria-label="Decision steps">
    {#each [['home', 'Home'], ['options', 'Options'], ['criteria', 'Personal criteria'], ['evaluate', 'Weigh it up'], ['results', 'Results']] as [step, label], index}
      {@const active = step === 'home' ? state.currentStep === 'prepare' && state.preparePage === 'mind' : step === 'evaluate' || step === 'results' ? state.currentStep === step : state.currentStep === 'prepare' && state.preparePage === step}
      <button class:active={active} aria-current={active ? 'step' : undefined} disabled={(step === 'evaluate' || step === 'results') && !ready} onclick={() => step === 'home' || step === 'options' || step === 'criteria' ? setPreparePage(step === 'home' ? 'mind' : step) : setStep(step)}><span class="step-number">{step === 'home' ? '⌂' : `0${index}`}</span>{label}</button>
      {#if index < 4}<span class="step-line"></span>{/if}
    {/each}
  </nav>
{/snippet}

<div class="app-shell" class:welcome={state.currentStep === 'prepare' && state.preparePage === 'mind'} class:prepare-inner={state.currentStep === 'prepare' && state.preparePage !== 'mind'}>
  <header class="site-header">
    <a class="brand" href="/" aria-label="Decision Matrix home"><img src="/favicon.svg" alt="" width="36" height="36" /><span>decision<span class="brand-light">matrix</span></span></a>
    <div class="header-right"><span class="save-state"><span class="tiny-dot"></span>{saveAvailable ? 'Saved on this device' : 'This session only'}</span><button class="text-button reset" onclick={() => dialog.showModal()}><Icon name="reset" size={16} /><span>Start over</span></button></div>
  </header>

  {#if state.currentStep !== 'prepare' || state.preparePage !== 'mind'}{@render navigation()}{/if}

  <main>
    {#if state.currentStep === 'prepare'}
      <div class="page-heading"><div><div class="eyebrow"><span class="tiny-dot"></span> BIG DECISIONS. YOUR OWN PERSPECTIVE.</div><h1>A little clarity.<br /><em>A way forward.</em></h1></div><div class="page-heading-copy">{#if state.preparePage !== 'mind'}<button class="text-button" onclick={() => setPreparePage('mind')}><Icon name="back" size={16} />Back to What’s on your mind</button>{/if}<p>Start with AI in <em>What’s on your mind?</em><br class="desktop" /> Then lay out your options and make room for what matters.</p></div></div>

      <div class="prepare-layout prepare-{state.preparePage}">
        {#if state.preparePage === 'mind'}
          <div class="welcome-layers" aria-hidden="true">
            <img class="welcome-layer layer-background" src="/guide/layers/background.png" alt="" />
            <img class="welcome-layer layer-character" src="/guide/layers/character.png" alt="" />
            <img class="welcome-layer layer-table" src="/guide/layers/table.png" alt="" />
            <img class="welcome-layer layer-books-right" src="/guide/layers/books-right.png" alt="" />
          </div>
          <p class="scene-slogan scene-slogan-top">Thoughtful<br />choices for<br />a more you.</p>
          <p class="scene-slogan scene-slogan-bottom">A clearer<br />tomorrow<br />starts with a<br />calm today.</p>
        {/if}
        {#if state.preparePage === 'options'}
          <div class="options-illustration" aria-hidden="true">
            <img class="options-layer options-table" src="/guide/layers/table.png" alt="" />
            <img class="options-layer options-character" src="/guide/layers/character-options.png" alt="" />
          </div>
        {/if}
        {#if state.preparePage === 'criteria'}
          <div class="options-illustration criteria-illustration" aria-hidden="true">
            <img class="options-layer options-table" src="/guide/layers/table.png" alt="" />
            <img class="options-layer options-character" src="/guide/layers/character-criteria.png" alt="" />
          </div>
        {/if}
        <aside class:situation-hidden={state.preparePage !== 'mind'} class="situation-panel">
          <div class="section-label"><span class="section-number">01</span> THE DECISION</div>
          <h2>What’s on your mind?</h2><p class="welcome-reassurance">I’ll help you take this one step at a time.</p><p class="muted">Describe the area of life, the decision you’re facing, and the options you’re considering.</p>
          <label class="sr-only" for="description">Describe your decision</label>
          <textarea id="description" maxlength="6000" rows="6" placeholder="I’m trying to decide whether to…" value={state.description} oninput={descriptionChanged} onblur={descriptionBlurred}></textarea>
          <p class="description-hint">Options you mention appear in your list automatically.</p>
          <button class="button primary full" disabled={busy || !state.description.trim()} onclick={() => suggest('initial')}>{busy ? 'Thinking…' : 'Let’s begin'}{#if !busy}<Icon name="arrow" size={18} />{/if}</button>
          {#if provider === 'demo'}<p class="demo-note"><span class="demo-dot"></span> Demo mode · sample suggestions, no API calls</p>{:else}<p class="demo-note">Your description is shared with OpenAI for suggestions.</p>{/if}
          {#if state.messages.length}
            <div class="conversation" aria-label="AI conversation" aria-live="polite">
              {#each state.messages as message, index}<div class="message {message.role}"><span>{message.role === 'assistant' ? (provider === 'demo' ? 'SAMPLE ASSISTANT' : 'ASSISTANT') : 'YOU'}</span><p dir="auto">{message.content}</p></div>{/each}
            </div>
            <form class="reply-form" onsubmit={event => { event.preventDefault(); suggest('reply'); }}><label class="sr-only" for="reply">Reply to assistant</label><textarea id="reply" rows="2" maxlength="6000" placeholder="Add a little more context…" bind:value={reply}></textarea><button class="button secondary full" disabled={busy || !reply.trim()} type="submit">Send reply <Icon name="arrow" size={16} /></button></form>
          {/if}
          {#if state.preparePage === 'mind' && aiContextReady && (state.options.length || state.suggestions.options.length)}
            <div class="options-ready"><p>These possibilities are ready to review.</p><button class="button primary full" onclick={() => setPreparePage('options')}>Fill in Options <Icon name="arrow" size={18} /></button></div>
          {/if}
          <div class="quiet-note"><Icon name="shield" size={20} /><p>Your ratings and results stay in your browser. This space is yours to change.</p></div>
        </aside>

        <div class="workspace">
          {#if suggestionCount}<div class="sr-only" role="region" aria-label="Suggestions">{state.suggestions.options.join(' ')} {state.suggestions.pairs.map(pair => `${pair.negativeLabel} ${pair.positiveLabel}`).join(' ')}</div>{/if}
          <section class:hidden-page={state.preparePage !== 'options'} class="options-section" aria-label="Your options">
            <div class="section-header"><div><div class="section-label"><span class="section-number">02</span> THE POSSIBILITIES</div><h2>Your options <span class="count">{state.options.length} / 6</span></h2></div></div>
            <div class="option-list">
              {#each state.options as option, index (option.id)}
                <div class="option-row"><span class="option-letter">{String.fromCharCode(65 + index)}</span><label class="sr-only" for={`option-${option.id}`}>Option {index + 1}</label><input id={`option-${option.id}`} maxlength="160" dir="auto" placeholder="Name this possibility…" bind:value={option.label} oninput={changed} /><button class="icon-button" aria-label={`Remove option ${index + 1}`} onclick={() => removeOption(state, option.id)}><Icon name="close" size={16} /></button></div>
              {:else}<div class="empty-state"><span class="empty-symbol">↗</span><p>A few possibilities.<br /><span>Add your own, or explore with AI.</span></p></div>{/each}
            </div>
            {#if state.suggestions.options.length}
              <div class="suggestions suggestions-inline" aria-label="Suggestions">
                <div class="section-header"><div><div class="eyebrow"><Icon name="spark" size={14} /> KEEP WHAT FEELS RIGHT</div><h3>Options</h3></div><button class="text-button" aria-label="Add all options" onclick={acceptAllOptions} disabled={state.options.length >= 6}><span aria-hidden="true">Add all</span><Icon name="plus" size={16} /></button></div>
                {#each state.suggestions.options as option}<div class="suggestion-row"><span dir="auto">{option}</span><button class="small-button" disabled={state.options.length >= 6} onclick={() => acceptOption(option)}>Add</button><button class="icon-button" aria-label={`Dismiss ${option}`} onclick={() => dismiss('options', option)}><Icon name="close" size={16} /></button></div>{/each}
              </div>
            {/if}
            <button class="text-button section-add" onclick={addManualOption} disabled={state.options.length >= 6}><Icon name="plus" size={16} />Add option</button>
            <div class="page-next"><p>When your options feel complete, move on to what matters.</p><button class="button primary" disabled={state.options.filter(option => option.label.trim()).length < 2} onclick={() => setPreparePage('criteria')}>Personal criteria <Icon name="arrow" /></button></div>
          </section>

          <section class:hidden-page={state.preparePage !== 'criteria'} aria-label="What matters to you">
            <div class="section-header"><div><div class="section-label"><span class="section-number">03</span> WHAT MATTERS</div><h2>Make it personal <span class="count">{state.pairs.length} / 30</span></h2></div></div>
            <p class="section-description">Two sides of an experience. Keep the pairs that feel relevant.</p>
            <div class="pair-list">
              {#each state.pairs as pair, index (pair.id)}
                <article class="pair-card">
                  <div class="pair-card-top"><span class="pair-index">PAIR {String(index + 1).padStart(2, '0')}</span><button class="icon-button" aria-label={`Remove pair ${index + 1}`} onclick={() => removePair(state, pair.id)}><Icon name="close" size={16} /></button></div>
                  <div class="pair-labels"><label><span class="pole-label"><span class="pole-dot negative"></span>Negative</span><input id={`negative-${pair.id}`} aria-label={`Negative state ${index + 1}`} maxlength="160" dir="auto" placeholder="What feels difficult?" bind:value={pair.negativeLabel} oninput={changed} /></label><span class="pair-divider">↔</span><label><span class="pole-label"><span class="pole-dot positive"></span>Positive</span><input aria-label={`Positive state ${index + 1}`} maxlength="160" dir="auto" placeholder="Its positive alternative…" bind:value={pair.positiveLabel} oninput={changed} /></label></div>
                </article>
              {:else}<div class="empty-state pair-empty"><span class="empty-symbol">↔</span><p>What pulls you in? What holds you back?<br /><span>Your first pair starts here.</span></p></div>{/each}
            </div>
            {#if state.suggestions.pairs.length}
              <div class="suggestions suggestions-inline" aria-label="Pair suggestions">
                <div class="section-header"><div><div class="eyebrow"><Icon name="spark" size={14} /> KEEP WHAT FEELS RIGHT</div><h3>Pairs</h3></div><button class="text-button" aria-label="Add all pairs" onclick={acceptAllPairs} disabled={state.pairs.length >= 30}><span aria-hidden="true">Add all</span><Icon name="plus" size={16} /></button></div>
                {#each state.suggestions.pairs as pair}<div class="suggestion-row"><span class="suggested-pair" dir="auto">{pair.negativeLabel}<span class="muted"> ↔ </span>{pair.positiveLabel}</span><button class="small-button" disabled={state.pairs.length >= 30} onclick={() => acceptPair(pair)}>Add</button><button class="icon-button" aria-label={`Dismiss ${pair.negativeLabel}`} onclick={() => dismiss('pairs', pair)}><Icon name="close" size={16} /></button></div>{/each}
              </div>
            {/if}
            <button class="text-button section-add" onclick={addManualPair} disabled={state.pairs.length >= 30}><Icon name="plus" size={16} />Add pair</button>
            <div class="page-next"><p>Next, we’ll compare how each experience feels for every option.</p><button class="button primary" aria-label="Weigh my options" disabled={!ready} onclick={() => setStep('evaluate')}>Weigh it up <Icon name="arrow" /></button></div>
          </section>

          {#if state.preparePage !== 'mind' && (state.options.length || state.pairs.length)}<button class="text-button more-button" disabled={busy || !state.description.trim() || (state.options.length >= 6 && state.pairs.length >= 30)} onclick={() => suggest('more')}><Icon name="spark" size={16} />{busy ? 'Thinking…' : 'Suggest more'}</button>{/if}
        </div>
      </div>
    {:else if state.currentStep === 'evaluate' && currentPair}
      <div class="evaluation-heading"><div><div class="eyebrow"><span class="tiny-dot"></span> ONE EXPERIENCE AT A TIME</div><h1>How does it feel?</h1><p class="muted">Move each center toward the options you associate with that feeling.</p></div><div class="evaluation-portrait" aria-label="Your perspective changes with importance"><img class="evaluation-character" src="/guide/layers/evaluation-character-base.png" alt="" /><img class="evaluation-feature evaluation-nose" src="/guide/layers/evaluation-nose.png" alt="" /><div class="evaluation-face-overlay"><img class="evaluation-feature evaluation-eye-lids" src="/guide/layers/evaluation-eye-lids.png" alt="" /><img class="evaluation-feature evaluation-brows" style={facePartStyle('brows')} src="/guide/layers/evaluation-brows.png" alt="" /><img class="evaluation-feature evaluation-mouth" style={facePartStyle('mouth')} src="/guide/layers/evaluation-mouth.png" alt="" /><div class="portrait-gaze" style={`--gaze-x:${gazeX}px;--gaze-y:${gazeY}px`} aria-hidden="true"><span></span><span></span></div></div></div></div>
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
  {#if state.currentStep === 'prepare' && state.preparePage === 'mind'}{@render navigation()}{/if}
  <footer class="site-footer"><span>Less noise. More perspective.</span><span>Made for your kind of decision.</span></footer>
</div>

<dialog bind:this={dialog} class="reset-dialog"><form method="dialog"><div class="eyebrow">A FRESH PAGE</div><h2>Start over?</h2><p>This will clear your current decision, options, and ratings from this device.</p><div class="dialog-actions"><button class="button secondary" value="cancel">Keep my decision</button><button class="button primary" type="button" onclick={reset}>Start over</button></div></form></dialog>

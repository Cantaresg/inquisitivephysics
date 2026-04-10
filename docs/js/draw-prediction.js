/**
 * draw-prediction.js — Galileo Lab
 * Handles Stage 1 (ramp prediction) and Stage 3 (bridge Likert MCQ).
 * Depends on: prediction-data.js
 * Optional:   data-logger.js (graceful fallback if absent)
 *
 * Usage — Stage 1:
 *   const pred = DrawPrediction.createRampPrediction(containerEl);
 *   pred.onComplete(response => { ... unlock ramp ... });
 *   // Renders immediately — no .start() needed.
 *
 * Usage — Stage 2 recall banner (call from shell before ramp release):
 *   DrawPrediction.buildRecallBanner(containerEl, storedResponse);
 *
 * Usage — Stage 3:
 *   const bridge = DrawPrediction.createBridge(containerEl);
 *   bridge.onComplete(response => { ... unlock drop lab ... });
 *   // Renders immediately — no .start() needed.
 */

const DrawPrediction = (() => {

  // ── CSS ────────────────────────────────────────────────────────────────────
  const CSS = `
    .pred-wrap {
      font-family: 'DM Sans', sans-serif;
      color: var(--text, #eef2ff);
      max-width: 640px;
      margin: 0 auto;
      padding: 28px 20px 44px;
    }

    /* ── PREAMBLE ── */
    .pred-preamble {
      font-size: 0.88rem;
      line-height: 1.75;
      color: var(--text-mid, #a8b4d0);
      margin-bottom: 22px;
      padding: 14px 18px;
      background: var(--surface, #111520);
      border: 1px solid var(--border, #252d42);
      border-radius: 10px;
      white-space: pre-line;
    }

    /* ── SECTION CARD ── */
    .pred-card {
      background: var(--surface, #111520);
      border: 1px solid var(--border, #252d42);
      border-radius: 14px;
      padding: 24px 24px 20px;
      margin-bottom: 16px;
    }

    .pred-card-label {
      font-family: 'DM Mono', monospace;
      font-size: 0.6rem;
      letter-spacing: 0.1em;
      color: var(--text-dim, #6b7a99);
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    .pred-question {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text, #eef2ff);
      margin-bottom: 18px;
      line-height: 1.5;
    }

    /* ── OPTION ROWS (Stage 1) ── */
    .pred-opts { display: flex; flex-direction: column; gap: 8px; }

    .pred-opt {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 11px 14px;
      border-radius: 9px;
      border: 1.5px solid var(--border2, #2e3850);
      background: var(--bg, #0a0c12);
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
      user-select: none;
    }
    .pred-opt:hover:not(.locked) {
      border-color: var(--accent, #4df0b0);
      background: rgba(77,240,176,0.06);
    }
    .pred-opt.selected {
      border-color: var(--accent, #4df0b0);
      background: rgba(77,240,176,0.10);
    }
    .pred-opt.locked { cursor: default; }

    .pred-radio {
      width: 17px; height: 17px;
      border-radius: 50%;
      border: 1.5px solid var(--border2, #2e3850);
      flex-shrink: 0;
      margin-top: 2px;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
      background: transparent;
    }
    .pred-opt.selected .pred-radio {
      border-color: var(--accent, #4df0b0);
      background: var(--accent, #4df0b0);
    }
    .pred-radio-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: #050a0a;
      display: none;
    }
    .pred-opt.selected .pred-radio-dot { display: block; }

    .pred-opt-text {
      font-size: 0.85rem;
      color: var(--text-mid, #a8b4d0);
      line-height: 1.5;
      flex: 1;
    }
    .pred-opt.selected .pred-opt-text { color: var(--text, #eef2ff); }

    /* Free-text under "Other" */
    .pred-freetext-wrap { display: none; padding: 8px 0 2px; }
    .pred-freetext-wrap.open { display: block; }
    .pred-freetext {
      width: 100%;
      background: var(--surface, #111520);
      border: 1.5px solid var(--border2, #2e3850);
      border-radius: 8px;
      padding: 8px 10px;
      font-family: 'DM Mono', monospace;
      font-size: 0.76rem;
      color: var(--text, #eef2ff);
      resize: vertical;
      min-height: 56px;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.15s;
    }
    .pred-freetext:focus { border-color: var(--purple, #c77dff); }
    .pred-freetext::placeholder { color: var(--text-dim, #6b7a99); }
    .pred-charcount {
      font-family: 'DM Mono', monospace;
      font-size: 0.6rem;
      color: var(--text-dim, #6b7a99);
      text-align: right;
      margin-top: 4px;
      transition: color 0.2s;
    }
    .pred-charcount.ready { color: var(--accent, #4df0b0); }

    /* ── CONFIDENCE SLIDER (Stage 1) ── */
    .pred-confidence {
      margin-top: 20px;
      padding: 16px 18px;
      background: var(--bg, #0a0c12);
      border: 1.5px solid var(--border2, #2e3850);
      border-radius: 10px;
    }
    .pred-conf-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text, #eef2ff);
      margin-bottom: 14px;
    }
    .pred-conf-track {
      display: flex;
      gap: 6px;
      align-items: stretch;
    }
    .pred-conf-btn {
      flex: 1;
      padding: 8px 4px;
      border-radius: 7px;
      border: 1.5px solid var(--border2, #2e3850);
      background: var(--surface, #111520);
      color: var(--text-dim, #6b7a99);
      font-family: 'DM Sans', sans-serif;
      font-size: 0.72rem;
      font-weight: 500;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
      line-height: 1.3;
    }
    .pred-conf-btn:hover:not(.locked) {
      border-color: var(--gold, #ffd166);
      color: var(--gold, #ffd166);
      background: rgba(255,209,102,0.07);
    }
    .pred-conf-btn.selected {
      border-color: var(--gold, #ffd166);
      background: rgba(255,209,102,0.14);
      color: var(--gold, #ffd166);
      font-weight: 700;
    }
    .pred-conf-btn.locked { cursor: default; }

    /* ── LIKERT ROWS (Stage 3) ── */
    .pred-likert-row {
      padding: 14px 0;
      border-bottom: 1px solid var(--border, #252d42);
    }
    .pred-likert-row:last-child { border-bottom: none; }

    .pred-stmt-text {
      font-size: 0.85rem;
      color: var(--text-mid, #a8b4d0);
      line-height: 1.6;
      margin-bottom: 12px;
    }

    .pred-likert-track {
      display: flex;
      gap: 5px;
    }
    .pred-likert-btn {
      flex: 1;
      padding: 7px 3px;
      border-radius: 6px;
      border: 1.5px solid var(--border2, #2e3850);
      background: var(--bg, #0a0c12);
      color: var(--text-dim, #6b7a99);
      font-family: 'DM Sans', sans-serif;
      font-size: 0.65rem;
      font-weight: 500;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
      line-height: 1.3;
    }
    .pred-likert-btn:hover:not(.locked) {
      border-color: var(--accent, #4df0b0);
      color: var(--accent, #4df0b0);
      background: rgba(77,240,176,0.06);
    }
    .pred-likert-btn.selected {
      border-color: var(--accent, #4df0b0);
      background: rgba(77,240,176,0.12);
      color: var(--accent, #4df0b0);
      font-weight: 700;
    }
    .pred-likert-btn.locked { cursor: default; }

    /* Colour overrides for false-end of scale */
    .pred-likert-btn[data-idx="0"].selected,
    .pred-likert-btn[data-idx="1"].selected {
      border-color: var(--red, #ff6b6b);
      background: rgba(255,107,107,0.10);
      color: var(--red, #ff6b6b);
    }
    .pred-likert-btn[data-idx="0"]:hover:not(.locked),
    .pred-likert-btn[data-idx="1"]:hover:not(.locked) {
      border-color: var(--red, #ff6b6b);
      color: var(--red, #ff6b6b);
      background: rgba(255,107,107,0.06);
    }
    /* Middle — neutral gold */
    .pred-likert-btn[data-idx="2"].selected {
      border-color: var(--gold, #ffd166);
      background: rgba(255,209,102,0.10);
      color: var(--gold, #ffd166);
    }
    .pred-likert-btn[data-idx="2"]:hover:not(.locked) {
      border-color: var(--gold, #ffd166);
      color: var(--gold, #ffd166);
      background: rgba(255,209,102,0.06);
    }

    /* ── REVEAL BLOCKS ── */
    .pred-reveal {
      display: none;
      margin-top: 10px;
      padding: 9px 13px;
      border-radius: 7px;
      font-size: 0.78rem;
      line-height: 1.65;
      animation: pred-fadein 0.3s ease;
    }
    .pred-reveal.show { display: block; }
    @keyframes pred-fadein {
      from { opacity:0; transform: translateY(-4px); }
      to   { opacity:1; transform: translateY(0); }
    }
    .pred-reveal.correct {
      background: rgba(77,240,176,0.08);
      border: 1px solid rgba(77,240,176,0.25);
    }
    .pred-reveal.wrong {
      background: rgba(255,107,107,0.07);
      border: 1px solid rgba(255,107,107,0.20);
    }
    .pred-reveal.neutral {
      background: rgba(255,209,102,0.07);
      border: 1px solid rgba(255,209,102,0.20);
    }
    .pred-reveal-badge {
      font-family: 'DM Mono', monospace;
      font-size: 0.58rem;
      letter-spacing: 0.1em;
      font-weight: 600;
      margin-bottom: 5px;
    }
    .pred-reveal.correct .pred-reveal-badge { color: var(--accent, #4df0b0); }
    .pred-reveal.wrong   .pred-reveal-badge { color: var(--red, #ff6b6b); }
    .pred-reveal.neutral .pred-reveal-badge { color: var(--gold, #ffd166); }
    .pred-reveal-text { color: var(--text-mid, #a8b4d0); }

    /* ── FOOTER ── */
    .pred-footer {
      margin-top: 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .pred-hint {
      font-family: 'DM Mono', monospace;
      font-size: 0.68rem;
      color: var(--text-dim, #6b7a99);
    }
    .pred-btn {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.82rem;
      font-weight: 700;
      padding: 9px 22px;
      border-radius: 8px;
      cursor: pointer;
      border: 1.5px solid var(--accent, #4df0b0);
      background: var(--accent, #4df0b0);
      color: #050a0a;
      transition: background 0.15s, transform 0.1s;
    }
    .pred-btn:hover  { background: #38d49a; }
    .pred-btn:active { transform: scale(0.97); }
    .pred-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
      pointer-events: none;
      background: transparent;
      color: var(--text-dim, #6b7a99);
      border-color: var(--border2, #2e3850);
    }
    .pred-cont-btn { display: none; }

    /* ── RECALL BANNER ── */
    .pred-recall {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      background: rgba(255,209,102,0.08);
      border: 1px solid rgba(255,209,102,0.25);
      border-radius: 9px;
      margin-bottom: 14px;
      font-size: 0.8rem;
      color: var(--text-mid, #a8b4d0);
      line-height: 1.5;
    }
    .pred-recall-icon { font-size: 1rem; flex-shrink: 0; }
    .pred-recall strong { color: var(--gold, #ffd166); }

    /* ── COMPLETE BANNER ── */
    .pred-complete {
      text-align: center;
      padding: 28px 20px;
      background: rgba(77,240,176,0.06);
      border: 1px solid rgba(77,240,176,0.18);
      border-radius: 12px;
      margin-top: 8px;
      display: none;
    }
    .pred-complete.visible { display: block; }
    .pred-complete-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--accent, #4df0b0);
      margin-bottom: 6px;
    }
    .pred-complete-sub {
      font-size: 0.8rem;
      color: var(--text-dim, #6b7a99);
      line-height: 1.65;
    }
  `;

  // ── STYLE INJECTION ────────────────────────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('pred-styles')) return;
    const s = document.createElement('style');
    s.id = 'pred-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── LOGGER HELPER ──────────────────────────────────────────────────────────
  function _log(key, data) {
    try {
      if (typeof DataLogger !== 'undefined' && DataLogger.log) {
        DataLogger.log(key, data);
      }
    } catch (e) {}
  }

  // ── SHARED DOM HELPERS ─────────────────────────────────────────────────────
  function _el(tag, props = {}) {
    const e = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'className') e.className = v;
      else if (k === 'textContent') e.textContent = v;
      else if (k === 'innerHTML') e.innerHTML = v;
      else e.setAttribute(k, v);
    });
    return e;
  }

  // ── RECALL BANNER (called by shell at start of Stage 2) ───────────────────
  function buildRecallBanner(containerEl, storedResponse) {
    if (!storedResponse) return;
    const data = PredictionData.rampPrediction;
    const opt  = data.options.find(o => o.id === storedResponse.choice);
    const conf = data.confidence.levels.find(c => c.id === storedResponse.confidence);
    const choiceLabel = opt
      ? (opt.id === 'other' ? `Other — "${storedResponse.other_text || '…'}"` : opt.label)
      : storedResponse.choice;
    const confLabel = conf ? conf.label : storedResponse.confidence;

    const banner = _el('div', { className: 'pred-recall' });
    banner.innerHTML =
      `<span class="pred-recall-icon">💡</span>` +
      `<span>Your prediction: <strong>${choiceLabel}</strong> &nbsp;·&nbsp; ` +
      `Confidence: <strong>${confLabel}</strong></span>`;
    containerEl.insertBefore(banner, containerEl.firstChild);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  STAGE 1 — RAMP PREDICTION
  // ══════════════════════════════════════════════════════════════════════════

  function createRampPrediction(containerEl) {
    _injectStyles();
    const data = PredictionData.rampPrediction;
    let _onComplete = null;
    let _selectedId   = null;
    let _otherText    = '';
    let _confidenceId = null;
    let _submitted    = false;

    // ── BUILD DOM ────────────────────────────────────────────────────────────
    function start() {
      containerEl.innerHTML = '';
      const wrap = _el('div', { className: 'pred-wrap' });

      // Preamble
      const pre = _el('div', { className: 'pred-preamble', textContent: data.preamble });
      wrap.appendChild(pre);

      // Card
      const card = _el('div', { className: 'pred-card' });
      card.appendChild(_el('div', { className: 'pred-card-label', textContent: '▸ Make your prediction' }));
      card.appendChild(_el('div', { className: 'pred-question', textContent: data.question }));

      // Options
      const optsWrap = _el('div', { className: 'pred-opts' });
      data.options.forEach(opt => {
        const row = _el('div', { className: 'pred-opt' });
        row.dataset.id = opt.id;

        const radio = _el('div', { className: 'pred-radio' });
        radio.appendChild(_el('div', { className: 'pred-radio-dot' }));
        row.appendChild(radio);

        const textWrap = _el('div', { style: 'flex:1;min-width:0;' });
        textWrap.appendChild(_el('div', { className: 'pred-opt-text', textContent: opt.label }));

        // "Other" free text
        if (opt.id === 'other') {
          const ftWrap = _el('div', { className: 'pred-freetext-wrap', id: 'pred-ft-wrap' });
          const ta = _el('textarea', {
            className: 'pred-freetext',
            id: 'pred-ft-other',
            placeholder: opt.placeholder || 'Describe your thinking…',
          });
          ta.rows = 3;
          const ctr = _el('div', { className: 'pred-charcount', id: 'pred-ft-ctr' });
          const min = data.ui.otherMinChars;
          ctr.textContent = `${min} characters needed`;
          ta.addEventListener('input', () => {
            _otherText = ta.value;
            const left = Math.max(0, min - ta.value.trim().length);
            ctr.textContent = left ? `${left} more character${left === 1 ? '' : 's'} needed` : '✓ Ready';
            ctr.classList.toggle('ready', !left);
            _updateSubmit();
          });
          ftWrap.appendChild(ta);
          ftWrap.appendChild(ctr);
          textWrap.appendChild(ftWrap);
        }

        row.appendChild(textWrap);

        row.addEventListener('click', () => {
          if (_submitted) return;
          // Deselect all
          optsWrap.querySelectorAll('.pred-opt').forEach(r => r.classList.remove('selected'));
          // Close other ft
          const ft = document.getElementById('pred-ft-wrap');
          if (ft) ft.classList.remove('open');

          row.classList.add('selected');
          _selectedId = opt.id;

          if (opt.id === 'other') {
            const ft2 = document.getElementById('pred-ft-wrap');
            if (ft2) { ft2.classList.add('open'); document.getElementById('pred-ft-other')?.focus(); }
          }
          _updateSubmit();
        });

        optsWrap.appendChild(row);
      });
      card.appendChild(optsWrap);

      // Confidence
      const confWrap = _el('div', { className: 'pred-confidence' });
      confWrap.appendChild(_el('div', { className: 'pred-conf-label', textContent: data.confidence.label }));
      const track = _el('div', { className: 'pred-conf-track' });
      data.confidence.levels.forEach(lvl => {
        const btn = _el('button', { className: 'pred-conf-btn', textContent: lvl.label });
        btn.dataset.id = lvl.id;
        btn.addEventListener('click', () => {
          if (_submitted) return;
          track.querySelectorAll('.pred-conf-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          _confidenceId = lvl.id;
          _updateSubmit();
        });
        track.appendChild(btn);
      });
      confWrap.appendChild(track);
      card.appendChild(confWrap);

      // Footer
      const footer = _el('div', { className: 'pred-footer' });
      const hint   = _el('span', { className: 'pred-hint', id: 'pred-hint', textContent: data.ui.submitLockHint });
      const btn    = _el('button', { className: 'pred-btn', id: 'pred-submit', textContent: data.ui.submitBtn });
      btn.disabled = true;
      btn.addEventListener('click', _submit);
      footer.appendChild(hint);
      footer.appendChild(btn);
      card.appendChild(footer);

      wrap.appendChild(card);

      // Complete banner
      const banner = _el('div', { className: 'pred-complete', id: 'pred-complete' });
      banner.innerHTML =
        `<div class="pred-complete-title">✓ Prediction locked in</div>` +
        `<div class="pred-complete-sub">Head to the ramp experiment to find out.</div>`;
      wrap.appendChild(banner);

      containerEl.appendChild(wrap);
    }

    function _updateSubmit() {
      const btn  = document.getElementById('pred-submit');
      const hint = document.getElementById('pred-hint');
      if (!btn) return;

      if (!_selectedId) {
        btn.disabled = true;
        hint.textContent = data.ui.submitLockHint;
        return;
      }
      if (_selectedId === 'other') {
        const min = data.ui.otherMinChars;
        const txt = (document.getElementById('pred-ft-other')?.value || '').trim();
        if (txt.length < min) {
          btn.disabled = true;
          hint.textContent = 'Please describe your thinking in the text box.';
          return;
        }
      }
      if (!_confidenceId) {
        btn.disabled = true;
        hint.textContent = 'Please rate your confidence.';
        return;
      }
      btn.disabled = false;
      hint.textContent = '';
    }

    function _submit() {
      if (_submitted) return;
      _submitted = true;

      // Lock all inputs
      containerEl.querySelectorAll('.pred-opt').forEach(r => r.classList.add('locked'));
      containerEl.querySelectorAll('.pred-conf-btn').forEach(b => b.classList.add('locked'));
      const submitBtn = document.getElementById('pred-submit');
      if (submitBtn) submitBtn.style.display = 'none';
      const hint = document.getElementById('pred-hint');
      if (hint) hint.textContent = '';

      const response = {
        choice:      _selectedId,
        other_text:  _selectedId === 'other' ? _otherText.trim() : '',
        confidence:  _confidenceId,
        timestamp:   Date.now(),
      };

      _log('ramp_prediction', response);

      // Show completion banner
      const banner = document.getElementById('pred-complete');
      if (banner) banner.classList.add('visible');

      if (_onComplete) _onComplete(response);
    }

    function onComplete(fn) { _onComplete = fn; }
    function reset() { _submitted = false; _selectedId = null; _confidenceId = null; _otherText = ''; start(); }

    // Auto-render immediately on creation
    start();

    return { onComplete, reset };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  STAGE 3 — BRIDGE MCQ (Likert per statement)
  // ══════════════════════════════════════════════════════════════════════════

  function createBridge(containerEl) {
    _injectStyles();
    const data = PredictionData.bridge;
    let _onComplete  = null;
    let _ratings     = {};   // stmtId → likert index (0–4)
    let _freeText    = '';
    let _submitted   = false;

    function start() {
      containerEl.innerHTML = '';
      const wrap = _el('div', { className: 'pred-wrap' });

      // Preamble
      wrap.appendChild(_el('div', { className: 'pred-preamble', textContent: data.preamble }));

      // Card
      const card = _el('div', { className: 'pred-card' });
      card.appendChild(_el('div', { className: 'pred-card-label', textContent: '▸ Bridge question' }));
      card.appendChild(_el('div', { className: 'pred-question', textContent: data.question }));

      // Likert rows
      data.statements.forEach(stmt => {
        const row = _el('div', { className: 'pred-likert-row' });
        row.appendChild(_el('div', { className: 'pred-stmt-text', textContent: stmt.text }));

        const track = _el('div', { className: 'pred-likert-track' });
        data.likertLabels.forEach((lbl, idx) => {
          const btn = _el('button', { className: 'pred-likert-btn', textContent: lbl });
          btn.dataset.idx = idx;
          btn.dataset.stmt = stmt.id;
          btn.addEventListener('click', () => {
            if (_submitted) return;
            track.querySelectorAll('.pred-likert-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            _ratings[stmt.id] = idx;
            _updateSubmit();
          });
          track.appendChild(btn);
        });
        row.appendChild(track);

        // Reveal placeholder
        const rev = _el('div', { className: 'pred-reveal', id: `pred-rev-${stmt.id}` });
        row.appendChild(rev);

        card.appendChild(row);
      });

      // Free text (optional)
      const ftSection = _el('div', { className: 'pred-likert-row' });
      ftSection.appendChild(_el('div', {
        className: 'pred-stmt-text',
        textContent: data.freeText.label,
      }));
      const ta = _el('textarea', {
        className: 'pred-freetext',
        id: 'bridge-free',
        placeholder: data.freeText.placeholder,
      });
      ta.rows = 3;
      ta.style.marginTop = '6px';
      ta.addEventListener('input', () => { _freeText = ta.value; });
      ftSection.appendChild(ta);
      card.appendChild(ftSection);

      // Footer
      const footer = _el('div', { className: 'pred-footer' });
      const hint   = _el('span', { className: 'pred-hint', id: 'bridge-hint', textContent: data.ui.submitLockHint });
      const subBtn = _el('button', { className: 'pred-btn', id: 'bridge-submit', textContent: data.ui.submitBtn });
      subBtn.disabled = true;
      subBtn.addEventListener('click', _submit);

      const contBtn = _el('button', {
        className: 'pred-btn pred-cont-btn',
        id: 'bridge-cont',
        textContent: data.ui.continueBtn,
      });
      contBtn.addEventListener('click', () => {
        if (_onComplete) _onComplete(_buildResponse());
      });

      footer.appendChild(hint);
      footer.appendChild(subBtn);
      footer.appendChild(contBtn);
      card.appendChild(footer);
      wrap.appendChild(card);

      // Complete banner
      const banner = _el('div', { className: 'pred-complete', id: 'bridge-complete' });
      banner.innerHTML =
        `<div class="pred-complete-title">✓ Responses submitted</div>` +
        `<div class="pred-complete-sub">Continue to the Drop Lab to test your ideas experimentally.</div>`;
      wrap.appendChild(banner);

      containerEl.appendChild(wrap);
    }

    function _updateSubmit() {
      const btn  = document.getElementById('bridge-submit');
      const hint = document.getElementById('bridge-hint');
      if (!btn) return;
      const allRated = data.statements.every(s => _ratings[s.id] !== undefined);
      btn.disabled = !allRated;
      hint.textContent = allRated ? '' : data.ui.submitLockHint;
    }

    function _buildResponse() {
      return {
        ratings:   { ..._ratings },
        free_text: _freeText.trim(),
        timestamp: Date.now(),
        // Computed scoring
        scores: data.statements.map(stmt => {
          const rated = _ratings[stmt.id] ?? -1;
          const inTarget = stmt.target.includes(rated);
          return { id: stmt.id, rated, correct: inTarget };
        }),
      };
    }

    function _submit() {
      if (_submitted) return;
      _submitted = true;

      containerEl.querySelectorAll('.pred-likert-btn').forEach(b => b.classList.add('locked'));
      const subBtn = document.getElementById('bridge-submit');
      if (subBtn) subBtn.style.display = 'none';
      const hint = document.getElementById('bridge-hint');
      if (hint) hint.textContent = '';

      const response = _buildResponse();
      _log('ramp_discovery', response);

      // Cascade reveal — 150ms per statement
      data.statements.forEach((stmt, i) => {
        setTimeout(() => _revealStatement(stmt), i * 150);
      });

      // Show continue after all reveals
      setTimeout(() => {
        const contBtn = document.getElementById('bridge-cont');
        if (contBtn) contBtn.style.display = 'inline-block';
        const banner = document.getElementById('bridge-complete');
        if (banner) banner.classList.add('visible');
      }, data.statements.length * 150 + 300);
    }

    function _revealStatement(stmt) {
      const rev   = document.getElementById(`pred-rev-${stmt.id}`);
      if (!rev) return;
      const rated = _ratings[stmt.id] ?? -1;
      const inTarget = stmt.target.includes(rated);

      // Determine colour:
      // inTarget → correct, else wrong
      // Middle rating (2 = "Not sure") on a correct stmt → neutral nudge
      let cls = inTarget ? 'correct' : 'wrong';
      let badge = inTarget ? '▸ GOOD THINKING' : '▸ WORTH RECONSIDERING';

      if (!inTarget && rated === 2) {
        cls = 'neutral';
        badge = '▸ THINK IT THROUGH';
      }

      rev.className = `pred-reveal ${cls} show`;
      rev.innerHTML =
        `<div class="pred-reveal-badge">${badge}</div>` +
        `<div class="pred-reveal-text">${stmt.explanation}</div>`;
    }

    function onComplete(fn) { _onComplete = fn; }
    function reset() {
      _submitted = false;
      _ratings   = {};
      _freeText  = '';
      start();
    }

    // Auto-render immediately on creation
    start();

    return { onComplete, reset };
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────
  return {
    createRampPrediction,
    createBridge,
    buildRecallBanner,
  };

})();

if (typeof module !== 'undefined') module.exports = DrawPrediction;

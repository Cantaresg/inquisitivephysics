/**
 * stage-manager.js — Galileo Lab sequential stage controller
 * Depends on: data-logger.js
 *
 * Stages:
 *   0 — Hook        : feather vs iron ball drop, bias activation
 *   1 — Prediction  : ramp prediction, hard locked before release
 *   2 — Ramp Lab    : experiment, vary L, record data
 *   3 — Bridge      : MCQ explaining the disconnect
 *   4 — Drop Lab    : three paper demos with air resistance
 *   5 — History     : Galileo payoff card
 */

const StageManager = (() => {

  // ── STATE ──────────────────────────────────────────────────────────────────
  const TOTAL_STAGES = 6;

  let _state = {
    current          : -1,       // -1 = session setup not done yet
    unlocked         : [],       // stages that have been visited
    completedStages  : [],       // stages fully completed (can't go back)
    onStageChange    : null,     // callback(newStage, prevStage)
  };

  // Stage metadata — used by UI to know what to render
  const STAGE_META = [
    {
      id       : 0,
      key      : 'hook',
      title    : 'The Hook',
      subtitle : 'Watch carefully.',
      hint     : null,
      canSkip  : false,
    },
    {
      id       : 1,
      key      : 'ramp_prediction',
      title    : 'Make Your Prediction',
      subtitle : 'Before you run the experiment.',
      hint     : 'You must make a prediction before the ramp is unlocked.',
      canSkip  : false,
    },
    {
      id       : 2,
      key      : 'ramp_lab',
      title    : 'Ramp Experiment',
      subtitle : 'Vary the length. Time the runs.',
      hint     : null,
      canSkip  : false,
    },
    {
      id       : 3,
      key      : 'bridge',
      title    : 'Think About It',
      subtitle : 'What explains what you just saw?',
      hint     : 'Answer the question to continue.',
      canSkip  : false,
    },
    {
      id       : 4,
      key      : 'drop_lab',
      title    : 'Drop Experiments',
      subtitle : 'Now with air resistance.',
      hint     : null,
      canSkip  : false,
    },
    {
      id       : 5,
      key      : 'history',
      title    : 'The Real Story',
      subtitle : 'What Galileo actually did.',
      hint     : null,
      canSkip  : false,
    },
  ];

  // ── HARD LOCK RULES ────────────────────────────────────────────────────────
  // Each stage has a gate — a condition that must be true before advancing.
  // These return { allowed: bool, reason: string }

  const GATES = {

    // Can always enter stage 0 after session init
    0: () => ({ allowed: true, reason: '' }),

    // Stage 1 (prediction) requires stage 0 completed
    1: () => {
      const ok = _state.completedStages.includes(0);
      return { allowed: ok, reason: ok ? '' : 'Watch the hook first.' };
    },

    // Stage 2 (ramp lab) requires ramp_prediction logged
    2: () => {
      const response = DataLogger.getResponse('ramp_prediction');
      const ok = response !== null;
      return {
        allowed : ok,
        reason  : ok ? '' : 'You must make your prediction before running the experiment.',
      };
    },

    // Stage 3 (bridge) requires ramp_discovery logged
    3: () => {
      const response = DataLogger.getResponse('ramp_discovery');
      const ok = response !== null;
      return {
        allowed : ok,
        reason  : ok ? '' : 'Complete the ramp experiment and record your discovery first.',
      };
    },

    // Stage 4 (drop lab) requires bridge_question logged
    4: () => {
      const response = DataLogger.getResponse('bridge_question');
      const ok = response !== null;
      return {
        allowed : ok,
        reason  : ok ? '' : 'Answer the bridge question to continue.',
      };
    },

    // Stage 5 (history) requires all drop demos completed
    5: () => {
      const required = ['drop_paper_flat', 'drop_paper_crumpled', 'drop_paper_book', 'final_explanation'];
      const missing  = required.filter(id => DataLogger.getResponse(id) === null);
      const ok       = missing.length === 0;
      return {
        allowed : ok,
        reason  : ok ? '' : `Complete all drop experiments first. (${missing.length} remaining)`,
      };
    },
  };

  // ── SESSION SETUP ──────────────────────────────────────────────────────────
  // Must be called before any stage transitions.
  // Returns true if setup successful.
  function setupSession(sessionKey, studentAlias) {
    if (!sessionKey || !sessionKey.trim()) {
      return { ok: false, reason: 'Please enter the session key provided by your teacher.' };
    }
    if (!studentAlias || !studentAlias.trim()) {
      return { ok: false, reason: 'Please enter your name or alias.' };
    }
    DataLogger.initSession(sessionKey, studentAlias);
    _state.current = -1;
    _state.unlocked = [];
    _state.completedStages = [];
    return { ok: true };
  }

  // ── ADVANCE ────────────────────────────────────────────────────────────────
  // Attempt to move to a specific stage.
  // Returns { ok: bool, reason: string }
  function goToStage(targetStage) {
    if (_state.current === -1) {
      return { ok: false, reason: 'Session not initialised. Enter session key first.' };
    }
    if (targetStage < 0 || targetStage >= TOTAL_STAGES) {
      return { ok: false, reason: `Invalid stage ${targetStage}.` };
    }
    // Can never go backwards
    if (targetStage < _state.current) {
      return { ok: false, reason: 'You cannot go back to a previous stage.' };
    }
    // Check gate
    const gate = GATES[targetStage]();
    if (!gate.allowed) {
      return { ok: false, reason: gate.reason };
    }
    const prev = _state.current;
    _state.current = targetStage;
    if (!_state.unlocked.includes(targetStage)) {
      _state.unlocked.push(targetStage);
    }
    _persist();
    if (_state.onStageChange) {
      _state.onStageChange(targetStage, prev);
    }
    console.log(`[StageManager] → Stage ${targetStage} (${STAGE_META[targetStage].key})`);
    return { ok: true, reason: '' };
  }

  // Convenience: advance to next stage
  function advance() {
    const next = _state.current + 1;
    if (next >= TOTAL_STAGES) {
      return { ok: false, reason: 'Lab complete.' };
    }
    return goToStage(next);
  }

  // Mark current stage as complete (called by UI when student clicks Continue)
  function completeCurrentStage() {
    const s = _state.current;
    if (s < 0) return;
    if (!_state.completedStages.includes(s)) {
      _state.completedStages.push(s);
    }
    _persist();
    console.log(`[StageManager] Stage ${s} completed.`);
  }

  // Start the lab — move from setup screen to stage 0
  function startLab() {
    if (_state.current !== -1) return { ok: false, reason: 'Already started.' };
    _state.current = 0;
    _state.unlocked = [0];
    _persist();
    if (_state.onStageChange) _state.onStageChange(0, -1);
    return { ok: true };
  }

  // ── QUERY ──────────────────────────────────────────────────────────────────
  function currentStage()  { return _state.current; }
  function currentMeta()   { return _state.current >= 0 ? STAGE_META[_state.current] : null; }
  function isCompleted(s)  { return _state.completedStages.includes(s); }
  function isUnlocked(s)   { return _state.unlocked.includes(s); }
  function isSetup()       { return _state.current >= 0; }

  // Progress 0.0–1.0 for a progress bar
  function progress() {
    if (_state.current < 0) return 0;
    return (_state.current) / (TOTAL_STAGES - 1);
  }

  // Can the next stage button be shown?
  function canAdvance() {
    const next = _state.current + 1;
    if (next >= TOTAL_STAGES) return false;
    return GATES[next]().allowed;
  }

  function whyBlocked() {
    const next = _state.current + 1;
    if (next >= TOTAL_STAGES) return 'Lab complete.';
    return GATES[next]().reason;
  }

  // ── CALLBACKS ──────────────────────────────────────────────────────────────
  function onStageChange(fn) {
    _state.onStageChange = fn;
  }

  // ── PERSISTENCE ────────────────────────────────────────────────────────────
  function _persist() {
    try {
      sessionStorage.setItem('galileo_stages', JSON.stringify({
        current         : _state.current,
        unlocked        : _state.unlocked,
        completedStages : _state.completedStages,
      }));
    } catch(e) {}
  }

  function restoreFromStorage() {
    try {
      const raw = sessionStorage.getItem('galileo_stages');
      if (raw) {
        const saved = JSON.parse(raw);
        _state.current         = saved.current;
        _state.unlocked        = saved.unlocked;
        _state.completedStages = saved.completedStages;
        console.log(`[StageManager] Restored at stage ${_state.current}`);
        return true;
      }
    } catch(e) {}
    return false;
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────
  return {
    STAGE_META,
    TOTAL_STAGES,
    setupSession,
    startLab,
    goToStage,
    advance,
    completeCurrentStage,
    currentStage,
    currentMeta,
    isCompleted,
    isUnlocked,
    isSetup,
    progress,
    canAdvance,
    whyBlocked,
    onStageChange,
    restoreFromStorage,
  };

})();

if (typeof module !== 'undefined') module.exports = StageManager;

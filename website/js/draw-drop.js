/**
 * draw-drop.js — Stage 4 Drop Lab
 * Three sequential paper demonstrations, each preceded by a prediction.
 * Depends on: physics.js
 *
 * Pedagogical sequence:
 *   Demo 1 — Flat paper vs. book         → air resistance depends on shape
 *   Demo 2 — Flat paper vs. crumpled     → same mass, different drag
 *   Demo 3 — Flat paper ON book          → sheltered from air → land together (payoff!)
 *
 * Usage:
 *   const drop = DrawDrop.create(canvas);
 *   drop.onPredictionNeeded((demoIndex, onAnswered) => { ... show MCQ ... });
 *   drop.onObservationNeeded((demoIndex, landData, onAnswered) => { ... show MCQ ... });
 *   drop.onAllComplete(() => { ... advance to Stage 5 ... });
 *   drop.startDemo(0);
 */

const DrawDrop = (() => {

  // ── DROP COLUMN GEOMETRY ───────────────────────────────────────────────────
  const DROP_HEIGHT_M = 3.0;   // simulated metres
  const SIM_SCALE     = 80;    // px per metre  →  3m × 80 = 240px column
  const DROP_PX       = DROP_HEIGHT_M * SIM_SCALE;

  // Lane x-fractions (left = A, right = B)
  const LANE_A = 0.30;
  const LANE_B = 0.70;

  // ── DEMO DEFINITIONS ──────────────────────────────────────────────────────
  // Each demo specifies two objects and whether air resistance is active.
  // 'combined' means objectB rides on top of objectA (demo 3).
  const DEMOS = [
    {
      index      : 0,
      title      : 'Demo 1 — Shape vs. Air',
      laneAKey   : 'paperFlat',
      laneBKey   : 'book',
      combined   : false,
      airOn      : true,
      laneALabel : 'Flat Paper',
      laneBLabel : 'Textbook',
      // What the student is asked BEFORE the drop
      predictionPrompt : 'Which will hit the ground first?',
      predictionOptions: ['Flat Paper', 'Textbook', 'Same time'],
      // What the student is asked AFTER both land
      observationPrompt: 'What did you observe? Why did they land at different times?',
    },
    {
      index      : 1,
      title      : 'Demo 2 — Same Mass, Different Shape',
      laneAKey   : 'paperFlat',
      laneBKey   : 'paperCrumpled',
      combined   : false,
      airOn      : true,
      laneALabel : 'Flat Paper',
      laneBLabel : 'Crumpled Paper',
      predictionPrompt : 'Both papers have the same mass. Which lands first?',
      predictionOptions: ['Flat Paper', 'Crumpled Paper', 'Same time'],
      observationPrompt: 'Same mass — but different landing times. What changed?',
    },
    {
      index      : 2,
      title      : 'Demo 3 — Paper on Book',
      laneAKey   : 'paperOnBook',   // combined object (paper resting on book face)
      laneBKey   : 'book',
      combined   : true,            // laneA is "paper on book" — draws stacked
      airOn      : true,
      laneALabel : 'Paper on Book',
      laneBLabel : 'Book alone',
      predictionPrompt : 'Now the paper sits on top of the book. Which lands first?',
      predictionOptions: ['Paper on Book', 'Book alone', 'Same time'],
      observationPrompt: 'What happened this time? How does this connect to the ramp experiment?',
    },
  ];

  // Inline book object (not in Physics.OBJECTS — purely visual/mass reference)
  const BOOK_OBJ = {
    label    : 'Textbook',
    mass     : 0.200,    // kg
    dragArea : 0.062,    // m²  (A5 face)
    Cd       : 1.17,     // flat plate
    trackColor: '#4df0b0',
    color    : '#2a4878',
    shine    : '#4a6898',
  };

  // ── FACTORY ───────────────────────────────────────────────────────────────
  function create(canvas) {
    const ctx = canvas.getContext('2d');
    // ── COMPAT HELPER — roundRect polyfill ───────────────────────────────────
    function _rrect(c, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      c.beginPath();
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y);
      c.arcTo(x + w, y,     x + w, y + r,     r);
      c.lineTo(x + w, y + h - r);
      c.arcTo(x + w, y + h, x + w - r, y + h, r);
      c.lineTo(x + r, y + h);
      c.arcTo(x,      y + h, x,        y + h - r, r);
      c.lineTo(x,     y + r);
      c.arcTo(x,      y,     x + r,    y,         r);
      c.closePath();
    }

    // ── DPI-AWARE SIZING ────────────────────────────────────────────────────
    // Always work in logical (CSS) pixels so fonts stay sharp on HiDPI screens.
    let W = 0;
    let H = 0;
    let _running     = false;
    let _rafId       = null;
    let _initialised = false;

    function _syncSize() {
      const dpr  = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const lw   = Math.round(rect.width  || canvas.offsetWidth  || 800);
      const lh   = Math.round(rect.height || canvas.offsetHeight || 600);
      // Assigning canvas.width/height resets the backing store AND wipes all
      // transforms to identity — so we must always re-apply the scale after.
      // Using setTransform() is explicit and never stacks accidentally.
      canvas.width  = lw * dpr;
      canvas.height = lh * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      W = lw;
      H = lh;
    }

    _syncSize();
    // Re-sync on window resize — setTransform is safe to call every time
    const _resizeObs = window.ResizeObserver
      ? new ResizeObserver(() => {
          _syncSize();
          if (_initialised && !_running) {
            // Redraw static frame at new size
            cancelAnimationFrame(_rafId);
            _rafId = requestAnimationFrame(ts => _drawStatic(ts));
          }
        })
      : null;
    if (_resizeObs) _resizeObs.observe(canvas);

    // Callbacks set by host
    let _onPredictionNeeded  = null;
    let _onObservationNeeded = null;
    let _onAllComplete       = null;

    // Current demo state
    let _demoIndex   = -1;      // which demo is active
    let _phase       = 'idle';  // idle | predict | countdown | dropping | landed | observe | done
    let _lastTs      = null;

    // Per-drop physics state
    let _objA = { s: 0, v: 0, landed: false, landT: null };
    let _objB = { s: 0, v: 0, landed: false, landT: null };
    let _simT = 0;

    // Countdown
    let _countdown   = 3;
    let _countdownTs = null;

    // Post-land hold before observation callback fires
    let _landedTs    = null;
    const LAND_PAUSE = 1800; // ms

    // Wobble for flat paper (horizontal tumble)
    let _wobbleA = 0;
    let _wobbleB = 0;

    // Completed demos tracker
    const _completed = [];   // array of { index, tA, tB }

    // ── LAYOUT ──────────────────────────────────────────────────────────────
    function _topY()    { return H * 0.20; }  // more header room for title + labels
    function _bottomY() { return _topY() + DROP_PX; }
    function _laneAX()  { return W * LANE_A; }
    function _laneBX()  { return W * LANE_B; }
    function _simToY(s) { return _topY() + s * SIM_SCALE; }

    // ── PUBLIC CONTROLS ──────────────────────────────────────────────────────

    function onPredictionNeeded(fn)  { _onPredictionNeeded  = fn; }
    function onObservationNeeded(fn) { _onObservationNeeded = fn; }
    function onAllComplete(fn)       { _onAllComplete        = fn; }

    // Start a specific demo (0, 1, or 2). Called after host unlocks it.
    function startDemo(index) {
      if (index < 0 || index >= DEMOS.length) return;
      _demoIndex = index;
      _resetPhysics();
      _phase       = 'predict';
      _ensureLoop();
      // Ask for prediction immediately
      if (_onPredictionNeeded) {
        _onPredictionNeeded(index, () => {
          // onAnswered callback — transition to countdown
          _phase       = 'countdown';
          _countdown   = 3;
          _countdownTs = null;
        });
      } else {
        // No host callback — skip straight to countdown
        _phase       = 'countdown';
        _countdown   = 3;
        _countdownTs = null;
      }
    }

    function reset() {
      _resetPhysics();
      _phase     = 'idle';
      _demoIndex = -1;
      if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
      _rafId = requestAnimationFrame(ts => { _drawStatic(ts); });
    }

    function destroy() {
      if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
      if (_resizeObs) _resizeObs.disconnect();
    }

    // ── INTERNAL ────────────────────────────────────────────────────────────

    function _resetPhysics() {
      _objA     = { s: 0, v: 0, landed: false, landT: null };
      _objB     = { s: 0, v: 0, landed: false, landT: null };
      _simT     = 0;
      _lastTs   = null;
      _wobbleA  = 0;
      _wobbleB  = 0;
      _landedTs = null;
      _countdown   = 3;
      _countdownTs = null;
    }

    function _ensureLoop() {
      if (!_rafId) _rafId = requestAnimationFrame(_loop);
    }

    function _currentDemo() {
      return _demoIndex >= 0 ? DEMOS[_demoIndex] : null;
    }

    function _objForKey(key) {
      if (key === 'book') return BOOK_OBJ;
      return Physics.OBJECTS[key] || BOOK_OBJ;
    }

    // ── MAIN LOOP ────────────────────────────────────────────────────────────

    function _loop(ts) {
      if (!_lastTs) _lastTs = ts;
      const wdt = Math.min((ts - _lastTs) / 1000, 0.033);
      _lastTs = ts;

      _update(ts, wdt);
      _draw(ts);

      _rafId = requestAnimationFrame(_loop);
    }

    function _drawStatic(ts) { _draw(ts || 0); _rafId = null; }

    function _update(ts, wdt) {
      const demo = _currentDemo();
      if (!demo) return;

      // ── COUNTDOWN ─────────────────────────────────────────────────────────
      if (_phase === 'countdown') {
        if (!_countdownTs) _countdownTs = ts;
        const elapsed = ts - _countdownTs;
        _countdown = Math.max(0, 3 - Math.floor(elapsed / 900));
        if (elapsed >= 2700) {
          _phase   = 'dropping';
          _lastTs  = null;
        }
        return;
      }

      // ── DROPPING ──────────────────────────────────────────────────────────
      if (_phase === 'dropping') {
        const steps  = 10;
        const subDt  = wdt / steps;
        const physA  = _objForKey(demo.laneAKey);
        const physB  = _objForKey(demo.laneBKey);
        const accelA = Physics.dropAccel(physA, demo.airOn);
        // Demo 3: paper on book — book shelters paper → use book's drag profile
        const accelB = Physics.dropAccel(physB, demo.airOn);

        for (let i = 0; i < steps; i++) {
          if (!_objA.landed) {
            const ns = Physics.rk4({ s: _objA.s, v: _objA.v }, subDt, accelA);
            _objA.s  = ns.s; _objA.v = ns.v;
            if (_objA.s >= DROP_HEIGHT_M) {
              _objA.s = DROP_HEIGHT_M; _objA.landed = true; _objA.landT = _simT;
            }
          }
          if (!_objB.landed) {
            const ns = Physics.rk4({ s: _objB.s, v: _objB.v }, subDt, accelB);
            _objB.s  = ns.s; _objB.v = ns.v;
            if (_objB.s >= DROP_HEIGHT_M) {
              _objB.s = DROP_HEIGHT_M; _objB.landed = true; _objB.landT = _simT;
            }
          }
          _simT += subDt;
        }

        // Flat paper tumble wobble
        const isAFlat = (demo.laneAKey === 'paperFlat');
        const isBFlat = (demo.laneBKey === 'paperFlat');
        if (isAFlat && !_objA.landed) _wobbleA = Math.sin(ts * 0.0055) * 18 * (1 - _objA.s / DROP_HEIGHT_M * 0.5);
        if (isBFlat && !_objB.landed) _wobbleB = Math.sin(ts * 0.0048 + 1.3) * 18 * (1 - _objB.s / DROP_HEIGHT_M * 0.5);

        if (_objA.landed && _objB.landed && !_landedTs) {
          _landedTs = ts;
          _phase    = 'landed';
        }
        return;
      }

      // ── LANDED — wait then fire observation callback ───────────────────────
      if (_phase === 'landed') {
        // Settle wobble
        _wobbleA *= 0.88;
        _wobbleB *= 0.88;

        if (ts - _landedTs > LAND_PAUSE) {
          _phase = 'observe';
          _completed.push({ index: _demoIndex, tA: _objA.landT, tB: _objB.landT });

          if (_onObservationNeeded) {
            _onObservationNeeded(_demoIndex, { tA: _objA.landT, tB: _objB.landT }, () => {
              // onAnswered callback
              _phase = 'done';
              if (_demoIndex === DEMOS.length - 1) {
                if (_onAllComplete) _onAllComplete(_completed);
              }
            });
          } else {
            _phase = 'done';
          }
        }
      }
    }

    // ── DRAW ─────────────────────────────────────────────────────────────────

    function _draw(ts) {
      // W and H are kept current by _syncSize() / ResizeObserver — no raw read needed
      ctx.clearRect(0, 0, W, H);
      _drawBg();
      _drawColumn();
      _drawProgressPips();

      const demo = _currentDemo();
      if (!demo) { _drawIdlePrompt(); return; }

      if (_phase === 'predict') {
        _drawObjectsAtTop(demo);
        _drawPredictBanner(demo);
        return;
      }

      if (_phase === 'countdown') {
        _drawObjectsAtTop(demo);
        _drawCountdown(ts);
        return;
      }

      _drawObjects(demo, ts);
      _drawLandedInfo(demo, ts);
      _drawStopwatchBar(demo);

      if (_phase === 'observe') _drawObserveBanner(demo);
      if (_phase === 'done')    _drawDoneBanner(demo);
    }

    function _drawBg() {
      ctx.fillStyle = '#0a0c12'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.018)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    }

    function _drawColumn() {
      const top = _topY(), bot = _bottomY();

      // Height ruler — left edge
      ctx.strokeStyle = 'rgba(77,240,176,0.15)'; ctx.lineWidth = 1;
      ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.moveTo(32, top); ctx.lineTo(32, bot); ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle  = 'rgba(77,240,176,0.3)';
      ctx.font       = '10px DM Mono, monospace';
      ctx.textAlign  = 'right';
      for (let m = 0; m <= DROP_HEIGHT_M; m++) {
        const y = _simToY(m);
        ctx.strokeStyle = 'rgba(77,240,176,0.25)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(28, y); ctx.lineTo(36, y); ctx.stroke();
        ctx.fillText(m + 'm', 26, y + 4);
      }

      // Demo title — drawn first so nothing covers it
      const demo = _currentDemo();
      const colA = demo ? (_objForKey(demo.laneAKey).trackColor || '#ffd166') : '#ffd166';
      const colB = demo ? (_objForKey(demo.laneBKey).trackColor || '#4df0b0') : '#4df0b0';
      if (demo) {
        ctx.font = '600 13px DM Sans, sans-serif'; ctx.fillStyle = '#eef2ff';
        ctx.textAlign = 'center';
        ctx.fillText(demo.title, W / 2, top - 56);
      }

      // Release platform
      ctx.fillStyle = '#1e2640';
      _rrect(ctx, W * 0.14, top - 20, W * 0.72, 20, 4); ctx.fill();
      ctx.strokeStyle = '#2e3a58'; ctx.lineWidth = 1; ctx.stroke();

      // Lane labels — drawn ON TOP of platform so they're never covered
      if (demo) {
        ctx.font = '600 11px DM Mono, monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = colA + 'ee';
        ctx.fillText(demo.laneALabel, _laneAX(), top - 6);
        ctx.fillStyle = colB + 'ee';
        ctx.fillText(demo.laneBLabel, _laneBX(), top - 6);
      }

      // Ground
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W * 0.1, bot); ctx.lineTo(W * 0.9, bot); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(W * 0.1, bot, W * 0.8, 6);

      // Drop trail guides
      [{ x: _laneAX(), c: colA }, { x: _laneBX(), c: colB }].forEach(({ x, c }) => {
        ctx.strokeStyle = c + '18'; ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // Small pip indicators showing which demos are done
    function _drawProgressPips() {
      const labels = ['Demo 1', 'Demo 2', 'Demo 3'];
      ctx.font = '10px DM Mono, monospace'; ctx.textAlign = 'center';
      labels.forEach((lbl, i) => {
        const x   = W - 80 + i * 28;
        const y   = 18;
        const done = _completed.some(c => c.index === i);
        const cur  = _demoIndex === i;
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = done ? '#4df0b0' : cur ? '#ffd166' : '#253040';
        ctx.fill();
        ctx.strokeStyle = done ? '#4df0b0' : cur ? '#ffd166' : '#3a4a60';
        ctx.lineWidth = 1.5; ctx.stroke();
      });
    }

    function _drawObjectsAtTop(demo) {
      // Objects rest on the platform surface (top - 20 is platform top edge)
      _drawObjectVisual(demo.laneAKey, _laneAX(), _topY() - 20, 0, demo.combined, false);
      _drawObjectVisual(demo.laneBKey, _laneBX(), _topY() - 20, 0, false, false);
    }

    function _drawObjects(demo, ts) {
      const yA = _simToY(_objA.s);
      const yB = _simToY(_objB.s);

      // Motion trails
      _drawTrail(demo.laneAKey, _laneAX(), yA, _objA.landed);
      _drawTrail(demo.laneBKey, _laneBX(), yB, _objB.landed);

      // Objects
      _drawObjectVisual(demo.laneAKey, _laneAX() + _wobbleA, yA, _wobbleA, demo.combined, _objA.landed);
      _drawObjectVisual(demo.laneBKey, _laneBX() + _wobbleB, yB, _wobbleB, false,          _objB.landed);
    }

    // ── OBJECT VISUAL DISPATCH ───────────────────────────────────────────────

    function _drawObjectVisual(key, x, y, wobble, combined, landed) {
      if (key === 'paperFlat')    { _drawPaperFlat(x, y, wobble, landed); return; }
      if (key === 'paperOnBook')  { _drawPaperOnBook(x, y, landed); return; }
      if (key === 'paperCrumpled'){ _drawCrumpledPaper(x, y, landed); return; }
      if (key === 'book')         { _drawBook(x, y, landed); return; }
      // Fallback: sphere (iron ball, stone, etc.)
      const obj = _objForKey(key);
      _drawSphere(x, y, obj, landed);
    }

    function _drawSphere(x, y, obj, landed) {
      const r   = obj.radius || 12;
      const col = obj.trackColor || '#4df0b0';
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
      halo.addColorStop(0, col + '28'); halo.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
      ctx.fillStyle = halo; ctx.fill();
      const sph = ctx.createRadialGradient(x - r*0.35, y - r*0.35, r*0.05, x, y, r);
      sph.addColorStop(0,   obj.shine || '#fff');
      sph.addColorStop(0.5, (obj.color || '#888') + 'dd');
      sph.addColorStop(1,   (obj.color || '#888') + '88');
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = sph;
      ctx.shadowColor = col + '55'; ctx.shadowBlur = landed ? 0 : 16;
      ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = col + '88'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    function _drawPaperFlat(x, y, wobble, landed) {
      // Flat A4 sheet — thin rectangle, tilts with wobble
      const angle = wobble * 0.045;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      // Shadow
      ctx.save(); ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(3, 5, 24, 5, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      // Sheet body
      const grad = ctx.createLinearGradient(-22, -3, 22, 3);
      grad.addColorStop(0, '#d8d4c8'); grad.addColorStop(0.5, '#f0ece0'); grad.addColorStop(1, '#d8d4c8');
      ctx.fillStyle = grad;
      _rrect(ctx,-22,-4,44,8,1); ctx.fill();
      ctx.strokeStyle = '#c8c4b8'; ctx.lineWidth = 0.8; ctx.stroke();
      // Ruled lines hint
      ctx.strokeStyle = 'rgba(160,160,200,0.3)'; ctx.lineWidth = 0.5;
      for (let i = -14; i <= 14; i += 7) {
        ctx.beginPath(); ctx.moveTo(i, -3); ctx.lineTo(i, 3); ctx.stroke();
      }
      ctx.restore();
      // LANDED label drawn centrally by _drawLandedInfo() — not here
    }

    function _drawBook(x, y, landed) {
      // Thick hardcover book
      ctx.save();
      ctx.translate(x, y);
      // Spine shadow
      ctx.save(); ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(4, 12, 22, 6, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      // Cover
      const grad = ctx.createLinearGradient(-20, -14, 20, 14);
      grad.addColorStop(0, '#3a5898'); grad.addColorStop(1, '#1e3460');
      ctx.fillStyle = grad;
      _rrect(ctx,-20,-14,40,28,3); ctx.fill();
      ctx.strokeStyle = '#4a68a8'; ctx.lineWidth = 1.2; ctx.stroke();
      // Spine line
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-18, -13); ctx.lineTo(-18, 13); ctx.stroke();
      // Title block
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      _rrect(ctx,-14,-8,28,10,2); ctx.fill();
      ctx.restore();
      // LANDED label drawn centrally by _drawLandedInfo() — not here
    }

    function _drawPaperOnBook(x, y, landed) {
      // Book with paper resting flat on top face — combined object
      ctx.save(); ctx.translate(x, y);

      // Book body (same as above)
      ctx.save(); ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(4, 14, 24, 6, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      const grad = ctx.createLinearGradient(-20, -10, 20, 16);
      grad.addColorStop(0, '#3a5898'); grad.addColorStop(1, '#1e3460');
      ctx.fillStyle = grad;
      _rrect(ctx,-20,-10,40,26,3); ctx.fill();
      ctx.strokeStyle = '#4a68a8'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-18, -9); ctx.lineTo(-18, 15); ctx.stroke();

      // Paper sitting on top of book
      const pGrad = ctx.createLinearGradient(-22, -16, 22, -10);
      pGrad.addColorStop(0, '#d8d4c8'); pGrad.addColorStop(0.5, '#f0ece0'); pGrad.addColorStop(1, '#d8d4c8');
      ctx.fillStyle = pGrad;
      _rrect(ctx,-21,-16,42,7,1); ctx.fill();
      ctx.strokeStyle = '#c0bcb0'; ctx.lineWidth = 0.8; ctx.stroke();

      // Arrow showing paper is ON the book
      ctx.fillStyle = 'rgba(77,240,176,0.5)';
      ctx.font = '9px DM Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText('on top', 0, -20);

      ctx.restore();
      // LANDED label drawn centrally by _drawLandedInfo() — not here
    }

    function _drawCrumpledPaper(x, y, landed) {
      // Crumpled ball of paper — irregular polygon
      ctx.save(); ctx.translate(x, y);
      const pts = [
        [0,-12],[8,-8],[12,0],[8,9],[2,12],[-6,11],[-12,5],[-10,-5],[-5,-11]
      ];
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      const grad = ctx.createRadialGradient(-3, -4, 0, 0, 0, 12);
      grad.addColorStop(0, '#ece8d8'); grad.addColorStop(1, '#b8b0a0');
      ctx.fillStyle = grad;
      ctx.shadowColor = '#ffd16633'; ctx.shadowBlur = landed ? 0 : 10;
      ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#a8a090'; ctx.lineWidth = 0.8; ctx.stroke();
      // Crinkle lines
      ctx.strokeStyle = 'rgba(100,90,80,0.3)'; ctx.lineWidth = 0.5;
      [[0,-8,6,0],[0,-8,-5,2],[6,0,0,8],[-5,2,0,8]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      });
      ctx.restore();
      // LANDED label drawn centrally by _drawLandedInfo() — not here
    }

    function _drawLandedTag(x, y, color) {
      ctx.font = '600 10px DM Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = color;
      ctx.fillText('LANDED', x, y);
    }

    function _drawTrail(key, x, yNow, landed) {
      if (landed || yNow <= _topY() + 10) return;
      const col = (_objForKey(key).trackColor || '#aaa') + '22';
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.setLineDash([3, 8]);
      ctx.beginPath(); ctx.moveTo(x, _topY()); ctx.lineTo(x, yNow); ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── OVERLAYS ─────────────────────────────────────────────────────────────

    function _drawCountdown(ts) {
      ctx.save(); ctx.textAlign = 'center';
      if (_countdown > 0) {
        ctx.font = '700 64px DM Sans, sans-serif';
        ctx.fillStyle = '#4df0b0';
        ctx.shadowColor = '#4df0b055'; ctx.shadowBlur = 30;
        ctx.fillText(_countdown, W / 2, H / 2 + 20);
        ctx.shadowBlur = 0;
        ctx.font = '13px DM Mono, monospace';
        ctx.fillStyle = 'rgba(168,180,208,0.7)';
        ctx.fillText('GET READY', W / 2, H / 2 + 50);
      } else {
        ctx.font = '700 48px DM Sans, sans-serif';
        ctx.fillStyle = '#ffd166';
        ctx.shadowColor = '#ffd16655'; ctx.shadowBlur = 24;
        ctx.fillText('DROP!', W / 2, H / 2 + 16);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    function _drawPredictBanner(demo) {
      ctx.save();
      ctx.fillStyle = 'rgba(10,12,18,0.75)';
      _rrect(ctx,W/2 - 200,H/2 - 32,400,56,10); ctx.fill();
      ctx.textAlign = 'center';
      ctx.font = '600 14px DM Sans, sans-serif'; ctx.fillStyle = '#eef2ff';
      ctx.fillText(demo.predictionPrompt, W/2, H/2 - 8);
      ctx.font = '11px DM Mono, monospace'; ctx.fillStyle = '#a8b4d0';
      ctx.fillText('(Answer the prediction panel to continue)', W/2, H/2 + 16);
      ctx.restore();
    }

    function _drawLandedInfo(demo, ts) {
      if (!(_objA.landed || _objB.landed)) return;
      const bot = _bottomY();

      // Helper: draw a tidy LANDED pill + time below ground line
      function _landedPill(x, col, timeStr) {
        // Pill background
        ctx.save();
        ctx.fillStyle = col + '22';
        _rrect(ctx, x - 34, bot + 8, 68, 18, 9);
        ctx.fill();
        ctx.strokeStyle = col + '66';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Label
        ctx.font = '700 10px DM Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = col;
        ctx.fillText('LANDED', x, bot + 21);
        ctx.restore();
        // Time below pill
        if (timeStr) {
          ctx.save();
          ctx.font = '500 10px DM Mono, monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = col + 'cc';
          ctx.fillText(timeStr, x, bot + 36);
          ctx.restore();
        }
      }

      if (_objA.landed) {
        const col = _objForKey(demo.laneAKey).trackColor || '#ffd166';
        _landedPill(_laneAX(), col, _objA.landT !== null ? _objA.landT.toFixed(3) + ' s' : null);
      }
      if (_objB.landed) {
        const col = _objForKey(demo.laneBKey).trackColor || '#4df0b0';
        _landedPill(_laneBX(), col, _objB.landT !== null ? _objB.landT.toFixed(3) + ' s' : null);
      }

      // Result banner once both landed
      if (_objA.landed && _objB.landed && _landedTs !== null && ts - _landedTs > 400) {
        const alpha = Math.min(1, (ts - _landedTs - 400) / 400);
        const diff  = Math.abs(_objA.landT - _objB.landT);
        const isTie = diff < 0.05;
        const winner = _objA.landT < _objB.landT ? demo.laneALabel : demo.laneBLabel;
        const msg   = isTie ? 'They landed at the same time!' : `${winner} landed first.`;
        ctx.save(); ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(10,12,18,0.85)';
        _rrect(ctx, W/2 - 190, H*0.52 - 28, 380, 56, 10); ctx.fill();
        ctx.textAlign = 'center';
        ctx.font = '600 14px DM Sans, sans-serif'; ctx.fillStyle = '#eef2ff';
        ctx.fillText(msg, W/2, H*0.52 - 4);
        ctx.font = '11px DM Mono, monospace'; ctx.fillStyle = '#a8b4d0';
        ctx.fillText('What did you notice?', W/2, H*0.52 + 18);
        ctx.restore();
      }
    }

    function _drawStopwatchBar(demo) {
      // Shows elapsed sim time as a live readout while dropping
      if (_phase !== 'dropping' && _phase !== 'landed' && _phase !== 'observe' && _phase !== 'done') return;
      const tA  = _objA.landT !== null ? _objA.landT : _simT;
      const tB  = _objB.landT !== null ? _objB.landT : _simT;
      const fmt = t => String(Math.floor(t)).padStart(2,'0') + '.' + String(Math.floor((t % 1)*1000)).padStart(3,'0') + ' s';
      ctx.save();
      ctx.font = '700 22px DM Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillStyle = '#4df0b0';
      ctx.shadowColor = '#4df0b055'; ctx.shadowBlur = (_phase === 'dropping') ? 12 : 0;
      ctx.fillText(fmt(_simT), 52, 40);
      ctx.shadowBlur = 0;
      ctx.font = '10px DM Mono, monospace'; ctx.fillStyle = '#3a4a60';
      ctx.fillText('ELAPSED', 52, 54);
      ctx.restore();
    }

    function _drawObserveBanner(demo) {
      ctx.save();
      ctx.fillStyle = 'rgba(10,12,18,0.80)';
      _rrect(ctx,W/2 - 210,H*0.7 - 28,420,52,10); ctx.fill();
      ctx.textAlign = 'center';
      ctx.font = '600 13px DM Sans, sans-serif'; ctx.fillStyle = '#eef2ff';
      ctx.fillText(demo.observationPrompt, W/2, H*0.7 - 6);
      ctx.font = '11px DM Mono, monospace'; ctx.fillStyle = '#a8b4d0';
      ctx.fillText('(Answer in the observation panel)', W/2, H*0.7 + 16);
      ctx.restore();
    }

    function _drawDoneBanner(demo) {
      const isLast = _demoIndex === DEMOS.length - 1;
      ctx.save();
      ctx.fillStyle = 'rgba(77,240,176,0.08)';
      _rrect(ctx,W/2 - 180,H*0.7 - 24,360,46,10); ctx.fill();
      ctx.strokeStyle = 'rgba(77,240,176,0.25)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = '600 13px DM Sans, sans-serif'; ctx.fillStyle = '#4df0b0';
      ctx.fillText(isLast ? '✓ All demos complete!' : `✓ Demo ${_demoIndex + 1} done — next demo awaits`, W/2, H*0.7 - 4);
      ctx.font = '11px DM Mono, monospace'; ctx.fillStyle = '#a8b4d0';
      ctx.fillText(isLast ? 'Continue to the History card →' : 'Click ▶ Start Demo ' + (_demoIndex + 2), W/2, H*0.7 + 16);
      ctx.restore();
    }

    function _drawIdlePrompt() {
      ctx.save(); ctx.textAlign = 'center';
      ctx.font = '13px DM Sans, sans-serif'; ctx.fillStyle = 'rgba(77,240,176,0.4)';
      ctx.fillText('Drop Lab — three demos. Click ▶ Start Demo 1 to begin.', W/2, H/2);
      ctx.restore();
    }

    // Initial render — defer until the browser has laid out the canvas so
    // getBoundingClientRect() returns real dimensions (not 0×0).
    // The ResizeObserver fires synchronously during observe() if the element
    // already has a size; if not, we fall back to a double-rAF which gives
    // the layout engine one full frame to settle.
    function _firstDraw() {
      if (_initialised) return;
      _syncSize();
      if (W > 0 && H > 0) {
        _initialised = true;
        _rafId = requestAnimationFrame(ts => { _drawStatic(ts); });
      } else {
        // Canvas still has no layout size — try again next frame
        requestAnimationFrame(_firstDraw);
      }
    }
    requestAnimationFrame(_firstDraw);

    // ── PUBLIC API ────────────────────────────────────────────────────────────
    return {
      onPredictionNeeded,
      onObservationNeeded,
      onAllComplete,
      startDemo,
      reset,
      destroy,
      syncSize : _syncSize,
      // Expose demo metadata for host UI to build MCQ panels
      DEMOS,
      getPhase    : () => _phase,
      getDemoIndex: () => _demoIndex,
      getCompleted: () => [..._completed],
    };
  }

  return { create, DEMOS };

})();

if (typeof module !== 'undefined') module.exports = DrawDrop;

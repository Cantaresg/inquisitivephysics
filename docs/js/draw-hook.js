/**
 * draw-hook.js — Stage 0 hook animation
 * Feather vs iron ball vertical drop with air resistance ON.
 * Depends on: physics.js
 *
 * Usage:
 *   const hook = DrawHook.create(canvas);
 *   hook.start();
 *   hook.onComplete(() => { ... show MCQ ... });
 */

const DrawHook = (() => {

  // ── CONSTANTS ──────────────────────────────────────────────────────────────
  // 4m drop: iron ball hits ground in ~0.9s (snappy, satisfying)
  // feather only falls ~1.2m in same time — gap is visually dramatic
  const DROP_HEIGHT_M = 4;    // simulated metres — realistic classroom height
  const SIM_SCALE     = 72;   // px per metre — 4m × 72 = 288px column
  const DROP_PX       = DROP_HEIGHT_M * SIM_SCALE;  // 288 px

  // Visual lane positions (x centres)
  const LANE_IRON    = 0.35;  // fraction of canvas width
  const LANE_FEATHER = 0.65;

  // ── FACTORY ────────────────────────────────────────────────────────────────
  function create(canvas) {

    const ctx = canvas.getContext('2d');
    let W = canvas.width;
    let H = canvas.height;

    // Animation state
    let _running    = false;
    let _complete   = false;
    let _rafId      = null;
    let _lastTs     = null;
    let _onComplete = null;
    let _phase      = 'idle';   // idle | countdown | dropping | landed | reset_wait

    // Physics state for each object
    const _iron    = { ...Physics.OBJECTS.ironBall,   s: 0, v: 0, landed: false, landT: null };
    const _feather = { ...Physics.OBJECTS.feather,    s: 0, v: 0, landed: false, landT: null };

    // Countdown
    let _countdown    = 3;
    let _countdownTs  = null;

    // Post-land pause before callback
    let _landedTs     = null;
    const LAND_PAUSE  = 2200; // ms to show result before MCQ appears

    // Feather wobble
    let _featherWobble = 0;

    // ── LAYOUT HELPERS ───────────────────────────────────────────────────────
    function ironX()    { return W * LANE_IRON; }
    function featherX() { return W * LANE_FEATHER; }
    function topY()     { return H * 0.12; }
    function bottomY()  { return topY() + DROP_PX; }

    // Convert sim position (metres from top) to canvas Y
    function simToY(s)  { return topY() + s * SIM_SCALE; }

    // ── RESET ────────────────────────────────────────────────────────────────
    function reset() {
      _iron.s    = 0; _iron.v    = 0; _iron.landed    = false; _iron.landT    = null;
      _feather.s = 0; _feather.v = 0; _feather.landed = false; _feather.landT = null;
      _phase     = 'idle';
      _complete  = false;
      _countdown = 3;
      _countdownTs = null;
      _landedTs    = null;
      _featherWobble = 0;
      _lastTs = null;
    }

    // ── START ────────────────────────────────────────────────────────────────
    function start() {
      reset();
      _running = true;
      _phase   = 'countdown';
      _rafId   = requestAnimationFrame(_loop);
    }

    function stop() {
      _running = false;
      if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    }

    function onComplete(fn) { _onComplete = fn; }

    // ── MAIN LOOP ────────────────────────────────────────────────────────────
    function _loop(ts) {
      if (!_running) return;
      if (!_lastTs) _lastTs = ts;
      const wdt = Math.min((ts - _lastTs) / 1000, 0.033);
      _lastTs = ts;

      _update(ts, wdt);
      _draw(ts);

      _rafId = requestAnimationFrame(_loop);
    }

    function _update(ts, wdt) {

      if (_phase === 'countdown') {
        if (!_countdownTs) _countdownTs = ts;
        const elapsed = ts - _countdownTs;
        _countdown = Math.max(0, 3 - Math.floor(elapsed / 900));
        if (elapsed >= 2700) {
          _phase = 'dropping';
          _lastTs = null;  // reset dt for clean physics start
        }
        return;
      }

      if (_phase === 'dropping') {
        const dt = wdt;
        const steps = 8;
        const subDt = dt / steps;

        for (let i = 0; i < steps; i++) {
          if (!_iron.landed) {
            const aFn = Physics.dropAccel(_iron, true);
            const ns  = Physics.rk4({ s: _iron.s, v: _iron.v }, subDt, aFn);
            _iron.s = ns.s; _iron.v = ns.v;
            if (_iron.s >= DROP_HEIGHT_M) {
              _iron.s = DROP_HEIGHT_M; _iron.landed = true; _iron.landT = ts;
            }
          }
          if (!_feather.landed) {
            const aFn = Physics.dropAccel(_feather, true);
            const ns  = Physics.rk4({ s: _feather.s, v: _feather.v }, subDt, aFn);
            _feather.s = ns.s; _feather.v = ns.v;
            if (_feather.s >= DROP_HEIGHT_M) {
              _feather.s = DROP_HEIGHT_M; _feather.landed = true; _feather.landT = ts;
            }
          }
        }

        // Feather wobble — oscillate perpendicular as it drifts down
        _featherWobble = Math.sin(ts * 0.004) * 10 * (1 - _feather.s / DROP_HEIGHT_M * 0.3);

        if (_iron.landed && _feather.landed) {
          _phase    = 'landed';
          _landedTs = ts;
        }
        return;
      }

      if (_phase === 'landed') {
        // Keep feather wobble settling
        _featherWobble *= 0.92;
        if (ts - _landedTs > LAND_PAUSE) {
          _phase    = 'reset_wait';
          _complete = true;
          if (_onComplete) _onComplete();
        }
      }
    }

    // ── DRAW ─────────────────────────────────────────────────────────────────
    function _draw(ts) {
      W = canvas.width; H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      _drawBackground();
      _drawColumn();

      if (_phase === 'countdown') {
        _drawCountdown();
        _drawObjectsAtTop();
        return;
      }

      _drawObjects();
      _drawLandedLabels(ts);

      if (_phase === 'idle') {
        _drawIdlePrompt();
      }
    }

    function _drawBackground() {
      // Subtle gradient sky
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0d1020');
      grad.addColorStop(1, '#0a0c12');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.018)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
    }

    function _drawColumn() {
      const tx = topY();
      const bx = bottomY();

      // Height ruler on left edge
      ctx.strokeStyle = 'rgba(77,240,176,0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.moveTo(32, tx); ctx.lineTo(32, bx); ctx.stroke();
      ctx.setLineDash([]);

      // Ruler ticks every 1m
      ctx.fillStyle = 'rgba(77,240,176,0.3)';
      ctx.font = '10px DM Mono, monospace';
      ctx.textAlign = 'right';
      for (let m = 0; m <= DROP_HEIGHT_M; m += 1) {
        const y = simToY(m);
        ctx.beginPath();
        ctx.moveTo(28, y); ctx.lineTo(36, y);
        ctx.strokeStyle = 'rgba(77,240,176,0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillText(m + 'm', 26, y + 4);
      }

      // Drop platform (top)
      ctx.fillStyle = '#1e2640';
      ctx.beginPath();
      ctx.roundRect(W * 0.2, tx - 14, W * 0.6, 14, [4, 4, 0, 0]);
      ctx.fill();
      ctx.strokeStyle = '#2e3a58';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Ground line
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W * 0.1, bx); ctx.lineTo(W * 0.9, bx); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(W * 0.1, bx, W * 0.8, 6);

      // Lane labels
      ctx.font = '11px DM Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = Physics.OBJECTS.ironBall.trackColor + '99';
      ctx.fillText('Iron Ball', ironX(), tx - 20);
      ctx.fillStyle = Physics.OBJECTS.feather.trackColor + '99';
      ctx.fillText('Feather', featherX(), tx - 20);

      // Drop trail guides (faint vertical dashes)
      [ironX(), featherX()].forEach((x, i) => {
        const col = i === 0 ? Physics.OBJECTS.ironBall.trackColor : Physics.OBJECTS.feather.trackColor;
        ctx.strokeStyle = col + '18';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.beginPath(); ctx.moveTo(x, tx); ctx.lineTo(x, bx); ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    function _drawObjectsAtTop() {
      _drawIronBall(ironX(), topY() - 20);
      _drawFeather(featherX(), topY() - 20, 0);
    }

    function _drawObjects() {
      const iy = simToY(_iron.s);
      const fy = simToY(_feather.s);

      // Motion trail for iron ball
      if (_iron.s > 0.2 && !_iron.landed) {
        const trailLen = Math.min(_iron.s * SIM_SCALE, 40);
        const trailGrad = ctx.createLinearGradient(ironX(), iy - trailLen, ironX(), iy);
        trailGrad.addColorStop(0, 'transparent');
        trailGrad.addColorStop(1, Physics.OBJECTS.ironBall.trackColor + '40');
        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ironX(), iy - trailLen);
        ctx.lineTo(ironX(), iy);
        ctx.stroke();
      }

      // Feather drift trail
      if (_feather.s > 0.3 && !_feather.landed) {
        ctx.strokeStyle = Physics.OBJECTS.feather.trackColor + '25';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.moveTo(featherX(), simToY(Math.max(0, _feather.s - 3)));
        ctx.lineTo(featherX() + _featherWobble, fy);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      _drawIronBall(ironX(), iy);
      _drawFeather(featherX() + (_feather.landed ? 0 : _featherWobble), fy, _featherWobble);
    }

    function _drawIronBall(x, y) {
      const r = 16;
      const sph = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      sph.addColorStop(0, Physics.OBJECTS.ironBall.shine);
      sph.addColorStop(0.6, Physics.OBJECTS.ironBall.color + 'cc');
      sph.addColorStop(1, Physics.OBJECTS.ironBall.color + '66');
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
      halo.addColorStop(0, Physics.OBJECTS.ironBall.trackColor + '28');
      halo.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = halo; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = sph;
      ctx.shadowColor = Physics.OBJECTS.ironBall.trackColor + '44';
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.strokeStyle = Physics.OBJECTS.ironBall.color;
      ctx.lineWidth = 1.5; ctx.stroke();
      ctx.shadowBlur = 0;
    }

    function _drawFeather(x, y, wobble) {
      ctx.save();
      ctx.translate(x, y);
      // Tilt based on wobble
      ctx.rotate(wobble * 0.04);

      // Feather spine
      ctx.strokeStyle = '#e8e0d0';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 18); ctx.stroke();

      // Barbs — left side
      ctx.strokeStyle = 'rgba(245,240,232,0.7)';
      ctx.lineWidth = 0.8;
      for (let i = -14; i <= 14; i += 4) {
        const spread = 10 * (1 - Math.abs(i) / 18);
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(-spread, i - 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo( spread, i - 4); ctx.stroke();
      }

      // Soft glow
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 24);
      halo.addColorStop(0, Physics.OBJECTS.feather.trackColor + '20');
      halo.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fillStyle = halo; ctx.fill();

      ctx.restore();
    }

    function _drawCountdown() {
      ctx.save();
      ctx.textAlign = 'center';
      if (_countdown > 0) {
        ctx.font = '700 64px DM Sans, sans-serif';
        ctx.fillStyle = '#4df0b0';
        ctx.shadowColor = '#4df0b055';
        ctx.shadowBlur = 30;
        ctx.fillText(_countdown, W / 2, H / 2 + 20);
        ctx.shadowBlur = 0;
        ctx.font = '14px DM Mono, monospace';
        ctx.fillStyle = 'rgba(168,180,208,0.7)';
        ctx.fillText('GET READY', W / 2, H / 2 + 52);
      } else {
        ctx.font = '700 48px DM Sans, sans-serif';
        ctx.fillStyle = '#ffd166';
        ctx.shadowColor = '#ffd16655';
        ctx.shadowBlur = 24;
        ctx.fillText('GO!', W / 2, H / 2 + 16);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    // Draws "LANDED" label for each object as soon as it lands — independent
    function _drawLandedLabels(ts) {
      const bx = bottomY();
      ctx.font = '600 11px DM Mono, monospace';
      ctx.textAlign = 'center';

      if (_iron.landed) {
        ctx.fillStyle = Physics.OBJECTS.ironBall.trackColor;
        ctx.fillText('LANDED', ironX(), bx + 22);
      }
      if (_feather.landed) {
        ctx.fillStyle = Physics.OBJECTS.feather.trackColor;
        ctx.fillText('LANDED', featherX(), bx + 22);
      }

    }

    function _drawIdlePrompt() {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '13px DM Sans, sans-serif';
      ctx.fillStyle = 'rgba(77,240,176,0.5)';
      ctx.fillText('Click ▶ Start to begin', W / 2, H - 20);
      ctx.restore();
    }

    // ── PUBLIC ──────────────────────────────────────────────────────────────
    return { start, stop, reset, onComplete, isComplete: () => _complete };
  }

  return { create };

})();

if (typeof module !== 'undefined') module.exports = DrawHook;
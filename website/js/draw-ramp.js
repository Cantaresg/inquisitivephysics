/**
 * draw-ramp.js — 2.5D ramp renderer for Stages 1 & 2
 * Depends on: physics.js
 *
 * v3 changes:
 *   - HIGH side is now on the RIGHT, balls roll LEFT (more natural read direction)
 *   - Ramp fills ~95% of canvas — no dead space
 *   - 2.5D: back lane (behind) elevated + shifted, cast shadow onto front lane
 *   - Light object = 'Light Ball'; feather belongs only in drop stage
 *   - Release auto-starts stopwatch; no separate SW button needed
 *   - Angle fixed at 30° — students only vary L
 *   - recordRun() returns data row for CSV logging (L, t, t²)
 */

const DrawRamp = (() => {

  // ── LAYOUT CONSTANTS ───────────────────────────────────────────────────────
  const FIXED_ANGLE_DEG = 30;
  const RAMP_DEPTH      = 40;   // px — extrusion depth for 2.5D look
  const BACK_RISE       = 30;   // px — back lane raised above front lane
  const BACK_SHIFT_X    = -22;  // px — back lane shifted LEFT (perspective behind)
  const PAD_LEFT        = 52;   // finish end
  const PAD_RIGHT       = 56;   // top/high end
  const PAD_TOP         = 76;
  const PAD_BTM         = 64;

  // Light ball
  const LIGHT_OBJ = {
    label: 'Light Ball', radius: 11,
    color: '#b8940c', shine: '#ffd166', trackColor: '#ffd166',
  };

  // ── FACTORY ────────────────────────────────────────────────────────────────
  function create(canvas) {
    const ctx = canvas.getContext('2d');
    let W = canvas.width;
    let H = canvas.height;

    let _L        = 1.0;
    let _heavyKey = 'ironBall';

    let _running      = false;
    let _released     = false;
    let _rafId        = null;
    let _lastTs       = null;
    let _onBothLanded = null;
    let _onReset      = null;

    let _heavy = { s: 0, v: 0, landed: false, landT: null };
    let _light = { s: 0, v: 0, landed: false, landT: null };
    let _simT  = 0;
    let _swTime = 0, _swRunning = false;
    let _trail  = [];
    const TRAIL_MAX = 16;

    // ── GEOMETRY ──────────────────────────────────────────────────────────────
    // HIGH end = RIGHT (tx = top-x, ty = top-y)
    // LOW end  = LEFT  (bx = bottom-x, by = bottom-y)
    // Ball starts at HIGH end (right) and rolls to LOW end (left).
    function _geo() {
      const th  = FIXED_ANGLE_DEG * Math.PI / 180;
      // Available space: leave room for pads + back lane offset
      const avW = W - PAD_LEFT - PAD_RIGHT - Math.abs(BACK_SHIFT_X);
      const avH = H - PAD_TOP  - PAD_BTM;
      // Ramp pixel length: constrained by both axes, use 93% of available
      const Lpx = Math.min(avW / Math.cos(th), avH / Math.sin(th)) * 0.93;

      // High (top) end — RIGHT side
      const tx = W - PAD_RIGHT;
      const ty = PAD_TOP;
      // Low (bottom/finish) end — LEFT side
      const bx = tx - Lpx * Math.cos(th);
      const by = ty + Lpx * Math.sin(th);

      // Unit vector along ramp (high→low, pointing left-down)
      const ux = (bx - tx) / Lpx;  // negative (leftward)
      const uy = (by - ty) / Lpx;  // positive (downward)

      return { tx, ty, bx, by, Lpx, th, ux, uy };
    }

    // Position of a ball on the ramp given simulation distance s (0 = high, L = low)
    function _rampPos(s, lane) {
      const { tx, ty, ux, uy, Lpx } = _geo();
      const frac = s / _L;
      const cx = tx + frac * Lpx * ux;
      const cy = ty + frac * Lpx * uy;
      // Back lane: shifted further "behind" (negative X = leftward, raised Y)
      return lane === 'back'
        ? { x: cx + BACK_SHIFT_X, y: cy - BACK_RISE }
        : { x: cx, y: cy };
    }

    // ── CONTROLS ──────────────────────────────────────────────────────────────
    function setParams({ L, heavyKey }) {
      if (L        !== undefined) _L        = L;
      if (heavyKey !== undefined) _heavyKey = heavyKey;
    }

    function release() {
      if (_released) return;
      _released = true; _running = true; _swRunning = true; _lastTs = null;
      if (!_rafId) _rafId = requestAnimationFrame(_loop);
    }

    function pause()  { _running = false; _swRunning = false; }

    function resume() {
      if (!_released) return;
      _running = true; _swRunning = true;
      if (!_rafId) _rafId = requestAnimationFrame(_loop);
    }

    function reset() {
      _running = false; _released = false; _swRunning = false; _swTime = 0;
      _heavy = { s:0, v:0, landed:false, landT:null };
      _light = { s:0, v:0, landed:false, landT:null };
      _simT = 0; _trail = []; _lastTs = null;
      if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
      _rafId = requestAnimationFrame(_drawStatic);
      if (_onReset) _onReset();
    }

    function recordRun() {
      if (!_heavy.landed || !_light.landed) return null;
      const tH = _heavy.landT, tL = _light.landT;
      return {
        L: _L, angleDeg: FIXED_ANGLE_DEG,
        tHeavy: +tH.toFixed(4), tLight: +tL.toFixed(4),
        t2Heavy: +(tH*tH).toFixed(5), t2Light: +(tL*tL).toFixed(5),
      };
    }

    // ── LOOP ──────────────────────────────────────────────────────────────────
    function _loop(ts) {
      if (!_lastTs) _lastTs = ts;
      const wdt = Math.min((ts - _lastTs) / 1000, 0.033);
      _lastTs = ts;

      if (_running) {
        const steps = 16, dt = wdt / steps;
        const a = Physics.rampAccel(FIXED_ANGLE_DEG, false, 0);
        for (let i = 0; i < steps; i++) {
          if (!_heavy.landed) {
            const ns = Physics.rk4({s:_heavy.s, v:_heavy.v}, dt, () => a);
            _heavy.s = ns.s; _heavy.v = ns.v;
            if (_heavy.s >= _L) { _heavy.s = _L; _heavy.landed = true; _heavy.landT = _simT; }
          }
          if (!_light.landed) {
            const ns = Physics.rk4({s:_light.s, v:_light.v}, dt, () => a);
            _light.s = ns.s; _light.v = ns.v;
            if (_light.s >= _L) { _light.s = _L; _light.landed = true; _light.landT = _simT; }
          }
          _simT += dt;
        }
        const lastS = _trail[_trail.length-1]?.sH || 0;
        if (!_trail.length || _heavy.s - lastS > _L / TRAIL_MAX) {
          _trail.push({ sH: _heavy.s, sL: _light.s });
          if (_trail.length > TRAIL_MAX) _trail.shift();
        }
        if (_swRunning) _swTime += wdt;
        if (_heavy.landed && _light.landed && _running) {
          _running = false; _swRunning = false;
          if (_onBothLanded) _onBothLanded({ tHeavy: _heavy.landT, tLight: _light.landT });
        }
      }
      _draw(ts);
      _rafId = requestAnimationFrame(_loop);
    }

    function _drawStatic(ts) { _draw(ts || 0); _rafId = null; }

    // ── DRAW ──────────────────────────────────────────────────────────────────
    function _draw(ts) {
      W = canvas.width; H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      _drawBg();
      _drawRamp();
      _drawGhostTrails();
      _drawObjects();
      _drawFinishLine();
      _drawStopwatch();
      _drawDataBar();
      if (!_released) _drawHint();
    }

    function _drawBg() {
      ctx.fillStyle = '#0a0c12'; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle = 'rgba(255,255,255,0.018)'; ctx.lineWidth = 1;
      for (let x=0;x<W;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for (let y=0;y<H;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
      // Floor below ramp base
      const { by } = _geo();
      ctx.fillStyle='#0e1520'; ctx.fillRect(0, by+2, W, H-by-2);
      ctx.strokeStyle='#1a2436'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(0,by+2); ctx.lineTo(W,by+2); ctx.stroke();
    }

    function _drawRamp() {
      const { tx, ty, bx, by, th } = _geo();
      // Extrusion vector: perpendicular to ramp surface, pointing "into the screen"
      // For a ramp going right→high, extrusion goes downward-right
      const ex =  RAMP_DEPTH * Math.sin(th);   // x component of extrusion
      const ey =  RAMP_DEPTH * Math.cos(th);   // y component (down)
      const bRx = BACK_SHIFT_X;
      const bRy = -BACK_RISE;

      // ── Underside face (extrusion bottom) ──────────────────────────────────
      ctx.beginPath();
      ctx.moveTo(tx, ty); ctx.lineTo(tx+ex, ty+ey);
      ctx.lineTo(bx+ex, by+ey); ctx.lineTo(bx, by);
      ctx.closePath();
      ctx.fillStyle='#0b1018'; ctx.fill();
      ctx.strokeStyle='#141e2e'; ctx.lineWidth=1; ctx.stroke();

      // ── Front lane surface ────────────────────────────────────────────────
      const fg = ctx.createLinearGradient(tx, ty, bx, by);
      fg.addColorStop(0, '#1e2c50'); fg.addColorStop(1, '#152038');
      ctx.beginPath();
      ctx.moveTo(tx,ty); ctx.lineTo(bx,by);
      ctx.lineTo(bx+ex,by+ey); ctx.lineTo(tx+ex,ty+ey);
      ctx.closePath(); ctx.fillStyle=fg; ctx.fill();

      // ── Back lane surface ─────────────────────────────────────────────────
      const bg2 = ctx.createLinearGradient(tx+bRx, ty+bRy, bx+bRx, by+bRy);
      bg2.addColorStop(0, '#283862'); bg2.addColorStop(1, '#1c2c4c');
      ctx.beginPath();
      ctx.moveTo(tx+bRx, ty+bRy); ctx.lineTo(bx+bRx, by+bRy);
      ctx.lineTo(bx+bRx+ex, by+bRy+ey); ctx.lineTo(tx+bRx+ex, ty+bRy+ey);
      ctx.closePath(); ctx.fillStyle=bg2; ctx.fill();

      // ── Shadow from back lane onto front lane ─────────────────────────────
      ctx.save(); ctx.globalAlpha=0.18; ctx.fillStyle='#000';
      ctx.beginPath();
      ctx.moveTo(tx+bRx, ty+bRy+8); ctx.lineTo(bx+bRx, by+bRy+8);
      ctx.lineTo(bx+bRx+4, by+bRy+26); ctx.lineTo(tx+bRx+4, ty+bRy+26);
      ctx.closePath(); ctx.fill(); ctx.restore();

      // ── Side connector faces (high end + low end) ─────────────────────────
      // High end (right side)
      ctx.beginPath();
      ctx.moveTo(tx,ty); ctx.lineTo(tx+bRx, ty+bRy);
      ctx.lineTo(tx+bRx+ex, ty+bRy+ey); ctx.lineTo(tx+ex, ty+ey);
      ctx.closePath(); ctx.fillStyle='#1c2c48'; ctx.fill();
      // Low end (left side / finish)
      ctx.beginPath();
      ctx.moveTo(bx,by); ctx.lineTo(bx+bRx, by+bRy);
      ctx.lineTo(bx+bRx+ex, by+bRy+ey); ctx.lineTo(bx+ex, by+ey);
      ctx.closePath(); ctx.fillStyle='#141e30'; ctx.fill();

      // ── Top edge lines ────────────────────────────────────────────────────
      ctx.strokeStyle='#3a4e78'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(bx,by); ctx.stroke();
      ctx.strokeStyle='#4a5e8c'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(tx+bRx, ty+bRy); ctx.lineTo(bx+bRx, by+bRy); ctx.stroke();

      // ── Underside triangle (vertical support wall) ────────────────────────
      ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(tx,by); ctx.lineTo(tx,ty);
      ctx.closePath(); ctx.fillStyle='#0c1018'; ctx.fill();
      ctx.strokeStyle='#141e2e'; ctx.lineWidth=1; ctx.stroke();

      // ── Support pillar at high end ────────────────────────────────────────
      ctx.fillStyle='#141e30';
      ctx.beginPath(); ctx.roundRect(tx-9, ty, 18, by-ty, 3); ctx.fill();
      ctx.strokeStyle='#1e2c44'; ctx.lineWidth=1; ctx.stroke();
      // Cap on pillar
      ctx.fillStyle='#253450';
      ctx.beginPath(); ctx.roundRect(tx-22, ty-14, 44, 14, 4); ctx.fill();
      ctx.strokeStyle='#2e3c60'; ctx.lineWidth=1; ctx.stroke();

      // ── Length label along ramp centre ────────────────────────────────────
      // Raw atan2 gives ~-30° (left-down), which renders text mirrored.
      // Adding PI flips it so text reads correctly left→right along the ramp.
      const midX = (tx+bx)/2, midY = (ty+by)/2;
      ctx.save();
      ctx.translate(midX, midY);
      ctx.rotate(Math.atan2(by-ty, bx-tx) + Math.PI);
      ctx.fillStyle='rgba(77,240,176,0.6)'; ctx.font='12px DM Mono,monospace';
      ctx.textAlign='center'; ctx.fillText('L = '+_L.toFixed(2)+' m', 0, -12);
      ctx.restore();

      // ── Lane labels above high end — right-aligned to avoid clipping ─────
      const hObj = Physics.OBJECTS[_heavyKey];
      ctx.font='11px DM Mono,monospace';
      ctx.fillStyle=(hObj.trackColor||'#c77dff')+'cc';
      ctx.textAlign='right';
      ctx.fillText(hObj.label, Math.min(tx+bRx+50, W-8), ty+bRy-26);
      ctx.fillStyle=LIGHT_OBJ.trackColor+'cc';
      ctx.fillText(LIGHT_OBJ.label, Math.min(tx+60, W-8), ty-26);
    }

    function _drawGhostTrails() {
      if (_trail.length < 2) return;
      const hObj = Physics.OBJECTS[_heavyKey];
      _trail.forEach((snap, i) => {
        const alpha = (i / _trail.length) * 0.30;
        ctx.save(); ctx.globalAlpha = alpha;
        const pH = _rampPos(snap.sH, 'back');
        const pL = _rampPos(snap.sL, 'front');
        ctx.beginPath(); ctx.arc(pH.x, pH.y, (hObj.radius||14)*0.55, 0, Math.PI*2);
        ctx.fillStyle=hObj.trackColor||'#c77dff'; ctx.fill();
        ctx.beginPath(); ctx.arc(pL.x, pL.y, LIGHT_OBJ.radius*0.55, 0, Math.PI*2);
        ctx.fillStyle=LIGHT_OBJ.trackColor; ctx.fill();
        ctx.restore();
      });
    }

    function _drawObjects() {
      // Draw front lane first (visually behind in our layout since back is raised)
      _drawBall(_light.s, LIGHT_OBJ,               'front', _light.landed);
      _drawBall(_heavy.s, Physics.OBJECTS[_heavyKey], 'back', _heavy.landed);
    }

    function _drawBall(s, obj, lane, landed) {
      const pos = _rampPos(s, lane);
      const r   = obj.radius || 12;
      const col = obj.trackColor || '#4df0b0';

      // Shadow ellipse cast onto ramp surface
      ctx.save(); ctx.globalAlpha=0.2;
      ctx.beginPath(); ctx.ellipse(pos.x+4, pos.y+r*0.6, r*1.15, r*0.4, 0, 0, Math.PI*2);
      ctx.fillStyle='#000'; ctx.fill(); ctx.restore();

      // Glow halo
      const halo = ctx.createRadialGradient(pos.x,pos.y,0,pos.x,pos.y,r*2.4);
      halo.addColorStop(0, col+'30'); halo.addColorStop(1,'transparent');
      ctx.beginPath(); ctx.arc(pos.x,pos.y,r*2.4,0,Math.PI*2);
      ctx.fillStyle=halo; ctx.fill();

      // Sphere gradient
      const sph = ctx.createRadialGradient(pos.x-r*0.35,pos.y-r*0.35,r*0.04,pos.x,pos.y,r);
      sph.addColorStop(0,   obj.shine||'#fff');
      sph.addColorStop(0.5, obj.color+'dd');
      sph.addColorStop(1,   obj.color+'88');
      ctx.beginPath(); ctx.arc(pos.x,pos.y,r,0,Math.PI*2);
      ctx.fillStyle=sph;
      ctx.shadowColor=col+'55'; ctx.shadowBlur=landed ? 0 : 18;
      ctx.fill();
      ctx.strokeStyle=col+'99'; ctx.lineWidth=1.5; ctx.stroke();
      ctx.shadowBlur=0;

      // Specular highlight
      ctx.beginPath(); ctx.arc(pos.x-r*0.3, pos.y-r*0.32, r*0.22, 0, Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.34)'; ctx.fill();

      if (landed) {
        ctx.font='600 10px DM Mono,monospace'; ctx.textAlign='center';
        ctx.fillStyle=col; ctx.fillText('LANDED', pos.x, pos.y+r+16);
      }
    }

    function _drawFinishLine() {
      const { bx, by, tx, ty, Lpx } = _geo();
      // Ramp unit vector (high→low): (bx-tx, by-ty)/Lpx  (points left-down)
      // Perpendicular (90° CCW, pointing above ramp surface): (-(by-ty), bx-tx)/Lpx = (ty-by, bx-tx)/Lpx
      const px = (ty - by) / Lpx;   // positive (points upward)
      const py = (bx - tx) / Lpx;   // negative (points leftward-up)
      ctx.save();
      ctx.strokeStyle='rgba(255,107,107,0.65)'; ctx.lineWidth=1.5; ctx.setLineDash([4,4]);
      ctx.beginPath();
      ctx.moveTo(bx + px*58, by + py*58);
      ctx.lineTo(bx - px*10, by - py*10);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle='rgba(255,107,107,0.65)'; ctx.font='10px DM Mono,monospace';
      ctx.textAlign='center'; ctx.fillText('FINISH', bx + px*70, by + py*70);
      ctx.restore();
    }

    function _drawStopwatch() {
      const s   = Math.floor(_swTime);
      const ms  = Math.floor((_swTime - s) * 1000);
      const txt = String(s).padStart(2,'0') + '.' + String(ms).padStart(3,'0') + ' s';
      ctx.save();
      ctx.font='700 28px DM Mono,monospace'; ctx.textAlign='left';
      ctx.fillStyle  = _swRunning ? '#4df0b0' : (_swTime > 0 ? '#4df0b0' : '#253040');
      ctx.shadowColor= _swRunning ? '#4df0b055' : 'transparent';
      ctx.shadowBlur = _swRunning ? 16 : 0;
      ctx.fillText(txt, PAD_LEFT, 46); ctx.shadowBlur = 0;
      ctx.font='10px DM Mono,monospace'; ctx.fillStyle='#3a4a60';
      ctx.fillText('STOPWATCH', PAD_LEFT, 60);
      ctx.restore();
    }

    function _drawDataBar() {
      const tH  = _heavy.landT !== null ? _heavy.landT.toFixed(3) + ' s'       : '—';
      const tL  = _light.landT !== null ? _light.landT.toFixed(3) + ' s'       : '—';
      const t2H = _heavy.landT !== null ? (_heavy.landT**2).toFixed(4) + ' s²' : '—';
      const tTh = Physics.rampTime(_L, FIXED_ANGLE_DEG).toFixed(3) + ' s';
      const items = [
        { label:'L',         val:_L.toFixed(2)+' m',    color:'#4df0b0' },
        { label:'θ (fixed)', val:FIXED_ANGLE_DEG+'°',   color:'#4df0b0' },
        { label:'t theory',  val:tTh,                    color:'#ffd166' },
        { label:'t heavy',   val:tH,                     color:'#c77dff' },
        { label:'t light',   val:tL,                     color:'#ffd166' },
        { label:'t²',        val:t2H,                    color:'#4df0b0' },
      ];
      ctx.save(); ctx.font='10px DM Mono,monospace';
      let x = PAD_LEFT; const y = H - 14;
      items.forEach(item => {
        ctx.fillStyle='#3a4a60'; ctx.textAlign='left';
        ctx.fillText(item.label, x, y-16);
        ctx.fillStyle=item.color;
        ctx.fillText(item.val, x, y);
        x += Math.max(ctx.measureText(item.val).width, ctx.measureText(item.label).width) + 26;
      });
      ctx.restore();
    }

    function _drawHint() {
      ctx.save(); ctx.font='13px DM Sans,sans-serif'; ctx.textAlign='center';
      ctx.fillStyle='rgba(77,240,176,0.4)';
      ctx.fillText('Click ▶ Release — stopwatch starts automatically', W/2, H-PAD_BTM-14);
      ctx.restore();
    }

    // ── PUBLIC ────────────────────────────────────────────────────────────────
    function onBothLanded(fn) { _onBothLanded = fn; }
    function onReset(fn)      { _onReset = fn; }
    function getState() {
      return {
        released:_released, running:_running,
        sHeavy:_heavy.s, sLight:_light.s,
        tHeavy:_heavy.landT, tLight:_light.landT,
        doneHeavy:_heavy.landed, doneLight:_light.landed,
        simT:_simT, swTime:_swTime, L:_L, angleDeg:FIXED_ANGLE_DEG,
      };
    }

    _rafId = requestAnimationFrame(_drawStatic);

    return { setParams, release, pause, resume, reset, recordRun, onBothLanded, onReset, getState, FIXED_ANGLE_DEG };
  }

  return { create };
})();

if (typeof module !== 'undefined') module.exports = DrawRamp;

/**
 * blob.js — PARTICLE game character
 * The blob. Aristotelian by default. Reluctant traveller.
 *
 * No dependencies. Pure canvas 2D.
 * Usage: const b = Blob.create(x, y); b.update(dt); b.draw(ctx);
 */

const Blob = (() => {

  // ── CONSTANTS ────────────────────────────────────────────────────────────────

  const BASE_RADIUS      = 28;
  const WOBBLE_AMPLITUDE = 3;
  const WOBBLE_SPEED     = 1.8;
  const NUM_POINTS       = 8;
  const COLOUR_LERP      = 0.03;
  const SQUISH_RECOVERY  = 0.08;
  const EYE_RADIUS       = 3.5;
  const EYE_OFFSET_X     = 8;
  const EYE_OFFSET_Y     = -4;
  const BUBBLE_MAX_W     = 220;
  const BUBBLE_PADDING   = 12;
  const BUBBLE_FONT      = '0.72rem DM Mono, monospace';
  const BUBBLE_LINE_H    = 16;
  const BUBBLE_FADE_IN   = 300;   // ms
  const BUBBLE_HOLD      = 3500;  // ms
  const BUBBLE_FADE_OUT  = 500;   // ms

  // ── PARTICLE CONSTANTS ────────────────────────────────────────────────────────
  const MAX_PARTICLES    = 24;    // total pool size

  // ── COLOUR PALETTE ───────────────────────────────────────────────────────────

  const PALETTE = {
    neutral:   { h: 270, s: 40, l: 60 },
    confused:  { h: 240, s: 40, l: 63 },
    offended:  { h: 320, s: 42, l: 63 },
    alarmed:   { h: 280, s: 52, l: 73 },
    smug:      { h: 260, s: 45, l: 52 },
    resigned:  { h: 265, s: 15, l: 58 },
    impressed: { h: 290, s: 42, l: 63 },
  };

  // ── EXPRESSION DEFINITIONS ───────────────────────────────────────────────────
  // eyeScale: multiplier on EYE_RADIUS
  // eyeSpreadX: multiplier on EYE_OFFSET_X
  // eyeOffsetY: additive px adjustment
  // mouthCurve: bezier control point vertical offset (+smile, -frown)
  // mouthWidth: half-width of mouth in px
  // wobbleScale: multiplier on WOBBLE_AMPLITUDE
  // wobbleSpeedScale: multiplier on WOBBLE_SPEED

  const EXPRESSIONS = {
    neutral: {
      eyeScale: 1.0, eyeSpreadX: 1.0, eyeOffsetY: 0,
      mouthCurve: 0, mouthWidth: 9,
      wobbleScale: 1.0, wobbleSpeedScale: 1.0,
      bodyPuff: 0,
    },
    confused: {
      eyeScale: 1.1, eyeSpreadX: 1.15, eyeOffsetY: -1,
      mouthCurve: -2, mouthWidth: 8,
      wobbleScale: 1.1, wobbleSpeedScale: 0.9,
      bodyPuff: 0,
    },
    offended: {
      eyeScale: 0.75, eyeSpreadX: 0.9, eyeOffsetY: 1,
      mouthCurve: -4, mouthWidth: 10,
      wobbleScale: 1.2, wobbleSpeedScale: 1.1,
      bodyPuff: 0.06,
    },
    alarmed: {
      eyeScale: 1.5, eyeSpreadX: 0.7, eyeOffsetY: -3,
      mouthCurve: 0, mouthWidth: 5,   // small O
      wobbleScale: 0.5, wobbleSpeedScale: 2.0,
      bodyPuff: 0,
    },
    smug: {
      eyeScale: 0.65, eyeSpreadX: 1.0, eyeOffsetY: 1,
      mouthCurve: 3, mouthWidth: 10,
      wobbleScale: 0.7, wobbleSpeedScale: 0.7,  // slow, self-satisfied
      bodyPuff: 0.04,
    },
    resigned: {
      eyeScale: 0.85, eyeSpreadX: 1.0, eyeOffsetY: 2,
      mouthCurve: -1, mouthWidth: 9,
      wobbleScale: 0.5, wobbleSpeedScale: 0.6,  // tired
      bodyPuff: -0.05,
    },
    impressed: {
      eyeScale: 1.25, eyeSpreadX: 1.1, eyeOffsetY: -2,
      mouthCurve: 4, mouthWidth: 11,
      wobbleScale: 1.3, wobbleSpeedScale: 1.2,
      bodyPuff: 0,
    },
  };

  // ── FACTORY ──────────────────────────────────────────────────────────────────

  function create(x, y) {

    // Position (canvas px)
    let _x = x;
    let _y = y;

    // Time accumulator (seconds) — drives wobble
    let _t = Math.random() * Math.PI * 2; // random phase start

    // Current and target colour (HSL components)
    let _col    = { ...PALETTE.smug };   // starts smug — Aristotelian default
    let _colTgt = { ...PALETTE.smug };

    // Current and target expression key
    let _expr    = 'smug';
    let _exprTgt = 'smug';

    // Interpolated expression params (lerped toward target each frame)
    let _ep = { ...EXPRESSIONS.smug };

    // Squish state
    // axis: angle in radians of the force causing squish
    // amount: 0=none, 1=flat. Applied as scaleX = 1+amount, scaleY = 1-amount along axis
    let _squish      = 0;
    let _squishAxis  = 0;
    let _squishTgt   = 0;

    // Bounce — quick vertical bounce on target hit
    let _bounceY  = 0;
    let _bounceVy = 0;

    // Particles — emotive effects above blob
    // Each: { type, x, y, vx, vy, life, maxLife, size, angle, rotSpeed }
    let _particles = [];

    // Speech bubble state
    let _bubble = null;
    // _bubble = { lines[], alpha, phase:'in'|'hold'|'out', elapsed, totalHold }

    // ── PRIVATE HELPERS ────────────────────────────────────────────────────────

    function _lerpHSL(a, b, t) {
      // Hue interpolation takes shortest path around the circle
      let dh = b.h - a.h;
      if (dh > 180)  dh -= 360;
      if (dh < -180) dh += 360;
      return {
        h: a.h + dh * t,
        s: a.s + (b.s - a.s) * t,
        l: a.l + (b.l - a.l) * t,
      };
    }

    function _lerpNum(a, b, t) { return a + (b - a) * t; }

    function _hsl(col, alpha = 1) {
      return `hsla(${col.h.toFixed(1)},${col.s.toFixed(1)}%,${col.l.toFixed(1)}%,${alpha})`;
    }

    // Compute blob outline points for current time + squish
    function _blobPoints(cx, cy, time, expr) {
      const pts = [];
      const amp   = WOBBLE_AMPLITUDE * expr.wobbleScale;
      const speed = WOBBLE_SPEED * expr.wobbleSpeedScale;
      const puff  = 1 + expr.bodyPuff;

      for (let i = 0; i < NUM_POINTS; i++) {
        const angle = (i / NUM_POINTS) * Math.PI * 2;
        const phase = (i / NUM_POINTS) * Math.PI * 2 * 1.618; // golden ratio phase
        const r = (BASE_RADIUS * puff) + Math.sin(time * speed + phase) * amp;

        // Apply squish: compress along force axis, expand perpendicular
        // A force pushing right flattens the blob left-right, bulges it up-down
        const cosA = Math.cos(_squishAxis);
        const sinA = Math.sin(_squishAxis);
        const localX = Math.cos(angle) * r;
        const localY = Math.sin(angle) * r;
        // Project onto force axis and perpendicular axis
        const along = localX * cosA + localY * sinA;
        const perp  = -localX * sinA + localY * cosA;
        // Compress along force axis, expand perpendicular (volume-preserving feel)
        const sAlong = along * (1 - _squish * 0.35);
        const sPerp  = perp  * (1 + _squish * 0.22);
        // Back to world space
        const wx = sAlong * cosA - sPerp * sinA;
        const wy = sAlong * sinA + sPerp * cosA;

        pts.push({ x: cx + wx, y: cy + wy + _bounceY });
      }
      return pts;
    }

    // Draw closed smooth curve through points using catmull-rom → bezier
    function _drawBlob(ctx, pts) {
      const n = pts.length;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        const p3 = pts[(i + 2) % n];
        // Catmull-Rom control points
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        if (i === 0) ctx.moveTo(p1.x, p1.y);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
      ctx.closePath();
    }

    function _drawEyes(ctx, cx, cy, expr) {
      const r   = EYE_RADIUS * expr.eyeScale;
      const ox  = EYE_OFFSET_X * expr.eyeSpreadX;
      const oy  = EYE_OFFSET_Y + expr.eyeOffsetY + _bounceY;
      const eyeH = _exprTgt === 'alarmed' ? r * 1.3 : r;

      // ── Eyes ──────────────────────────────────────────────────────────────
      ctx.fillStyle = '#12101e';
      ctx.beginPath(); ctx.ellipse(cx - ox, cy + oy, r, eyeH, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + ox, cy + oy, r, eyeH, 0, 0, Math.PI * 2); ctx.fill();

      // Smug half-lids
      if (_exprTgt === 'smug') {
        ctx.fillStyle = _hsl(_col);
        ctx.fillRect(cx - ox - r - 1, cy + oy - eyeH - 1, r * 2 + 2, eyeH * 0.72);
        ctx.fillRect(cx + ox - r - 1, cy + oy - eyeH - 1, r * 2 + 2, eyeH * 0.72);
      }

      // Highlights
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.arc(cx - ox + r * 0.3, cy + oy - eyeH * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + ox + r * 0.3, cy + oy - eyeH * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();

      // ── Eyebrows ──────────────────────────────────────────────────────────
      const browY  = cy + oy - eyeH - 5 + _bounceY;
      const browW  = r * 1.6;
      const browH  = 1.8;
      ctx.lineWidth = browH;
      ctx.lineCap   = 'round';

      if (_exprTgt === 'offended') {
        // Inner corners raised — classic anger V shape
        ctx.strokeStyle = '#12101e';
        ctx.beginPath();
        ctx.moveTo(cx - ox - browW * 0.5, browY - 3);
        ctx.lineTo(cx - ox + browW * 0.5, browY + 1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + ox + browW * 0.5, browY - 3);
        ctx.lineTo(cx + ox - browW * 0.5, browY + 1);
        ctx.stroke();

      } else if (_exprTgt === 'confused') {
        // Left brow raised, right brow flat
        ctx.strokeStyle = '#12101e';
        ctx.beginPath();
        ctx.moveTo(cx - ox - browW * 0.5, browY - 2);
        ctx.lineTo(cx - ox + browW * 0.5, browY - 5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + ox - browW * 0.5, browY);
        ctx.lineTo(cx + ox + browW * 0.5, browY);
        ctx.stroke();

      } else if (_exprTgt === 'alarmed') {
        // Both brows raised high, arched
        ctx.strokeStyle = '#12101e';
        ctx.beginPath();
        ctx.moveTo(cx - ox - browW * 0.5, browY - 2);
        ctx.quadraticCurveTo(cx - ox, browY - 7, cx - ox + browW * 0.5, browY - 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + ox - browW * 0.5, browY - 2);
        ctx.quadraticCurveTo(cx + ox, browY - 7, cx + ox + browW * 0.5, browY - 2);
        ctx.stroke();

      } else if (_exprTgt === 'resigned') {
        // Slightly drooping outer corners
        ctx.strokeStyle = 'rgba(18,16,30,0.6)';
        ctx.beginPath();
        ctx.moveTo(cx - ox - browW * 0.5, browY - 1);
        ctx.lineTo(cx - ox + browW * 0.5, browY + 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + ox - browW * 0.5, browY + 2);
        ctx.lineTo(cx + ox + browW * 0.5, browY - 1);
        ctx.stroke();

      } else if (_exprTgt === 'impressed') {
        // Raised, slight arch — pleasant surprise
        ctx.strokeStyle = '#12101e';
        ctx.beginPath();
        ctx.moveTo(cx - ox - browW * 0.5, browY - 3);
        ctx.quadraticCurveTo(cx - ox, browY - 6, cx - ox + browW * 0.5, browY - 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + ox - browW * 0.5, browY - 3);
        ctx.quadraticCurveTo(cx + ox, browY - 6, cx + ox + browW * 0.5, browY - 3);
        ctx.stroke();

      } else if (_exprTgt === 'smug') {
        // One brow slightly arched — the smug look
        ctx.strokeStyle = '#12101e';
        ctx.beginPath();
        ctx.moveTo(cx - ox - browW * 0.5, browY + 1);
        ctx.quadraticCurveTo(cx - ox, browY - 3, cx - ox + browW * 0.5, browY + 1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + ox - browW * 0.5, browY);
        ctx.lineTo(cx + ox + browW * 0.5, browY);
        ctx.stroke();
      }
    }

    function _drawMouth(ctx, cx, cy, expr) {
      const mw  = expr.mouthWidth;
      const mc  = expr.mouthCurve;
      const my  = cy + 7 + _bounceY;

      ctx.strokeStyle = '#12101e';
      ctx.lineWidth   = 2;
      ctx.lineCap     = 'round';
      ctx.beginPath();

      if (_expr === 'alarmed') {
        // Small O shape
        ctx.arc(cx, my, 4, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }

      // Quadratic bezier mouth
      ctx.moveTo(cx - mw, my);
      ctx.quadraticCurveTo(cx, my + mc, cx + mw, my);
      ctx.stroke();
    }

    // ── PARTICLE SYSTEM ────────────────────────────────────────────────────────

    function _spawnParticles(expr) {
      // Clear existing particles when expression changes
      _particles = [];

      const spread = BASE_RADIUS + 6;

      if (expr === 'offended') {
        // Manga anger marks — 4 jagged spike clusters upper area
        for (let i = 0; i < 4; i++) {
          const angle = -Math.PI * 0.9 + (i / 3) * Math.PI * 0.8; // arc above blob
          _particles.push({
            type: 'anger',
            x: _x + Math.cos(angle) * spread * 1.1,
            y: _y + Math.sin(angle) * spread * 0.7 - 8,
            vx: Math.cos(angle) * 12,
            vy: Math.sin(angle) * 10 - 18,
            life: 0, maxLife: 1.3,
            size: 7 + Math.random() * 4,
            angle: Math.random() * Math.PI,
            rotSpeed: (Math.random() - 0.5) * 2,
          });
        }
      } else if (expr === 'confused') {
        // Gas plumes — slow rising puffs
        for (let i = 0; i < 3; i++) {
          _particles.push({
            type: 'plume',
            x: _x + (i - 1) * 14,
            y: _y - spread + 4,
            vx: (i - 1) * 6 + (Math.random() - 0.5) * 4,
            vy: -22 - Math.random() * 10,
            life: 0, maxLife: 1.6,
            size: 5 + Math.random() * 4,
            delay: i * 0.18,
            angle: 0, rotSpeed: 0,
          });
        }
      } else if (expr === 'alarmed') {
        // Fast radiating shock lines
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          _particles.push({
            type: 'shock',
            x: _x + Math.cos(angle) * spread * 0.6,
            y: _y + Math.sin(angle) * spread * 0.6,
            vx: Math.cos(angle) * 55,
            vy: Math.sin(angle) * 55,
            life: 0, maxLife: 0.5,
            size: 8 + Math.random() * 4,
            angle, rotSpeed: 0,
          });
        }
      } else if (expr === 'impressed') {
        // Sparkles pop outward
        for (let i = 0; i < 5; i++) {
          const angle = -Math.PI * 0.85 + (i / 4) * Math.PI * 0.7;
          _particles.push({
            type: 'sparkle',
            x: _x + Math.cos(angle) * spread * 0.8,
            y: _y + Math.sin(angle) * spread * 0.8,
            vx: Math.cos(angle) * 35,
            vy: Math.sin(angle) * 35 - 10,
            life: 0, maxLife: 0.9,
            size: 4 + Math.random() * 3,
            angle: Math.random() * Math.PI,
            rotSpeed: (Math.random() - 0.5) * 6,
          });
        }
      } else if (expr === 'resigned') {
        // Slow drooping dots — sigh
        for (let i = 0; i < 3; i++) {
          _particles.push({
            type: 'sigh',
            x: _x + (i - 1) * 10,
            y: _y - spread + 2,
            vx: (i - 1) * 3,
            vy: 8 + Math.random() * 6,   // drifts DOWN — deflated
            life: 0, maxLife: 1.4,
            size: 3 + Math.random() * 2,
            delay: i * 0.22,
            angle: 0, rotSpeed: 0,
          });
        }
      }
    }

    function _updateParticles(dt) {
      _particles = _particles.filter(p => p.life < p.maxLife);
      for (const p of _particles) {
        p.life  += dt;
        p.x     += p.vx * dt;
        p.y     += p.vy * dt;
        p.angle += p.rotSpeed * dt;
        // Decelerate
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
    }

    function _drawParticles(ctx) {
      for (const p of _particles) {
        const delay = p.delay || 0;
        const elapsed = p.life - delay;
        if (elapsed < 0) continue;
        const t = Math.min(elapsed / p.maxLife, 1);
        // Fade: in quickly, out slowly
        const alpha = t < 0.2 ? t / 0.2 : 1 - ((t - 0.2) / 0.8);
        if (alpha <= 0) continue;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        if (p.type === 'anger') {
          // Manga anger mark — two crossing lines forming ✕ with jagged ends
          ctx.strokeStyle = '#ff4466';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'square';
          const s = p.size * (1 - t * 0.3); // shrinks slightly over time
          // Draw 4-pointed star / cross shape
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3);
            ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
            ctx.stroke();
          }
          // Small cross lines at tips for jagged look
          ctx.lineWidth = 1.5;
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI;
            const tx = Math.cos(a) * s;
            const ty = Math.sin(a) * s;
            const perp = a + Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(tx + Math.cos(perp) * 3, ty + Math.sin(perp) * 3);
            ctx.lineTo(tx - Math.cos(perp) * 3, ty - Math.sin(perp) * 3);
            ctx.stroke();
          }

        } else if (p.type === 'plume') {
          // Gas plume — rounded teardrop puff
          const r = p.size * (0.5 + t * 0.8); // grows as it rises
          ctx.fillStyle = 'rgba(180,180,220,0.7)';
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          // Highlight
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath();
          ctx.arc(-r * 0.25, -r * 0.25, r * 0.4, 0, Math.PI * 2);
          ctx.fill();

        } else if (p.type === 'shock') {
          // Short radiating line
          const len = p.size * (1 - t * 0.5);
          ctx.strokeStyle = '#ffdd44';
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(len, 0);
          ctx.stroke();

        } else if (p.type === 'sparkle') {
          // 4-point star sparkle
          const r = p.size * (1 - t * 0.4);
          ctx.strokeStyle = '#ffe866';
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            ctx.stroke();
          }
          // Centre dot
          ctx.fillStyle = '#ffe866';
          ctx.beginPath();
          ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
          ctx.fill();

        } else if (p.type === 'sigh') {
          // Small drooping dot
          const r = p.size * (1 - t * 0.3);
          ctx.fillStyle = 'rgba(150,150,180,0.75)';
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }

    // ── SPEECH BUBBLE ──────────────────────────────────────────────────────────

    function _wrapText(ctx, text, maxWidth) {
      const words = text.split(' ');
      const lines = [];
      let line = '';
      ctx.font = BUBBLE_FONT;
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth - BUBBLE_PADDING * 2) {
          if (line) lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      return lines.slice(0, 3); // max 3 lines
    }

    function _drawBubble(ctx, cx, cy) {
      if (!_bubble || _bubble.alpha <= 0.01) return;

      ctx.font = BUBBLE_FONT;
      const lines = _bubble.lines;
      const lh    = BUBBLE_LINE_H;
      const bw    = BUBBLE_MAX_W;
      const bh    = lines.length * lh + BUBBLE_PADDING * 2;
      const alpha = _bubble.alpha;

      // Determine bubble position — prefer above-right, avoid edges
      // cx, cy are blob centre
      const margin = 12;
      let bx = cx + BASE_RADIUS + margin;
      let by = cy - bh / 2;

      // Canvas bounds check — assume ctx.canvas exists
      const cw = ctx.canvas ? ctx.canvas.width  : 800;
      const ch = ctx.canvas ? ctx.canvas.height : 600;

      if (bx + bw > cw - 10) bx = cx - BASE_RADIUS - margin - bw;
      if (by < 10)            by = 10;
      if (by + bh > ch - 10) by = ch - bh - 10;

      // Pointer tip — midpoint of bubble left/right edge toward blob
      const pointerSide = bx > cx ? 'left' : 'right';
      const tipX = pointerSide === 'left' ? bx : bx + bw;
      const tipY = by + bh / 2;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Shadow
      ctx.shadowColor  = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur   = 12;
      ctx.shadowOffsetY = 3;

      // Bubble fill
      ctx.fillStyle = 'rgba(15,16,32,0.92)';
      _roundRect(ctx, bx, by, bw, bh, 10);
      ctx.fill();

      // Bubble border — blob colour at 50% opacity
      ctx.strokeStyle = _hsl(_col, 0.5);
      ctx.lineWidth   = 1;
      _roundRect(ctx, bx, by, bw, bh, 10);
      ctx.stroke();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur  = 0;

      // Pointer triangle
      ctx.fillStyle = 'rgba(15,16,32,0.92)';
      ctx.beginPath();
      if (pointerSide === 'left') {
        ctx.moveTo(bx, tipY - 6);
        ctx.lineTo(bx - 8, tipY);
        ctx.lineTo(bx, tipY + 6);
      } else {
        ctx.moveTo(bx + bw, tipY - 6);
        ctx.lineTo(bx + bw + 8, tipY);
        ctx.lineTo(bx + bw, tipY + 6);
      }
      ctx.closePath();
      ctx.fill();

      // Text
      ctx.fillStyle = '#d8daf0';
      ctx.font      = BUBBLE_FONT;
      ctx.textBaseline = 'top';
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], bx + BUBBLE_PADDING, by + BUBBLE_PADDING + i * lh);
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function _roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    // ── PUBLIC METHODS ─────────────────────────────────────────────────────────

    /**
     * update(dt) — call every frame before draw
     * dt: elapsed seconds since last frame
     */
    function update(dt) {
      _t += dt;

      // Colour interpolation
      _col = _lerpHSL(_col, _colTgt, COLOUR_LERP);

      // Expression interpolation (numeric params)
      const tgt = EXPRESSIONS[_exprTgt];
      const ELRP = 0.06;
      for (const k of Object.keys(_ep)) {
        _ep[k] = _lerpNum(_ep[k], tgt[k], ELRP);
      }
      _expr = _exprTgt; // snap label immediately for conditionals

      // Squish decay
      _squish += (_squishTgt - _squish) * SQUISH_RECOVERY;
      _squishTgt *= 0.85; // squish target decays naturally

      // Particles
      _updateParticles(dt);

      // Bounce
      if (Math.abs(_bounceY) > 0.1 || Math.abs(_bounceVy) > 0.1) {
        _bounceVy += 180 * dt; // spring back to 0
        _bounceY  += _bounceVy * dt;
        if (_bounceY > 0) { _bounceY = 0; _bounceVy = 0; } // floor
      }

      // Speech bubble timing
      if (_bubble) {
        _bubble.elapsed += dt * 1000; // ms
        const fadeIn  = BUBBLE_FADE_IN;
        const hold    = _bubble.totalHold;
        const fadeOut = BUBBLE_FADE_OUT;
        const total   = fadeIn + hold + fadeOut;

        if (_bubble.elapsed < fadeIn) {
          _bubble.alpha = _bubble.elapsed / fadeIn;
        } else if (_bubble.elapsed < fadeIn + hold) {
          _bubble.alpha = 1;
        } else if (_bubble.elapsed < total) {
          _bubble.alpha = 1 - (_bubble.elapsed - fadeIn - hold) / fadeOut;
        } else {
          _bubble = null;
        }
      }
    }

    /**
     * draw(ctx) — render blob + bubble onto ctx
     */
    function draw(ctx) {
      const pts = _blobPoints(_x, _y, _t, _ep);

      // Glow
      const glow = ctx.createRadialGradient(_x, _y, 0, _x, _y, BASE_RADIUS * 1.8);
      glow.addColorStop(0,   _hsl(_col, 0.18));
      glow.addColorStop(1,   _hsl(_col, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(_x, _y, BASE_RADIUS * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Body fill gradient — slightly lighter at top
      const bodyGrad = ctx.createRadialGradient(
        _x - 6, _y - 8, 2,
        _x,     _y,     BASE_RADIUS * 1.4
      );
      bodyGrad.addColorStop(0, _hsl({ h: _col.h, s: _col.s, l: Math.min(80, _col.l + 14) }));
      bodyGrad.addColorStop(1, _hsl(_col));

      _drawBlob(ctx, pts);
      ctx.fillStyle   = bodyGrad;
      ctx.fill();

      // Body outline
      _drawBlob(ctx, pts);
      ctx.strokeStyle = _hsl({ h: _col.h, s: _col.s, l: _col.l - 12 }, 0.6);
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Face
      _drawEyes(ctx, _x, _y, _ep);
      _drawMouth(ctx, _x, _y, _ep);

      // Particles (drawn above blob body, below speech bubble)
      _drawParticles(ctx);

      // Speech bubble
      _drawBubble(ctx, _x, _y);
    }

    // ── EXTERNAL API ──────────────────────────────────────────────────────────

    /** Move blob to new position instantly */
    function setPosition(x, y) { _x = x; _y = y; }

    /** Get current position */
    function getPosition() { return { x: _x, y: _y }; }

    /**
     * setExpression(name)
     * Valid: neutral, confused, offended, alarmed, smug, resigned, impressed
     */
    function setExpression(name) {
      if (!EXPRESSIONS[name]) return;
      if (_exprTgt !== name) _spawnParticles(name); // spawn on change only
      _exprTgt    = name;
      _colTgt     = { ...PALETTE[name] };
    }

    /**
     * squish(axis, amount, durationMs)
     * axis: radians — direction of applied force
     * amount: 0–1 squish intensity
     */
    function squish(axis, amount = 0.3, durationMs = 350) {
      _squishAxis = axis;
      _squishTgt  = Math.min(1, amount);
      // Recovery is handled by natural decay — duration hint unused for now
      // but stored for future spring-damper upgrade
      void durationMs;
    }

    /** Bounce upward (on target hit) */
    function bounce() {
      _bounceVy = -120;
    }

    /**
     * say(text)
     * Display speech bubble with text. Interrupts any current bubble.
     */
    function say(text) {
      // Need a temporary canvas to measure text — reuse a cached one
      const tmp = say._tmpCtx || (() => {
        const c = document.createElement('canvas');
        say._tmpCtx = c.getContext('2d');
        return say._tmpCtx;
      })();
      tmp.font = BUBBLE_FONT;
      const lines = _wrapText(tmp, text, BUBBLE_MAX_W);
      _bubble = {
        lines,
        alpha:     0,
        elapsed:   0,
        totalHold: BUBBLE_HOLD,
      };
    }

    /** True if a bubble is currently showing */
    function isSpeaking() { return _bubble !== null && _bubble.alpha > 0.01; }

    /** Force-clear any active bubble */
    function clearBubble() { _bubble = null; }

    /** Current expression key */
    function expression() { return _exprTgt; }

    return {
      update,
      draw,
      setPosition,
      getPosition,
      setExpression,
      squish,
      bounce,
      say,
      isSpeaking,
      clearBubble,
      expression,
    };
  }

  return { create };

})();

if (typeof module !== 'undefined') module.exports = Blob;

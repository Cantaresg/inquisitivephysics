/**
 * engine.js — PARTICLE game 2D physics engine
 * No dependencies. Extends patterns from physics.js but fully 2D.
 *
 * Usage:
 *   const eng = Engine.create(levelConfig, envConfig);
 *   eng.applyForce(fx, fy);   // continuous mode
 *   eng.applyImpulse(fx, fy); // impulsive mode
 *   eng.update(dt);
 *   const s = eng.getState();
 */

const Engine = (() => {

  // ── CONSTANTS ──────────────────────────────────────────────────────────────
  const G_PX        = 400;   // 1g in px/s² (tuned for screen scale)
  const SUBSTEPS    = 2;     // RK4 substeps per frame — safety for fast objects
  const MAX_SPEED   = 1200;  // px/s — hard clamp prevents tunnelling
  const BOUNCE_DAMP = 0.45;  // velocity retained on wall bounce (energy loss)
  const GROUND_DAMP = 0.35;

  // ── ENVIRONMENT CONFIGS ───────────────────────────────────────────────────
  // Referenced by id from level-data.js
  const ENVIRONMENTS = {
    deep_space: {
      id:          'deep_space',
      gravity:     0,
      dragCoeff:   0,
      frictionCoeff: 0,
      hasTerrain:  false,
    },
    near_planet: {
      id:          'near_planet',
      gravity:     0.18,      // fraction of G_PX
      dragCoeff:   0,
      frictionCoeff: 0,
      hasTerrain:  false,
    },
    atmosphere: {
      id:          'atmosphere',
      gravity:     0.6,
      dragCoeff:   0.0008,    // quadratic drag coefficient (tuned)
      frictionCoeff: 0,
      hasTerrain:  false,
    },
    surface: {
      id:          'surface',
      gravity:     1.0,
      dragCoeff:   0.0005,
      frictionCoeff: 0.25,
      hasTerrain:  true,
    },
  };

  // ── RK4 2D INTEGRATOR ─────────────────────────────────────────────────────
  // state = { x, y, vx, vy }
  // accelFn(state) → { ax, ay }

  function _rk4(state, dt, accelFn) {
    const { x, y, vx, vy } = state;

    const a1 = accelFn({ x, y, vx, vy });
    const k1 = { dx: vx, dy: vy, dvx: a1.ax, dvy: a1.ay };

    const s2 = { x: x+0.5*dt*k1.dx, y: y+0.5*dt*k1.dy, vx: vx+0.5*dt*k1.dvx, vy: vy+0.5*dt*k1.dvy };
    const a2 = accelFn(s2);
    const k2 = { dx: s2.vx, dy: s2.vy, dvx: a2.ax, dvy: a2.ay };

    const s3 = { x: x+0.5*dt*k2.dx, y: y+0.5*dt*k2.dy, vx: vx+0.5*dt*k2.dvx, vy: vy+0.5*dt*k2.dvy };
    const a3 = accelFn(s3);
    const k3 = { dx: s3.vx, dy: s3.vy, dvx: a3.ax, dvy: a3.ay };

    const s4 = { x: x+dt*k3.dx, y: y+dt*k3.dy, vx: vx+dt*k3.dvx, vy: vy+dt*k3.dvy };
    const a4 = accelFn(s4);
    const k4 = { dx: s4.vx, dy: s4.vy, dvx: a4.ax, dvy: a4.ay };

    return {
      x:  x  + (dt/6)*(k1.dx  + 2*k2.dx  + 2*k3.dx  + k4.dx),
      y:  y  + (dt/6)*(k1.dy  + 2*k2.dy  + 2*k3.dy  + k4.dy),
      vx: vx + (dt/6)*(k1.dvx + 2*k2.dvx + 2*k3.dvx + k4.dvx),
      vy: vy + (dt/6)*(k1.dvy + 2*k2.dvy + 2*k3.dvy + k4.dvy),
    };
  }

  // ── FACTORY ───────────────────────────────────────────────────────────────

  function create(levelCfg, canvasW, canvasH) {

    const env     = ENVIRONMENTS[levelCfg.environment] || ENVIRONMENTS.deep_space;
    const mass    = levelCfg.blobMass ?? 1.0;   // null treated as 1.0 (massless phase)
    const maxForce = levelCfg.maxForce ?? 300;

    // Physics state
    let _state = {
      x:  levelCfg.blobStartPos.x * canvasW,
      y:  levelCfg.blobStartPos.y * canvasH,
      vx: levelCfg.blobStartVel?.x ?? 0,
      vy: levelCfg.blobStartVel?.y ?? 0,
    };

    // Applied force this frame (continuous mode)
    let _force = { x: 0, y: 0 };

    // Pending impulse (impulsive mode) — applied once then cleared
    let _impulse = { x: 0, y: 0, pending: false };

    // Stats for star criteria
    let _forceApplications = 0;   // count of discrete force events
    let _offScreenCount    = 0;   // times blob left canvas
    let _hitTarget         = false;

    // Stop-target hold state
    let _stopped       = false;   // blob currently held at a stop target
    let _stopTimer     = 0;       // seconds held so far
    const STOP_HOLD    = 2.0;     // seconds to hold before releasing

    // Canvas bounds (updated on resize)
    let _W = canvasW;
    let _H = canvasH;
    const BLOB_R = 28; // matches blob.js BASE_RADIUS

    // ── ACCELERATION FUNCTION ───────────────────────────────────────────────

    function _accel(s) {
      let ax = _force.x / mass;
      let ay = _force.y / mass;

      // Gravity
      ay += env.gravity * G_PX;

      // Quadratic drag (opposes velocity)
      const speed = Math.hypot(s.vx, s.vy);
      if (speed > 0.01 && env.dragCoeff > 0) {
        const dragMag = env.dragCoeff * speed * speed;
        ax -= dragMag * (s.vx / speed);
        ay -= dragMag * (s.vy / speed);
      }

      // Ground friction (only when on ground — detected post-integrate)
      // Handled in collision resolution, not here

      return { ax, ay };
    }

    // ── COLLISION RESOLUTION ─────────────────────────────────────────────────

    function _resolveWalls(s) {
      let { x, y, vx, vy } = s;
      let hitWall = false;

      if (x - BLOB_R < 0)    { x = BLOB_R;      vx = Math.abs(vx) * BOUNCE_DAMP; hitWall = true; }
      if (x + BLOB_R > _W)   { x = _W - BLOB_R; vx = -Math.abs(vx) * BOUNCE_DAMP; hitWall = true; }
      if (y - BLOB_R < 0)    { y = BLOB_R;      vy = Math.abs(vy) * BOUNCE_DAMP; hitWall = true; }
      if (y + BLOB_R > _H)   { y = _H - BLOB_R; vy = -Math.abs(vy) * BOUNCE_DAMP; hitWall = true; }

      return { x, y, vx, vy, hitWall };
    }

    // Check if blob has exited canvas bounds (before resolution)
    function _isOffScreen(s) {
      return s.x < -BLOB_R*2 || s.x > _W+BLOB_R*2 ||
             s.y < -BLOB_R*2 || s.y > _H+BLOB_R*2;
    }

    // Speed clamp
    function _clampSpeed(s) {
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > MAX_SPEED) {
        const scale = MAX_SPEED / sp;
        return { ...s, vx: s.vx*scale, vy: s.vy*scale };
      }
      return s;
    }

    // ── TARGET CHECK ─────────────────────────────────────────────────────────

    function _checkTargets(targets) {
      if (!targets) return { hit: false, idx: -1 };
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (t.hit) continue;
        const dx = _state.x - t.x;
        const dy = _state.y - t.y;
        const dist = Math.hypot(dx, dy);
        if (dist < BLOB_R + t.radius) {
          return { hit: true, idx: i };
        }
      }
      return { hit: false, idx: -1 };
    }

    // ── PUBLIC ────────────────────────────────────────────────────────────────

    /**
     * update(dt, targets)
     * dt: seconds
     * targets: array of { x, y, radius, hit } — modified in place on hit
     * Returns: { offScreen, hitTarget, hitIdx, triggerHints }
     */
    function update(dt, targets) {
      const subDt = dt / SUBSTEPS;
      let offScreen = false;
      const triggerHints = new Set();

      // Apply pending impulse
      if (_impulse.pending) {
        _state.vx += _impulse.x / mass;
        _state.vy += _impulse.y / mass;
        _impulse = { x:0, y:0, pending:false };
        _forceApplications++;
      }

      // Track force application for continuous mode
      const forceMag = Math.hypot(_force.x, _force.y);
      if (forceMag > 0.5) {
        // Detect trigger hints from force direction vs velocity
        const velMag = Math.hypot(_state.vx, _state.vy);
        if (velMag > 20) {
          const velAngle   = Math.atan2(_state.vy, _state.vx);
          const forceAngle = Math.atan2(_force.y, _force.x);
          let diff = forceAngle - velAngle;
          // Normalise to [-PI, PI]
          while (diff >  Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const absDiff = Math.abs(diff);

          if (absDiff > Math.PI * 0.75) triggerHints.add('opposing_force');
          else if (absDiff > Math.PI * 0.38 && absDiff < Math.PI * 0.62) triggerHints.add('perpendicular');
        }
      }

      // RK4 substeps
      for (let i = 0; i < SUBSTEPS; i++) {
        if (_isOffScreen(_state)) { offScreen = true; break; }
        _state = _rk4(_state, subDt, _accel);
        _state = _clampSpeed(_state);
      }

      // Off-screen handling
      if (offScreen) {
        _offScreenCount++;
        triggerHints.add('off_screen');
        // Reset to safe position with dampened velocity
        _state.x  = Math.max(BLOB_R, Math.min(_W-BLOB_R, _state.x));
        _state.y  = Math.max(BLOB_R, Math.min(_H-BLOB_R, _state.y));
        _state.vx *= -BOUNCE_DAMP;
        _state.vy *= -BOUNCE_DAMP;
      } else {
        // Wall resolution (gentle bounce)
        const resolved = _resolveWalls(_state);
        if (resolved.hitWall) {
          _state = { ..._state, ...resolved };
        }
      }

      // Coasting detection
      const vel = Math.hypot(_state.vx, _state.vy);
      if (vel > 30 && forceMag < 0.5 && !_impulse.pending) {
        triggerHints.add('coasting');
      }

      // Friction drag detection (atmosphere/surface — blob slowing without player)
      if (env.dragCoeff > 0 && vel > 20 && forceMag < 0.5) {
        triggerHints.add('friction_felt');
      }

      // Target check
      const { hit, idx } = _checkTargets(targets);
      if (hit) {
        const tgt = targets[idx];
        tgt.hit    = true;
        _hitTarget = true;
        triggerHints.add('correct_hit');
        _state.x  = tgt.x;
        _state.y  = tgt.y;
        _state.vx = 0;
        _state.vy = 0;
        _force    = { x: 0, y: 0 };
        if (tgt.type === 'stop') {
          _stopped   = true;
          _stopTimer = 0;
        }
      }

      // Stop-target hold — keep blob locked for STOP_HOLD seconds
      if (_stopped) {
        _stopTimer += dt;
        _state.vx = 0;
        _state.vy = 0;
        _force    = { x: 0, y: 0 };
        if (_stopTimer >= STOP_HOLD) _stopped = false;
      }

      // Clear per-frame continuous force (must be re-applied each frame by input.js)
      // (do NOT clear here — input.js sets it before update, clears on mouseup)

      return {
        offScreen,
        hitTarget:    hit,
        hitIdx:       idx,
        triggerHints: [...triggerHints],
      };
    }

    /** Set continuous force vector (px/s² before mass division) */
    function applyForce(fx, fy) {
      const mag = Math.hypot(fx, fy);
      if (mag > maxForce) {
        const s = maxForce / mag;
        _force = { x: fx*s, y: fy*s };
      } else {
        _force = { x: fx, y: fy };
      }
      if (mag > 0.5) _forceApplications++;
    }

    /** Clear continuous force (on mouse up) */
    function clearForce() {
      _force = { x: 0, y: 0 };
    }

    /** Apply a single impulse (px/s, mass-scaled on next update) */
    function applyImpulse(px, py) {
      const mag = Math.hypot(px, py);
      const limit = maxForce * 0.12; // impulse scaled differently
      if (mag > limit) {
        const s = limit / mag;
        _impulse = { x: px*s, y: py*s, pending: true };
      } else {
        _impulse = { x: px, y: py, pending: true };
      }
    }

    /** Current physics state snapshot */
    function getState() {
      return {
        x:        _state.x,
        y:        _state.y,
        vx:       _state.vx,
        vy:       _state.vy,
        speed:    Math.hypot(_state.vx, _state.vy),
        velAngle: Math.atan2(_state.vy, _state.vx),
        force:    { ..._force },
        forceMag: Math.hypot(_force.x, _force.y),
      };
    }

    /** Update canvas dimensions on resize */
    function resize(w, h) { _W = w; _H = h; }

    /** Reset blob to level start */
    function resetLevel() {
      _state = {
        x:  levelCfg.blobStartPos.x * _W,
        y:  levelCfg.blobStartPos.y * _H,
        vx: levelCfg.blobStartVel?.x ?? 0,
        vy: levelCfg.blobStartVel?.y ?? 0,
      };
      _force              = { x: 0, y: 0 };
      _impulse            = { x: 0, y: 0, pending: false };
      _forceApplications  = 0;
      _offScreenCount     = 0;
      _hitTarget          = false;
      _stopped            = false;
      _stopTimer          = 0;
    }

    /** Star criteria evaluation */
    function evaluateStars(maxApplications) {
      if (!_hitTarget) return 0;
      let stars = 1;
      if (_forceApplications <= maxApplications) stars = 2;
      if (_forceApplications <= maxApplications && _offScreenCount === 0) stars = 3;
      return stars;
    }

    /** Current velocity angle in radians (for monologue squish axis) */
    function velAngle() { return Math.atan2(_state.vy, _state.vx); }

    function isStopped() { return _stopped; }
    function getStopProgress() { return _stopped ? _stopTimer / STOP_HOLD : 0; }

    return {
      update,
      applyForce,
      clearForce,
      applyImpulse,
      getState,
      resize,
      resetLevel,
      evaluateStars,
      velAngle,
      isStopped,
      getStopProgress,
      ENVIRONMENTS,
    };
  }

  return { create, ENVIRONMENTS };

})();

if (typeof module !== 'undefined') module.exports = Engine;

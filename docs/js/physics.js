/**
 * physics.js — Galileo Lab core physics engine
 * No dependencies. Pure functions only. All units SI.
 */

const Physics = (() => {

  const G = 9.81; // m/s²

  // ── RK4 INTEGRATOR ──────────────────────────────────────────────────────
  // Integrates 1D motion along ramp or vertical axis.
  // state = { s, v }  where s = position (m), v = velocity (m/s)
  // accelFn(s, v) → acceleration m/s²
  function rk4(state, dt, accelFn) {
    const { s, v } = state;
    const k1v = accelFn(s, v);
    const k1s = v;
    const k2v = accelFn(s + 0.5*dt*k1s, v + 0.5*dt*k1v);
    const k2s = v + 0.5*dt*k1v;
    const k3v = accelFn(s + 0.5*dt*k2s, v + 0.5*dt*k2v);
    const k3s = v + 0.5*dt*k2v;
    const k4v = accelFn(s + dt*k3s, v + dt*k3v);
    const k4s = v + dt*k3v;
    return {
      s: s + (dt/6)*(k1s + 2*k2s + 2*k3s + k4s),
      v: v + (dt/6)*(k1v + 2*k2v + 2*k3v + k4v),
    };
  }

  // ── RAMP PHYSICS ─────────────────────────────────────────────────────────
  // Returns acceleration along ramp surface (m/s²)
  // airOn: boolean — if false, pure frictionless ideal ramp
  // mu: coefficient of friction (only used if airOn = true for lab mode)
  function rampAccel(angleDeg, airOn, mu = 0) {
    const th = angleDeg * Math.PI / 180;
    const a  = G * Math.sin(th);
    if (!airOn) return a;
    // Lab mode: sliding friction (mu_k * N = mu * mg * cos theta)
    // mass cancels — acceleration is independent of mass
    const friction = mu * G * Math.cos(th);
    return Math.max(0, a - friction);
  }

  // Theoretical time to slide distance L from rest (no friction)
  function rampTime(L, angleDeg) {
    const a = rampAccel(angleDeg, false);
    return Math.sqrt(2 * L / a);
  }

  // ── VERTICAL DROP / DRAG PHYSICS ─────────────────────────────────────────
  // Returns acceleration for vertical free-fall with optional air drag.
  // Drag model: F_drag = 0.5 * rho * Cd * A * v²  (quadratic drag)
  // Terminal velocity: v_t = sqrt(2mg / (rho * Cd * A))
  //
  // object = { mass (kg), dragArea (m²), Cd (drag coefficient) }
  // airOn: boolean
  function dropAccel(object, airOn) {
    const { mass, dragArea, Cd } = object;
    const rho = 1.225; // air density kg/m³ at sea level
    return (s, v) => {
      const gravity = G;
      if (!airOn) return gravity;
      const drag = (0.5 * rho * Cd * dragArea * v * v) / mass;
      return Math.max(0, gravity - drag);
    };
  }

  // Terminal velocity (m/s) — useful for display
  function terminalVelocity(object) {
    const { mass, dragArea, Cd } = object;
    const rho = 1.225;
    return Math.sqrt((2 * mass * G) / (rho * Cd * dragArea));
  }

  // ── PRESET OBJECTS ────────────────────────────────────────────────────────
  // Used in both ramp and drop stages
  const OBJECTS = {
    ironBall: {
      label:    'Iron Ball',
      mass:     1.0,       // kg
      dragArea: 0.003,     // m² (radius ~3cm)
      Cd:       0.47,      // sphere
      radius:   14,        // canvas px
      color:    '#8899bb',
      shine:    '#c0d0ee',
      trackColor: '#c77dff',
    },
    feather: {
      label:    'Feather',
      mass:     0.001,     // kg (1 gram)
      dragArea: 0.008,     // m² — large relative to mass
      Cd:       1.2,       // non-streamlined
      radius:   10,
      color:    '#f5f0e8',
      shine:    '#ffffff',
      trackColor: '#ffd166',
    },
    stoneBall: {
      label:    'Stone',
      mass:     0.5,
      dragArea: 0.002,
      Cd:       0.47,
      radius:   12,
      color:    '#8a8070',
      shine:    '#b0a898',
      trackColor: '#c77dff',
    },
    paperFlat: {
      label:    'Flat Paper',
      mass:     0.005,     // 5 grams
      dragArea: 0.060,     // A4 sheet ~0.06 m²
      Cd:       1.17,      // flat plate
      radius:   0,         // drawn as rectangle
      width:    44,
      height:   6,
      color:    '#e8e4d8',
      shine:    '#f8f4ec',
      trackColor: '#ffd166',
    },
    paperCrumpled: {
      label:    'Crumpled Paper',
      mass:     0.005,
      dragArea: 0.004,     // much smaller when crumpled
      Cd:       0.47,
      radius:   10,
      color:    '#d8d0b8',
      shine:    '#ece8d8',
      trackColor: '#ffd166',
    },
    paperOnBook: {
      label:    'Paper (on book)',
      mass:     0.205,     // paper + book mass
      dragArea: 0.062,     // book face area
      Cd:       1.17,
      radius:   0,
      width:    44,
      height:   10,
      color:    '#5060a0',
      shine:    '#8090c8',
      trackColor: '#4df0b0',
    },
  };

  // ── UTILITIES ─────────────────────────────────────────────────────────────
  // Theoretical g from T²-L graph gradient
  // gradient = T²/L = 2/(g·sinθ)  →  g = 2/(gradient·sinθ)
  function gFromGradient(gradient, angleDeg) {
    const th = angleDeg * Math.PI / 180;
    return 2 / (gradient * Math.sin(th));
  }

  return {
    G,
    rk4,
    rampAccel,
    rampTime,
    dropAccel,
    terminalVelocity,
    gFromGradient,
    OBJECTS,
  };

})();

// Export for module environments (Node.js test harness)
if (typeof module !== 'undefined') module.exports = Physics;

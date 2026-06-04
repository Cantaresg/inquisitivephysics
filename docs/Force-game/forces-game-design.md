# Forces Game — Design Document
*Working title: PARTICLE*
*Version 0.1 — April 2026*

---

## 1. Overview

A browser-based 2D physics mini-game teaching Newton's Laws through direct force manipulation. The player controls a Ditto-like blob character travelling from deep space toward Earth, experiencing progressively richer physics at each environment layer. The blob is Aristotelian by default — it has strong opinions about how forces should work, and is repeatedly wrong.

**Target audience:** Secondary level (O-level), ages 13–17
**Platform:** Browser, HTML5 Canvas, no dependencies
**Session length:** 30–45 minutes for full arc; individual levels 2–4 minutes
**Pedagogical goal:** Newton's First and Second Laws, vector nature of force, emergence of mass as a concept — through experience, not instruction

---

## 2. Folder Structure

```
inquisitivephysics.github.io/
└── forces-game/
    ├── index.html          ← level select, environment, game shell
    ├── js/
    │   ├── blob.js         ← character: shape, expression, colour, squish, speech
    │   ├── monologue.js    ← line pools, trigger logic, cooldown, priority
    │   ├── engine.js       ← 2D physics: extends physics.js patterns
    │   │                      impulse mode, continuous mode, drag, friction
    │   ├── renderer.js     ← canvas draw: environment, terrain, blob, 
    │   │                      force arrows, velocity arrows, destructibles
    │   ├── input.js        ← click/touch handler → force vector computation
    │   ├── level-manager.js← level sequencing, environment transitions,
    │   │                      MCQ gating, progress persistence
    │   └── mcq.js          ← native game MCQ: full-screen, mini-sim playback
    └── data/
        ├── level-data.js   ← all level configs (teacher-editable)
        ├── monologue-data.js← all line pools (writer-editable)
        └── mcq-data.js     ← all MCQ content (teacher-editable)
```

**Separation principle:**
- `data/` files contain zero logic — only arrays and plain objects
- `js/` files contain zero hardcoded strings — only behaviour
- Adding a new level = one entry in `level-data.js`, no engine changes
- Adding monologue lines = one entry in `monologue-data.js`, no engine changes

---

## 3. Environment Progression

Four environments, traversed in order. Physics parameters are owned by the environment config — the engine reads them, no hardcoding.

```
ENVIRONMENT 0 — DEEP SPACE
  gravity:     0
  drag:        0
  friction:    0
  background:  #050a0a
  stars:       true
  horizon:     0%
  levels:      1–4

ENVIRONMENT 1 — NEAR PLANET  
  gravity:     0.15g (partial, increasing across levels)
  drag:        0
  friction:    0
  background:  #0a0a1a → #0a1020 (gradient shift across levels)
  stars:       true, fewer
  horizon:     30% visible, growing
  levels:      5–7

ENVIRONMENT 2 — ATMOSPHERE
  gravity:     0.6g
  drag:        low → medium across levels
  friction:    0
  background:  #1a1a2e
  particle drift: true (upward, speed-proportional)
  horizon:     70%
  levels:      8–10

ENVIRONMENT 3 — SURFACE
  gravity:     1.0g (full)
  drag:        medium
  friction:    present on ground contact
  background:  #0f1a0f
  terrain:     hilly, defined per level
  destructibles: true
  levels:      11–14
```

### Environment Transition Sequence

Between environments (not between levels), a 4-second non-interactive sequence:
1. Physics pauses
2. Background gradient shifts toward new environment colour
3. Horizon line grows or appears
4. Blob drifts with idle wobble — no player control
5. One transition monologue line fires (blob notices the physics change)
6. Snap to next level

---

## 4. Level Structure

Each level is a plain object in `level-data.js`:

```javascript
{
  id: 3,
  environment: 'deep_space',
  title: 'The Brake',
  forceMode: 'continuous',       // 'continuous' | 'impulsive'
  blobStartPos: { x: 0.2, y: 0.5 },    // normalised 0–1
  blobStartVel: { x: 80, y: 0 },       // px/s
  blobMass: null,                 // null = massless phase
  targets: [
    { x: 0.75, y: 0.5, radius: 18, type: 'static' }
  ],
  destructibles: [],
  terrain: null,
  maxForce: 300,                  // px/s² — scales click distance
  timeStep: 0.016,                // seconds per frame (small = safer)
  teachableMoment: 'newton_1',   // fires post-level vocabulary reveal
  mcqAfter: null,                 // mcq id, or null
  tip: null,                      // optional one-line tip shown in HUD
}
```

### Force Mode Definitions

**Continuous:** Force is applied every frame while mouse/touch is held.
Click position relative to blob → direction + magnitude.
Release → force drops to zero. Suitable for steering, braking.

**Impulsive:** Single click applies one impulse. Blob coasts until next click.
Between clicks: only gravity and drag act. Newton's First Law is visible in the coasting gap.
Suitable for hilly terrain, orbital-style navigation.

---

## 5. Level Arc — Full Sequence

### Environment 0: Deep Space (Levels 1–4)

**Level 1 — Drift**
Mode: continuous | Blob: stationary | Target: single, ahead
Almost impossible to fail. Mechanic tutorial. Secret: student must *reduce* force as they approach or they overshoot.
No monologue. Let them discover the mechanic.

**Level 2 — The Brake**
Mode: continuous | Blob: moving fast rightward | Target: short of right wall
Force must oppose motion to stop on target. First direct contradiction of "force = direction of motion."
Trigger: if student applies rightward force → blob says something offended.

**Level 3 — Sidestep**
Mode: impulsive | Blob: moving rightward | Target: above-right
Force must have upward component. Coasting gaps make Newton 1 visible.
First level where coasting monologue can fire.

**Level 4 — The Orbit Tease**
Mode: impulsive | Blob: moving | Target: circular arrangement, 3 targets
Student must curve around — multiple impulses. Introduces the idea that perpendicular force curves without speeding up.

*MCQ checkpoint after Level 4 — Newton's First Law*

---

### Environment 1: Near Planet (Levels 5–7)

*Transition monologue fires here*

**Level 5 — Gravity Whisper**
Mode: continuous | Gravity: low (0.15g)
Blob drifts slightly downward between actions. Target is offset.
Student discovers a force they didn't apply. Nobody names it yet.

**Level 6 — The Curve**
Mode: impulsive | Gravity: medium (0.3g)
Parabola becomes visible in coasting arcs. Target requires anticipating the curve.

**Level 7 — Mass Introduced**
Mode: continuous | Two blobs sequentially, same force available
Text notification: *"This object has mass: 1.0 kg"* then *"This object has mass: 4.0 kg"*
Same click → different acceleration. Student notices. Nobody explains yet.

*MCQ checkpoint after Level 7 — Newton's Second Law*

---

### Environment 2: Atmosphere (Levels 8–10)

*Transition monologue fires here*

**Level 8 — Resistance**
Mode: continuous | Drag: low
Blob slows over time even without opposing force. Student must apply continuous forward force to maintain speed.
Monologue trigger: friction/drag category fires here.

**Level 9 — Terminal**
Mode: continuous | Drag: medium | Gravity: 0.6g | Target: below
Student applies downward force — blob accelerates, then stops accelerating (terminal velocity).
Nobody names it. The blob notices its own speed has plateaued.

**Level 10 — Atmosphere Navigation**
Mode: mixed (first impulsive, then continuous phase)
Combines drag + gravity + directional targets. Consolidation level.

*MCQ checkpoint after Level 10 — Vectors*

---

### Environment 3: Surface (Levels 11–14)

*Transition monologue fires here*

**Level 11 — First Contact**
Mode: continuous | Full gravity | Flat terrain | Friction: low
First time blob touches ground. Friction introduced. Simple target.

**Level 12 — The Hills**
Mode: impulsive | Hilly terrain | Full gravity | No friction on blob (rolls)
Lob over hills to hit targets behind them. Most Angry-Birds-like level.
First destructible structures introduced — simple stone blocks.

**Level 13 — Column Court**
Mode: impulsive | Full gravity | Friction | Multiple destructible columns
Hit targets by toppling columns. Column integrity thresholds.
3–4 column arrangements of varying complexity.

**Level 14 — The Gauntlet**
Mode: mixed | Full physics | Moving target + destructibles + terrain
Synthesis level. No new concepts. Maximum replayability.
Final MCQ fires after this level.

---

## 6. Blob Character — blob.js

### Shape

Closed bezier curve. 8 control points around a circle, each with independent phase offset. Wobble is driven by `sin(time * speed + phase)` — organic, near-zero compute cost.

```javascript
// Core shape parameters
const BLOB = {
  baseRadius: 28,          // px
  wobbleAmplitude: 3,      // px — subtle idle breathing
  wobbleSpeed: 1.8,        // radians/s
  controlPoints: 8,
  eyeRadius: 3.5,          // px
  eyeOffsetX: 7,           // from centre
  eyeOffsetY: -4,
  mouthWidth: 10,          // control point spread
  mouthCurve: 4,           // positive = smile, negative = frown
};
```

### Squish

Applied on force events. Squishes perpendicular to force direction, elongates parallel.
Returns to rest via exponential decay — `squish += (1.0 - squish) * recovery`.

```javascript
// Called by trigger system
blob.squish({
  axis: forceAngle,        // radians
  amount: 0.25,            // 0 = no squish, 1 = flat
  duration: 350,           // ms to recover
});
```

### Expressions

Seven states. Each defines eye and mouth parameters only — shape is always the blob.

| State | Eye size | Eye spread | Mouth curve | Body |
|---|---|---|---|---|
| neutral | 1.0 | 1.0 | 0 (flat) | normal wobble |
| confused | 1.1 | 1.15 | -1 (slight frown) | slight tilt |
| offended | 0.8 | 0.9 | -3 (strong frown) | puffed |
| alarmed | 1.4 | 0.7 | small O | stretched in velocity direction |
| smug | 0.7 | 1.0 | 2 (smirk) | slower wobble |
| resigned | 0.9 | 1.0 | -1 | slower, lower amplitude wobble |
| impressed | 1.2 | 1.1 | 3 (genuine smile) | quick bounce |

### Colour System

HSL interpolation per frame. Smug is the darkest, most saturated — Aristotelian confidence. Resigned is the most desaturated — defeated but not destroyed.

```javascript
const PALETTE = {
  neutral:   { h: 270, s: 40, l: 60 },
  confused:  { h: 240, s: 40, l: 63 },
  offended:  { h: 320, s: 40, l: 63 },
  alarmed:   { h: 280, s: 50, l: 73 },
  smug:      { h: 260, s: 45, l: 52 },
  resigned:  { h: 265, s: 15, l: 58 },
  impressed: { h: 290, s: 42, l: 63 },
};

// Interpolation speed
const COLOUR_LERP = 0.03; // per frame — ~1 second transition at 60fps
```

### Speech Bubble

- Dark rounded rect, 85% opacity, `#0f1020` fill
- Border: 1px, blob's current colour at 60% opacity — shifts with mood
- Font: DM Mono, 0.75rem, `#e8e8f0`
- Max width: 220px, wraps to 3 lines maximum
- Pointer triangle toward blob centre
- Fade in: 0.3s | Hold: 3.5s | Fade out: 0.5s
- Position logic: checks 4 quadrants, places bubble away from target and canvas edge

---

## 7. Monologue System — monologue.js + monologue-data.js

### Trigger Categories

```javascript
const TRIGGERS = {
  opposing_force,     // force has antiparallel component to velocity
  coasting,           // zero net force, object in motion, >2s duration
  perpendicular,      // force angle 70–110° from velocity
  off_screen,         // blob heading out of bounds
  mass_introduced,    // first frame of a mass-bearing level
  correct_hit,        // blob reaches target
  friction_felt,      // blob decelerating without player input (drag/friction)
  transition_space,   // environment 0 → 1
  transition_planet,  // environment 1 → 2
  transition_atmos,   // environment 2 → 3
  mcq_intro,          // MCQ screen opening — blob addresses player
};
```

### Rate Limiting

```javascript
const LIMITS = {
  cooldownSeconds: 18,      // minimum gap between any two monologues
  maxPerLevel: 3,           // hard cap per level
  transitionOverride: true, // transition monologues bypass cooldown
};
```

### Pool Management

Shuffle-without-replacement per pool. On exhaustion, reshuffle. Student hears ~10 triggers before any repeat. Implementation: array + pointer, pointer resets on shuffle.

### Priority

If multiple triggers fire simultaneously, highest priority wins:
```
off_screen > opposing_force > perpendicular > mass_introduced 
> friction_felt > coasting > correct_hit
```

### Sample Line Pools (full pools in monologue-data.js)

**opposing_force** (10 lines minimum)
```
"The force is against me. I am moving forward. 
 This is a personal attack."
"Excuse me. You are pushing me backwards. 
 I have a direction. I had a plan."
"I was going somewhere. I had momentum. What is this."
"This feels deeply personal."
"I am slowing down. WHY am I slowing down."
"The force is... against me? That's not how this works."
"Aristotle did not prepare me for this."
"I object. Formally."
"In 300 BC this would not have happened."
"You are aware that I was moving, yes?"
```

**coasting** (10 lines minimum)
```
"Nobody is pushing me. I should be stopping. I am not stopping."
"I have been moving for an uncomfortable amount of time 
 without assistance."
"Aristotle said I need a force to keep moving. 
 Aristotle was very confident about this."
"...Hello? Is anyone going to push me? No? 
 I'll just... keep going then."
"I don't know how to feel about this."
"The void is not slowing me down. The void should be doing something."
"This is against everything I was told."
"I am becoming suspicious of Aristotle."
"Still going. Still not stopping. This is fine. This is fine."
"I would like to formally request some friction."
```

**off_screen** (8 lines minimum)
```
"Bold choice."
"I respect the commitment. Not the direction."
"We are going to need to have a conversation about vectors."
"Aristotle would not have done this."
"That was a lot of force for zero results."
"I'm going to be honest. That was not ideal."
"The target was in the other direction. For reference."
"I have left the area. I hope you're pleased."
```

**transition_space → planet** (3 lines — one fires randomly)
```
"Something is pulling me. Very slightly. 
 I'm choosing to ignore it for now."
"The void feels less void-like than it did. Suspicious."
"I detect a gravitational gradient. I have not consented to this."
```

**transition_planet → atmosphere** (3 lines)
```
"There is resistance. The emptiness has opinions 
 about my velocity."
"I am experiencing drag. This is new. I don't like it."
"Whatever this is, it is slowing me down without my permission."
```

**transition_atmosphere → surface** (3 lines)
```
"There is ground. Ground has friction. 
 I know about friction now. I wish I didn't."
"Gravity is no longer subtle. Gravity has committed."
"There are structures here. They look confident. Structurally."
```

**mcq_intro** (4 lines)
```
"I have questions. Let's see if you've been paying attention."
"Alright. I have been pushed, curved, and generally disagreed with. 
 Your turn."
"You've been applying forces to me for some time. 
 Let's find out if you learned anything."
"The universe wants to know what you think. 
 So do I. Primarily to disagree."
```

---

## 8. Input System — input.js

### Click-to-Force Mechanic

```
Force direction = angle from blob centre to click point
Force magnitude = distance(blob centre, click point) × scaleFactor
                  clamped to [0, maxForce]
```

`scaleFactor` is per-level — allows designer control over how sensitive the mechanic feels without changing the physics.

### Continuous Mode

```javascript
// mousedown → forceActive = true, compute force vector
// mousemove → recompute force vector each frame (force tracks cursor)
// mouseup   → forceActive = false, force = {x:0, y:0}
```

### Impulsive Mode

```javascript
// mousedown → compute impulse vector, apply once to velocity
// no tracking during hold
// next click → next impulse
// visual: brief arrow flash showing impulse direction + magnitude
```

### Touch Support

Touch events mapped to equivalent mouse events. Prevents default scroll behaviour on canvas touch. Single-touch only — no multitouch needed.

### Visual Feedback

While force is being applied (continuous) or aimed (impulsive):
- Dashed line from blob to cursor/click point
- Arrow at cursor end showing force direction
- Magnitude shown as opacity of the line — stronger = more opaque
- Blob squishes slightly in direction opposite to force (anticipatory squish)

---

## 9. Physics Engine — engine.js

Extends the patterns from `physics.js`. 2D RK4 integrator.

```javascript
// State vector
state = {
  x, y,          // position px
  vx, vy,        // velocity px/s
  mass,          // kg (null in massless phase → treated as 1.0 internally)
  onGround,      // boolean — for friction
}

// Acceleration function (called by RK4 each substep)
function accel(state, forceVec, env) {
  const ax = forceVec.x / effectiveMass(state);
  const ay = forceVec.y / effectiveMass(state);
  
  // gravity
  const ay_grav = env.gravity * G_PX;  // gravity in px/s²
  
  // drag (quadratic, opposes velocity)
  const speed = Math.hypot(state.vx, state.vy);
  const dragMag = env.dragCoeff * speed * speed;
  const ax_drag = speed > 0 ? -dragMag * state.vx / speed : 0;
  const ay_drag = speed > 0 ? -dragMag * state.vy / speed : 0;
  
  // friction (only if onGround, opposes horizontal velocity)
  const ax_friction = state.onGround 
    ? -env.frictionCoeff * Math.sign(state.vx) * env.gravity * G_PX
    : 0;

  return {
    ax: ax + ax_drag + ax_friction,
    ay: ay + ay_grav + ay_drag,
  };
}
```

### Substep Safety

Small fixed timestep (dt = 0.008s, two substeps per 60fps frame) prevents tunnelling and ensures wrong-direction forces produce visible gradual curves rather than instant exits.

### Collision Detection

Blob vs target: circle-circle, exact.
Blob vs terrain: blob centre vs heightmap lookup, resolve by position correction.
Blob vs destructible segment: circle vs rectangle AABB, apply force to segment integrity.

### Destructible Integrity

```javascript
// Each column segment
segment = {
  x, y, w, h,
  integrity: 100,        // 0–100
  fallen: false,
  fallVy: 0,             // once fallen, simple gravity fall
}

// On impact
segment.integrity -= impactForce * damageScale;
if (segment.integrity <= 0) {
  segment.fallen = true;
  // segments above lose support → cascade
}
```

---

## 10. MCQ System — mcq.js + mcq-data.js

### Format

Full-screen canvas overlay. Game world visible but darkened behind it.
Blob moves to centre-screen, adopts `smug` expression, delivers `mcq_intro` line.
Question appears. Options appear sequentially with brief delay (not all at once).

### Question Structure

```javascript
{
  id: 'newton_1_checkpoint',
  prompt: 'image',              // always a diagram, never pure text
  diagramFn: drawDiagram_N1,   // function that draws the scenario
  options: [
    { id: 'a', label: 'Keeps moving at the same speed', correct: true },
    { id: 'b', label: 'Slows down and stops', correct: false },
    { id: 'c', label: 'Speeds up', correct: false },
    { id: 'd', label: 'Moves in a circle', correct: false },
  ],
  certainty: ['Pretty sure', 'Educated guess', 'Genuinely no idea'],
  playoutFn: {                  // mini-sim for each option
    a: simulateConstantVelocity,
    b: simulateDecelToStop,
    c: simulateAccelerate,
    d: simulateCircle,
  },
}
```

### Answer Flow

1. Student picks option
2. Student picks certainty
3. Mini-sim plays out their chosen answer (2–3 seconds, no controls)
4. If wrong: correct answer plays out immediately after
5. Blob delivers feedback line based on correct/wrong × certainty matrix
6. Brief pause, then game resumes

### Feedback Matrix

| Result | Certainty | Blob line |
|---|---|---|
| Correct | Pretty sure | "Your instinct is calibrated." |
| Correct | Educated guess | "Trust it. You're reading the physics right." |
| Correct | No idea | "Fortunate. But the universe was on your side." |
| Wrong | Pretty sure | "Strong instinct. Wrong universe." |
| Wrong | Educated guess | "Good — you knew something was off." |
| Wrong | No idea | "At least you were honest about it." |

---

## 11. Vocabulary Reveal System

Post-level, after any non-MCQ level. Single line, bottom of screen, fades in.
Never during gameplay. Never prefaced with "This is called..."

```javascript
const VOCABULARY = {
  newton_1: "What you just saw: Newton's First Law.",
  newton_2: "What you just felt: Newton's Second Law.",
  vectors:  "Why direction mattered: that's what a vector is.",
  drag:     "What slowed you without friction: drag.",
  terminal: "When acceleration stopped: terminal velocity.",
};
```

One line. 4 seconds. Gone. The student already owns the concept. The label is filing.

---

## 12. Level Manager — level-manager.js

Owns level sequencing, environment transitions, progress persistence (sessionStorage).
Fires callbacks consumed by the game shell.

```javascript
LevelManager.on('levelComplete', (levelId) => { ... });
LevelManager.on('environmentChange', (envId) => { ... });
LevelManager.on('mcqRequired', (mcqId) => { ... });
LevelManager.on('vocabularyReveal', (termId) => { ... });
```

No game logic inside level-manager — it only sequences and signals.

---

## 13. Renderer — renderer.js

Layered draw order per frame:
1. Environment background (gradient, stars, horizon)
2. Terrain (if surface stage)
3. Destructible structures
4. Target markers (subtle pulsing ring, not a bullseye — too game-y)
5. Velocity arrow (live, on blob)
6. Force arrow (during input, dashed line + arrow)
7. Blob body + eyes + mouth
8. Speech bubble (if active)
9. HUD (level name, tip if any)
10. Vocabulary reveal (if active)

### Force + Velocity Arrow Style

- Velocity: solid white arrow, length proportional to speed, always visible
- Force: dashed accent-colour arrow, from blob to cursor, only during input
- Both: thin (2px), clean arrowhead, no labels during play

This is intentional — student sees two arrows behaving differently. The relationship between them is the lesson. No label needed.

---

## 14. HUD Design

Minimal. Dark background, consistent with existing platform aesthetic.

```
Top-left:  Level name (DM Mono, dim, small)
Top-right: Environment name (DM Mono, dim, small)
Bottom:    Vocabulary reveal zone (fades in/out post-level)
           Tip line if level has one (DM Mono, 0.7rem)
```

No score during play. No timer. No health bar. These would shift focus from physics to gaming.

Optional: small orbit-map in corner showing blob position relative to planet (purely visual, non-interactive). Earns the narrative without interrupting gameplay.

---

## 15. What This Does Not Include (Yet)

- Teacher data collection (no DataLogger integration — this is a game, not a lab)
- Student alias / session key (game, not classroom tool)
- Level editor UI (level-data.js is the editor)
- Sound (out of scope for v1 — physics feedback is visual only)
- Multiplayer
- Leaderboard

These can be added later without touching the core architecture.

---

## 16. Star System

### Criteria — Three Stars, Physics-Based

Stars reward physical understanding, not speed or luck.

| Stars | Condition |
|---|---|
| ⭐ | Complete the level (reach target) — always achievable |
| ⭐⭐ | Complete within force application budget (≤ N clicks/holds per level) |
| ⭐⭐⭐ | Complete with no off-screen excursions AND within budget |

`N` (force budget) is defined per level in `level-data.js`. Designer-tuned per level difficulty.

**Design rationale:**
- One star guaranteed on completion — no student leaves empty-handed
- Two stars penalises random brute-forcing — rewards reading direction correctly
- Three stars penalises magnitude errors — rewards full vector understanding
- Criteria map directly to the two physics lessons: direction (Newton 2) and magnitude (vector control)

### Progression Gating

Stars are **cosmetic only**. Progression gates on completion (one star minimum). A struggling student is never blocked by star count — only by whether they reached the target at all.

### Visual Style

Flat, minimal. Consistent with dark game aesthetic. Three small circles per level on the level select screen:

- Empty circle: not yet earned
- Half-filled circle: intermediate (not used in v1 — reserved)
- Filled circle: earned, blob's current accent colour (`#2de2a0` or similar)

No gold. No animation on the level select screen. A brief particle burst on the level complete screen when a new star is earned — then static.

### Level Complete Screen

After each level, a brief overlay before returning to level select:

- Blob expression: `impressed` (if 3 stars) | `neutral` (if 2) | `resigned` (if 1)
- Stars fill in sequentially, left to right, 0.3s apart
- Vocabulary reveal fires here if applicable (bottom of overlay)
- One optional blob line if 3 stars earned — reluctant acknowledgement pool:
  ```
  "I'll admit that was well-executed."
  "...I'm not going to make a big deal of this."
  "Fine. You understand vectors. Congratulations."
  "Noted. You can do this. Noted."
  ```
- Continue button → level select

### Storage

Stars persisted to `sessionStorage` keyed by level id. Simple integer 0–3 per level.

```javascript
// level-manager.js
function saveStars(levelId, stars) {
  const key = `particle_stars_${levelId}`;
  sessionStorage.setItem(key, stars);
}

function getStars(levelId) {
  return parseInt(sessionStorage.getItem(`particle_stars_${levelId}`)) || 0;
}
```

Best score only — replaying a level cannot reduce a previously earned star count.

---

## 17. Build Order

1. `blob.js` — character first. Test in isolation with a blank canvas harness.
2. `engine.js` — 2D RK4, impulsive + continuous modes, no terrain yet.
3. `input.js` — click-to-force mechanic, visual feedback arrows.
4. `renderer.js` — environment 0 only (space), blob, arrows, target.
5. `level-data.js` — levels 1–4 (space, no gravity).
6. `monologue-data.js` — opposing_force + coasting + off_screen pools.
7. `monologue.js` — trigger logic, cooldown, priority.
8. First playable: levels 1–4, blob character, monologue, no MCQ, no stars.
9. Add star criteria + level complete screen. Tune force budgets per level.
10. `mcq-data.js` + `mcq.js` — Newton 1 checkpoint only.
11. Iterate on feel. Then add environments 1–3.

---

*Design locked. Ready to build.*

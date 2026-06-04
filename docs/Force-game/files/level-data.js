/**
 * level-data.js — PARTICLE game level configurations
 * Teacher-editable. Zero logic. Pure data.
 *
 * Target positions are in normalised coords (0–1).
 * Converted to canvas px by the renderer.
 *
 * forceMode: 'continuous' | 'impulsive'
 * blobStartPos: { x, y } normalised
 * blobStartVel: { x, y } px/s
 * blobMass: null (massless phase) | number in kg-equivalent units
 * targets: array of { x, y, radius, type: 'static'|'moving' }
 * maxForceApplications: star criteria — 3 stars if <= this count AND no off-screen
 * teachableMoment: vocabulary key fired post-level (null = none)
 * mcqAfter: mcq id fired after this level (null = none)
 * tip: one-line hint shown in HUD (null = none)
 */

const LevelData = (() => {

  const LEVELS = [

    // ── ENVIRONMENT 0: DEEP SPACE ──────────────────────────────────────────

    {
      id:          1,
      environment: 'deep_space',
      title:       'First Contact',
      forceMode:   'continuous',
      blobStartPos: { x: 0.15, y: 0.5 },
      blobStartVel: { x: 0,    y: 0   },
      blobMass:    null,
      targets: [
        { x: 0.82, y: 0.5, radius: 22, type: 'stop' },
      ],
      maxForceApplications: 80,   // generous — tutorial level
      teachableMoment: null,
      mcqAfter:    null,
      tip:         'Click near yourself to apply a force.',
    },

    {
      id:          2,
      environment: 'deep_space',
      title:       'The Brake',
      forceMode:   'continuous',
      blobStartPos: { x: 0.15, y: 0.5 },
      blobStartVel: { x: 220,  y: 0   },  // already moving right — fast
      blobMass:    null,
      targets: [
        { x: 0.72, y: 0.5, radius: 20, type: 'stop' },
      ],
      maxForceApplications: 60,
      teachableMoment: null,
      mcqAfter:    null,
      tip:         null,
    },

    {
      id:          3,
      environment: 'deep_space',
      title:       'Sidestep',
      forceMode:   'impulsive',
      blobStartPos: { x: 0.12, y: 0.55 },
      blobStartVel: { x: 160,  y: 0    },  // moving right
      blobMass:    null,
      targets: [
        { x: 0.80, y: 0.25, radius: 20, type: 'static' },
      ],
      maxForceApplications: 4,   // tight — rewards good vector reading
      teachableMoment: null,
      mcqAfter:    null,
      tip:         'Each click applies one push. The object coasts between clicks.',
    },

    {
      id:          4,
      environment: 'deep_space',
      title:       'The Curve',
      forceMode:   'impulsive',
      blobStartPos: { x: 0.12, y: 0.5  },
      blobStartVel: { x: 140,  y: 0    },
      blobMass:    null,
      targets: [
        { x: 0.5,  y: 0.18, radius: 18, type: 'static' },
        { x: 0.82, y: 0.5,  radius: 18, type: 'static' },
        { x: 0.5,  y: 0.82, radius: 18, type: 'static' },
      ],
      maxForceApplications: 8,
      teachableMoment: 'newton_1',   // vocabulary reveal after this level
      mcqAfter:    'newton_1_checkpoint',
      tip:         null,
    },

  ];

  // ── TARGET COLOURS ────────────────────────────────────────────────────────
  // Visual style for targets — not in level config to keep data clean

  const TARGET_STYLE = {
    static: {
      fill:        'rgba(77, 240, 176, 0.12)',
      stroke:      '#4df0b0',
      pulseColor:  'rgba(77, 240, 176, 0.25)',
      hitFill:     'rgba(77, 240, 176, 0.45)',
    },
  };

  // ── VOCABULARY STRINGS ────────────────────────────────────────────────────
  // Displayed post-level. Sourced from monologue-data.js at runtime,
  // but duplicated here for teacher reference.

  const VOCABULARY = {
    newton_1: "What you just saw: Newton's First Law.",
    newton_2: "What you just felt: Newton's Second Law.",
    vectors:  "Why direction mattered: that's what a vector is.",
    drag:     "What slowed you without friction: drag.",
    terminal: "When acceleration stopped: terminal velocity.",
    friction: "What the surface did to your motion: friction.",
  };

  // ── HELPERS ───────────────────────────────────────────────────────────────

  function getLevel(id) {
    return LEVELS.find(l => l.id === id) || null;
  }

  function getLevelsByEnvironment(envId) {
    return LEVELS.filter(l => l.environment === envId);
  }

  function totalLevels() { return LEVELS.length; }

  return {
    LEVELS,
    TARGET_STYLE,
    VOCABULARY,
    getLevel,
    getLevelsByEnvironment,
    totalLevels,
  };

})();

if (typeof module !== 'undefined') module.exports = LevelData;

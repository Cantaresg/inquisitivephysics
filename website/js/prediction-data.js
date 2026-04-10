/**
 * prediction-data.js — Galileo Lab
 * Teacher-editable content for:
 *   Stage 1 — Ramp Prediction MCQ
 *   Stage 3 — Bridge MCQ (Likert sliders)
 *
 * Keep all physics logic in draw-prediction.js.
 * Only question text, options, labels and UI strings live here.
 */

const PredictionData = {

  // ── STAGE 1 — RAMP PREDICTION ─────────────────────────────────────────────

  rampPrediction: {

    // Shown above the MCQ before the ramp is unlocked
    preamble: `You are about to run a ramp experiment. Two balls — one heavy, one light —
will be released from the top of a ramp at the same time.`,

    question: 'Which ball do you think will reach the bottom first?',

    options: [
      {
        id: 'heavy',
        label: 'Heavy ball',
        hint: 'The heavier ball reaches the bottom first.',
      },
      {
        id: 'light',
        label: 'Light ball',
        hint: 'The lighter ball reaches the bottom first.',
      },
      {
        id: 'same',
        label: 'Same time',
        hint: 'Both balls reach the bottom at the same time.',
      },
      {
        id: 'other',
        label: 'Other',
        hint: null,   // triggers free-text input
        placeholder: 'Describe what you think will happen…',
      },
    ],

    confidence: {
      label: 'How confident are you in your prediction?',
      levels: [
        { id: 'unsure',     label: 'Unsure' },
        { id: 'low',        label: 'Low' },
        { id: 'medium',     label: 'Medium' },
        { id: 'high',       label: 'High' },
        { id: 'very_sure',  label: 'Very sure' },
      ],
    },

    // Banner shown at the top of the ramp canvas (Stage 2) before first release
    // {choice} and {confidence} are replaced at runtime with the student's answers
    recallBanner: 'Your prediction: {choice} — confidence: {confidence}',

    ui: {
      submitBtn:      'Lock in prediction →',
      submitLockHint: 'Select an option to continue.',
      otherMinChars:  10,
    },
  },

  // ── STAGE 3 — BRIDGE MCQ ──────────────────────────────────────────────────

  bridge: {

    preamble: `You just ran the ramp experiment. Both balls — heavy and light — slid down
in the same time, no matter how you changed the length.`,

    question: 'Rate how true you think each statement is.',

    likertLabels: [
      'Definitely false',
      'Maybe false',
      'Not sure',
      'Maybe true',
      'Definitely true',
    ],

    // correct: true  → green reveal on submit
    // correct: false → red reveal on submit
    // target: the Likert index (0–4) considered fully correct
    //   statements where correct:true  → target is 3 or 4 (Maybe/Definitely true)
    //   statements where correct:false → target is 0 or 1 (Definitely/Maybe false)
    statements: [
      {
        id: 'B_S1',
        text: 'Without air resistance, the mass of an object does not affect how long it takes to fall.',
        correct: true,
        target: [3, 4],   // "Maybe true" or "Definitely true"
        explanation: 'Correct direction. On the ramp, the acceleration is g sinθ — mass cancels out completely. The same argument applies to free fall: both the driving force (gravity) and the resistance to motion (inertia) scale with mass, so they cancel. Without air resistance, all objects fall at the same rate regardless of mass.',
      },
      {
        id: 'B_S2',
        text: 'Objects always fall at the same rate — mass never matters, even in air.',
        correct: false,
        target: [0, 1],   // "Definitely false" or "Maybe false"
        explanation: 'This goes too far. In a vacuum, yes — mass cancels and all objects fall together. But in air, drag force depends on speed and shape, while the driving force (gravity) depends on mass. Heavier objects have a higher terminal velocity in air, so mass does matter when air resistance is present.',
      },
      {
        id: 'B_S3',
        text: 'The ramp result only applies to ramps — it tells us nothing about objects falling straight down.',
        correct: false,
        target: [0, 1],
        explanation: 'The ramp is a controlled version of free fall. The physics is identical — gravity acts on a mass, and acceleration is g sinθ, which contains no mass term. Galileo used the ramp precisely because it slows the motion enough to measure. The conclusion generalises to free fall.',
      },
      {
        id: 'B_S4',
        text: 'Heavier objects still fall faster — the ramp result must have been affected by friction cancelling the mass difference.',
        correct: false,
        target: [0, 1],
        explanation: 'Even with friction, mass still cancels. The friction force is μmg cosθ and the driving force is mg sinθ — both contain m, so it divides out. The result is independent of mass on a rough or smooth ramp. The ramp experiment was not a fluke.',
      },
    ],

    // Optional free-text at the bottom — always shown
    freeText: {
      id: 'B_FREE',
      label: 'Any other thoughts? (optional)',
      placeholder: 'Write any questions or ideas here…',
    },

    ui: {
      submitBtn:      'Submit →',
      continueBtn:    'Continue →',
      submitLockHint: 'Rate all statements to continue.',
    },
  },

};

if (typeof module !== 'undefined') module.exports = PredictionData;

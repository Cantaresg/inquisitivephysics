/**
 * data-logger.js — Galileo Lab response logger
 * Handles: session management, response capture, CSV export, Google Sheets submit
 * No dependencies. Works standalone.
 */

const DataLogger = (() => {

  // ── SCHEMA ─────────────────────────────────────────────────────────────────
  // A "response" is one student answer at one stage.
  // A "session" is the full set of responses for one student in one sitting.
  //
  // response = {
  //   stage        : 0-5 (int)
  //   questionId   : string key e.g. 'hook_prediction'
  //   questionText : string (human readable, for CSV)
  //   mcqChoice    : string key e.g. 'heavy' | 'same' | 'air_resistance'
  //   mcqLabel     : string (human readable label for CSV)
  //   explanation  : string (free text, may be empty)
  //   correct      : boolean | null (null = no right answer, e.g. hook)
  //   timestamp    : ISO string
  // }

  // ── STATE ──────────────────────────────────────────────────────────────────
  let _session = {
    sessionKey   : '',   // teacher-provided class code
    studentAlias : '',   // student self-entered alias (not real name)
    startTime    : null,
    responses    : [],
  };

  // ── SESSION INIT ───────────────────────────────────────────────────────────
  function initSession(sessionKey, studentAlias) {
    _session = {
      sessionKey   : sessionKey.trim().toUpperCase(),
      studentAlias : studentAlias.trim() || 'Anonymous',
      startTime    : new Date().toISOString(),
      responses    : [],
    };
    _persist();
    console.log(`[DataLogger] Session started: ${_session.sessionKey} / ${_session.studentAlias}`);
  }

  function getSession() {
    return { ..._session };
  }

  // ── LOG RESPONSE ───────────────────────────────────────────────────────────
  function logResponse({ stage, questionId, questionText, mcqChoice, mcqLabel, explanation = '', correct = null }) {
    const response = {
      stage,
      questionId,
      questionText,
      mcqChoice,
      mcqLabel,
      explanation  : explanation.trim(),
      correct,
      timestamp    : new Date().toISOString(),
    };
    // Replace if same questionId already logged (student went back — not possible
    // with hard locks, but defensive coding)
    const idx = _session.responses.findIndex(r => r.questionId === questionId);
    if (idx >= 0) {
      _session.responses[idx] = response;
    } else {
      _session.responses.push(response);
    }
    _persist();
    console.log(`[DataLogger] Logged stage=${stage} q=${questionId} choice=${mcqChoice} correct=${correct}`);
    return response;
  }

  // ── RETRIEVE ───────────────────────────────────────────────────────────────
  function getResponse(questionId) {
    return _session.responses.find(r => r.questionId === questionId) || null;
  }

  function getAllResponses() {
    return [..._session.responses];
  }

  // Score: fraction of questions where correct===true (ignores null)
  function getScore() {
    const graded = _session.responses.filter(r => r.correct !== null);
    if (!graded.length) return null;
    const correct = graded.filter(r => r.correct).length;
    return { correct, total: graded.length, pct: Math.round(correct/graded.length*100) };
  }

  // ── LOCAL PERSISTENCE (sessionStorage — cleared on tab close) ──────────────
  function _persist() {
    try {
      sessionStorage.setItem('galileo_session', JSON.stringify(_session));
    } catch(e) {
      // sessionStorage unavailable — silently continue
    }
  }

  function restoreFromStorage() {
    try {
      const raw = sessionStorage.getItem('galileo_session');
      if (raw) {
        _session = JSON.parse(raw);
        console.log(`[DataLogger] Restored session: ${_session.sessionKey}`);
        return true;
      }
    } catch(e) {}
    return false;
  }

  function _stageForKey(key) {
    if (typeof key !== 'string') return null;
    if (key.startsWith('hook_')) return 0;
    if (key === 'hook_observation') return 0;
    if (key === 'ramp_prediction') return 1;
    if (key === 'ramp_discovery') return 2;
    if (key === 'bridge_question') return 3;
    if (key.startsWith('drop_')) return 4;
    if (key.startsWith('history_')) return 5;
    return null;
  }

  function _labelFromQuestion(question, choiceKey) {
    if (!question || !Array.isArray(question.choices) || !choiceKey) return null;
    const choice = question.choices.find(c => c.key === choiceKey || c.key === choiceKey.toString());
    return choice ? choice.label : null;
  }

  function log(questionId, data = {}) {
    if (!questionId) return null;
    const question = QUESTIONS[questionId] || {};
    const stage = data.stage ?? question.stage ?? _stageForKey(questionId);
    const mcqChoice = data.mcqChoice ?? data.response ?? data.choice ?? null;
    const mcqLabel = data.mcqLabel
      ?? data.choiceLabel
      ?? data.responseLabel
      ?? data.text
      ?? _labelFromQuestion(question, mcqChoice)
      ?? (mcqChoice ? mcqChoice.toString() : null);
    let explanation = data.explanation ?? data.text ?? data.description ?? '';
    if (!explanation && data.rows) {
      try { explanation = JSON.stringify(data.rows); } catch (e) { explanation = String(data.rows); }
    }
    if (!explanation && data.done !== undefined) {
      explanation = data.done ? 'done' : 'not done';
    }
    const correct = data.correct ?? (question.correctKey !== undefined && question.correctKey !== null ? mcqChoice === question.correctKey : null);
    return logResponse({
      stage,
      questionId,
      questionText: data.questionText ?? question.text ?? questionId,
      mcqChoice,
      mcqLabel,
      explanation,
      correct,
    });
  }

  // ── CSV EXPORT ─────────────────────────────────────────────────────────────
  // Produces a flat CSV with one row per response.
  // Teachers collect one CSV per student if not using Sheets backend.
  function downloadCSV() {
    if (!_session.responses.length) {
      alert('No responses recorded yet.');
      return;
    }
    const headers = [
      'SessionKey', 'StudentAlias', 'StartTime',
      'Stage', 'QuestionID', 'QuestionText',
      'MCQChoice', 'MCQLabel', 'Explanation',
      'Correct', 'Timestamp'
    ];
    const rows = _session.responses.map(r => [
      _session.sessionKey,
      _session.studentAlias,
      _session.startTime,
      r.stage,
      r.questionId,
      `"${r.questionText.replace(/"/g,'""')}"`,
      r.mcqChoice,
      r.mcqLabel,
      `"${r.explanation.replace(/"/g,'""')}"`,
      r.correct === null ? 'n/a' : r.correct,
      r.timestamp,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `galileo_${_session.sessionKey}_${_session.studentAlias}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── GOOGLE SHEETS SUBMIT ───────────────────────────────────────────────────
  // Sends session data to a Google Apps Script web app endpoint.
  // Teachers deploy the Apps Script (see /sheets/apps-script.js) and
  // paste the deployment URL into the lab's session setup screen.
  //
  // The Apps Script expects a POST with JSON body = the flat row array.
  // One POST per response (simpler Apps Script logic, no batch needed at class scale).

  let _sheetsUrl = '';

  function setSheetsUrl(url) {
    _sheetsUrl = url.trim();
    try { localStorage.setItem('galileo_sheets_url', _sheetsUrl); } catch(e) {}
  }

  function getSheetsUrl() {
    if (!_sheetsUrl) {
      try { _sheetsUrl = localStorage.getItem('galileo_sheets_url') || ''; } catch(e) {}
    }
    return _sheetsUrl;
  }

  // Submit ALL responses. Called at end of lab (Stage 5) or on demand.
  // Returns { ok: bool, submitted: int, errors: int }
  async function submitToSheets() {
    const url = getSheetsUrl();
    if (!url) {
      return { ok: false, error: 'No Google Sheets URL configured.' };
    }
    if (!_session.responses.length) {
      return { ok: false, error: 'No responses to submit.' };
    }

    let submitted = 0, errors = 0;

    for (const r of _session.responses) {
      const payload = {
        sessionKey   : _session.sessionKey,
        studentAlias : _session.studentAlias,
        startTime    : _session.startTime,
        stage        : r.stage,
        questionId   : r.questionId,
        questionText : r.questionText,
        mcqChoice    : r.mcqChoice,
        mcqLabel     : r.mcqLabel,
        explanation  : r.explanation,
        correct      : r.correct === null ? 'n/a' : String(r.correct),
        timestamp    : r.timestamp,
      };
      try {
        const res = await fetch(url, {
          method  : 'POST',
          // Google Apps Script requires text/plain for no-cors POST
          // The script parses it as JSON on the server side
          headers : { 'Content-Type': 'text/plain' },
          body    : JSON.stringify(payload),
        });
        if (res.ok || res.type === 'opaque') {
          submitted++;
        } else {
          errors++;
          console.warn(`[DataLogger] Sheets submit failed for ${r.questionId}: ${res.status}`);
        }
      } catch(e) {
        errors++;
        console.warn(`[DataLogger] Sheets submit error for ${r.questionId}:`, e.message);
      }
    }

    const ok = errors === 0;
    console.log(`[DataLogger] Sheets submit complete: ${submitted} ok, ${errors} errors`);
    return { ok, submitted, errors };
  }

  // ── QUESTION REGISTRY ──────────────────────────────────────────────────────
  // Central definition of all MCQ questions used across stages.
  // Import this in UI modules to keep question text consistent with logged data.
  const QUESTIONS = {

    hook_prediction: {
      stage       : 0,
      id          : 'hook_prediction',
      text        : 'Which object hits the ground first?',
      choices     : [
        { key: 'iron',  label: 'Iron ball' },
        { key: 'feather', label: 'Feather' },
        { key: 'same',  label: 'They hit at the same time' },
      ],
      correctKey  : null,   // no right/wrong — this is bias activation
    },

    ramp_prediction: {
      stage       : 1,
      id          : 'ramp_prediction',
      text        : 'On the ramp, which object reaches the bottom first?',
      choices     : [
        { key: 'heavy', label: 'Heavy object' },
        { key: 'light', label: 'Light object' },
        { key: 'same',  label: 'They arrive at the same time' },
      ],
      correctKey  : 'same',
    },

    ramp_discovery: {
      stage       : 2,
      id          : 'ramp_discovery',
      text        : 'What did you discover about mass and ramp time?',
      choices     : [
        { key: 'mass_matters',    label: 'Heavier objects are faster' },
        { key: 'mass_no_effect',  label: 'Mass has no effect on time' },
        { key: 'depends',         label: 'It depends on the ramp angle' },
        { key: 'unsure',          label: 'I\'m not sure yet' },
      ],
      correctKey  : 'mass_no_effect',
    },

    bridge_question: {
      stage       : 3,
      id          : 'bridge_question',
      text        : 'If mass doesn\'t affect how fast things fall, why do most people think heavy objects fall faster?',
      choices     : [
        { key: 'myth',       label: 'It\'s just a myth — people are wrong' },
        { key: 'air',        label: 'Air resistance affects light objects more' },
        { key: 'surface',    label: 'Surfaces slow down light objects more' },
        { key: 'unsure',     label: 'I\'m not sure yet' },
      ],
      correctKey  : 'air',   // revealed after Stage 4
    },

    drop_paper_flat: {
      stage       : 4,
      id          : 'drop_paper_flat',
      text        : 'Stone vs flat paper — which hits the ground first?',
      choices     : [
        { key: 'stone', label: 'Stone' },
        { key: 'paper', label: 'Flat paper' },
        { key: 'same',  label: 'Same time' },
      ],
      correctKey  : 'stone',
    },

    drop_paper_crumpled: {
      stage       : 4,
      id          : 'drop_paper_crumpled',
      text        : 'Stone vs crumpled paper — which hits the ground first?',
      choices     : [
        { key: 'stone', label: 'Stone' },
        { key: 'paper', label: 'Crumpled paper' },
        { key: 'same',  label: 'Same time' },
      ],
      correctKey  : 'stone',
    },

    drop_paper_book: {
      stage       : 4,
      id          : 'drop_paper_book',
      text        : 'Stone vs paper placed flat on a book — which hits first?',
      choices     : [
        { key: 'stone', label: 'Stone' },
        { key: 'paper', label: 'Paper + book' },
        { key: 'same',  label: 'Same time' },
      ],
      correctKey  : 'same',
    },

    final_explanation: {
      stage       : 4,
      id          : 'final_explanation',
      text        : 'What is the real reason we think heavy objects fall faster?',
      choices     : [
        { key: 'mass',         label: 'Mass genuinely does affect falling speed' },
        { key: 'air',          label: 'Air resistance slows light objects more' },
        { key: 'terminal_vel', label: 'Light objects reach terminal velocity sooner' },
        { key: 'shape',        label: 'Shape is the only thing that matters' },
      ],
      correctKey  : 'air',   // both 'air' and 'terminal_vel' are acceptable;
                              // handle in stage logic
    },
  };

  // ── PUBLIC API ─────────────────────────────────────────────────────────────
  return {
    initSession,
    getSession,
    log,
    logResponse,
    getResponse,
    getAllResponses,
    getScore,
    restoreFromStorage,
    downloadCSV,
    setSheetsUrl,
    getSheetsUrl,
    submitToSheets,
    QUESTIONS,
  };

})();

if (typeof module !== 'undefined') module.exports = DataLogger;

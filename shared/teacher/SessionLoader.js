/**
 * shared/teacher/SessionLoader.js
 * Generic session CRUD used by every sim's teacher and student pages.
 *
 * All sessions live in one Supabase table ('sessions') with a 'sim' column
 * that identifies which simulation the session belongs to.
 *
 * Each sim passes its own sim-id string and code prefix:
 *   createSession('chem_lab', 'CHEM-', config)
 *   createSession('echem_lab', 'EC-',   config)
 */

import { supabase } from './supabase-client.js';

const TABLE      = 'sessions';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I ambiguity

function _randomCode(prefix) {
  let s = prefix;
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

/**
 * Read ?session=CODE from the current page URL.
 * Returns the code string (uppercased), or null if the param is absent.
 */
export function getSessionCode() {
  const v = new URLSearchParams(location.search).get('session');
  return v ? v.toUpperCase().trim() : null;
}

/**
 * Persist a new session. Retries up to 5× on code collision.
 * @param {string} sim     — e.g. 'chem_lab'
 * @param {string} prefix  — e.g. 'CHEM-'
 * @param {object} config  — full SessionConfig object
 * @returns {Promise<{ id: string, code: string }>}
 */
export async function createSession(sim, prefix, config) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = _randomCode(prefix);
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ code, sim, config })
      .select('id, code')
      .single();

    if (!error) return { id: data.id, code: data.code };
    if (!error.message?.toLowerCase().includes('unique')) throw error;
  }
  throw new Error('Failed to generate a unique session code after 5 attempts.');
}

/**
 * Load a session by code (case-insensitive).
 * @param {string} code  — e.g. 'CHEM-K7M2'
 * @returns {Promise<{ id, code, sim, config, createdAt }>}
 */
export async function loadSession(code) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, code, sim, config, created_at')
    .eq('code', code.toUpperCase().trim())
    .single();

  if (error) throw error;
  return {
    id:        data.id,
    code:      data.code,
    sim:       data.sim,
    config:    data.config,
    createdAt: data.created_at,
  };
}

/**
 * Overwrite the config of an existing session.
 * @param {string} code    — existing session code
 * @param {object} config  — updated SessionConfig
 */
export async function updateSession(code, config) {
  const { error } = await supabase
    .from(TABLE)
    .update({ config })
    .eq('code', code.toUpperCase().trim());

  if (error) throw error;
}

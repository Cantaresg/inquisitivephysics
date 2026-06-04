/**
 * shared/teacher/supabase-client.js
 * Single source of truth for Supabase credentials across ALL simulations.
 *
 * Prerequisites:
 *   Each teacher HTML page must load the UMD bundle BEFORE the module entry:
 *     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *
 * To update credentials: change SUPABASE_URL and SUPABASE_ANON_KEY here only.
 *   Project Settings → API in the Supabase dashboard.
 */

const { createClient } = window.supabase;

const SUPABASE_URL      = 'https://phkikdadobwnqwdsdjyq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GmDnhlBXz-VLOWgcz-k_0Q_Z_ZV8qWV';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

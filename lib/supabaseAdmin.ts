import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Missing Supabase Service Role Key or URL. Check your .env.local file.');
}

// Use this ONLY on the server to securely bypass RLS
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || 'dummy_key_to_prevent_crash_during_build');

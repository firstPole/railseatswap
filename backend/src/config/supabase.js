import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 * NEVER expose this client or its key to the frontend.
 * Used for operations that bypass Row Level Security (e.g. admin queries,
 * cross-party swap orchestration).
 */
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',  // ← add this
    },
  }
);

/**
 * Creates a Supabase client scoped to the authenticated user's JWT.
 * This client respects Row Level Security policies.
 * Used when performing queries on behalf of a specific user.
 */
export const createUserClient = (accessToken) => {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',  // ← add this
    },
  });
};

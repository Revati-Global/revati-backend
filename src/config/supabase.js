import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';

export const supabase = createClient(
    config.supabaseUrl,
    config.supabaseServiceKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);

export const BUCKET_NAME = 'revati-media';

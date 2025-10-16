import { Global, Module } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { SUPABASE_CLIENT } from './supabase.tokens';

@Global()
@Module({
    providers: [
        {
            provide: SUPABASE_CLIENT,
            useFactory: (): SupabaseClient => {
                const url = process.env.SUPABASE_URL;
                const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
                if (!url || !key) {
                    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/ANON_KEY must be set');
                }
                return createClient(url, key, {
                    auth: { persistSession: false, autoRefreshToken: false },
                });
            },
        },
        SupabaseService,
    ],
    exports: [SUPABASE_CLIENT, SupabaseService],
})
export class SupabaseModule { }



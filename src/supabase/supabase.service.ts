import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/validation.schema';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService<EnvConfig>) {
    const supabaseUrl = this.configService.get('SUPABASE_URL', { infer: true });
    const supabaseServiceKey = this.configService.get(
      'SUPABASE_SERVICE_ROLE_KEY',
      { infer: true },
    );

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async deleteUser(userId: string) {
    const { error } = await this.supabase.auth.admin.deleteUser(userId);
    return { error };
  }

  // Add other Supabase operations as needed
  getClient(): SupabaseClient {
    return this.supabase;
  }
}

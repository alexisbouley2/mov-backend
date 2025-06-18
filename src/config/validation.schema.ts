import { z } from 'zod';

export const validationSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'staging'])
    .default('development'),

  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(65535))
    .default('3000'),

  DATABASE_URL: z.string().url().startsWith('postgresql://'),

  SUPABASE_URL: z.string().url().includes('supabase.co'),

  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).startsWith('eyJ'),

  CLOUDFLARE_R2_ENDPOINT: z.string().url().includes('r2.cloudflarestorage.com'),

  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().min(1),

  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().min(1),

  CLOUDFLARE_R2_BUCKET_NAME: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Invalid bucket name format'),

  CLOUDFLARE_R2_PUBLIC_URL: z.string().url(),
});

export type EnvConfig = z.infer<typeof validationSchema>;

export const validateEnv = (
  env: Record<string, string | undefined>,
): EnvConfig => {
  try {
    return validationSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`,
      );
      throw new Error(
        `Environment validation failed:\n${errorMessages.join('\n')}`,
      );
    }
    throw error;
  }
};

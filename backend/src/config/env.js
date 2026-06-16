import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),

  // Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Indian Rail API (indianrailapi.com)
  RAIL_API_KEY: z.string().min(1, 'RAIL_API_KEY is required'),
  RAIL_API_BASE_URL: z.string().url().default('https://indianrailapi.com/api/v2'),

  // JWT signing secret (used for swap-slip verification)
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),  // 15 min
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),

  // CORS
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // Swap session TTL in minutes
  SWAP_SESSION_TTL_MINUTES: z.string().default('15').transform(Number),
  CHART_DROP_WINDOW_HOURS: z.string().default('4').transform(Number),
  MOCK_PNR: z.enum(['true', 'false']).default('false'),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  const missing = parseResult.error.errors.map(e => `  • ${e.path.join('.')}: ${e.message}`).join('\n');
  console.error(`\n[FATAL] Invalid environment configuration:\n${missing}\n`);
  process.exit(1);
}

export const env = parseResult.data;

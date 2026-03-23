import { z } from 'zod';

/**
 * Client-side environment variables (NEXT_PUBLIC_*).
 * Validated at import time so missing vars fail fast during build/boot.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3000/api/v1'),
  NEXT_PUBLIC_WS_URL: z.string().default('ws://localhost:3000/ws'),
  NEXT_PUBLIC_MAPBOX_TOKEN: z
    .string()
    .min(1, 'Mapbox token is required for map features')
    .default(''),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3001'),
});

function validateEnv() {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const message = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(', ')}`)
      .join('\n');
    console.error(`[env] Invalid environment variables:\n${message}`);

    // In development, warn but don't crash (defaults will be used)
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Invalid environment variables:\n${message}`);
    }
  }

  return parsed.data ?? clientEnvSchema.parse({});
}

export const env = validateEnv();

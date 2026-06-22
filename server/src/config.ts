import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PUBLIC_BASE_URL: z.url(),
  DASHBOARD_PASSWORD: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  publicBaseUrl: string;
  dashboardPassword: string;
  sessionSecret: string;
  encryptionKey: Buffer;
  databaseUrl: string;
}

/** The Spotify redirect path this server handles; combined with PUBLIC_BASE_URL. */
export const SPOTIFY_REDIRECT_PATH = '/api/spotify/callback';

function decodeEncryptionKey(value: string): Buffer {
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}). ` +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  return key;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  return {
    port: parsed.PORT,
    nodeEnv: parsed.NODE_ENV,
    publicBaseUrl: parsed.PUBLIC_BASE_URL.replace(/\/+$/, ''),
    dashboardPassword: parsed.DASHBOARD_PASSWORD,
    sessionSecret: parsed.SESSION_SECRET,
    encryptionKey: decodeEncryptionKey(parsed.TOKEN_ENCRYPTION_KEY),
    databaseUrl: parsed.DATABASE_URL,
  };
}

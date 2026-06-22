import { z } from 'zod';

/**
 * Shared API contracts for Spotibot. These zod schemas are the single source of
 * truth consumed by both the Fastify server (request validation) and the React
 * web client (typed responses).
 */

/** A Spotify context URI such as `spotify:playlist:...`, `spotify:album:...`. */
export const SPOTIFY_CONTEXT_URI_RE = /^spotify:(playlist|album|artist):[A-Za-z0-9]+$/;
/** A Spotify track URI such as `spotify:track:...`. */
export const SPOTIFY_TRACK_URI_RE = /^spotify:track:[A-Za-z0-9]+$/;

export const deviceStrategySchema = z.enum(['first_available', 'last_active', 'named']);
export type DeviceStrategy = z.infer<typeof deviceStrategySchema>;

// ---- Auth ----
export const loginInputSchema = z.object({
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const authStateSchema = z.object({
  authenticated: z.boolean(),
});
export type AuthState = z.infer<typeof authStateSchema>;

// ---- Spotify apps (OAuth credentials, stored encrypted in DB) ----
export const createSpotifyAppInputSchema = z.object({
  name: z.string().min(1).max(120),
  clientId: z.string().min(1).max(200),
  clientSecret: z.string().min(1).max(400),
  redirectUri: z.url(),
});
export type CreateSpotifyAppInput = z.infer<typeof createSpotifyAppInputSchema>;

/** Public representation of a Spotify app. The client secret is never returned. */
export const spotifyAppSchema = z.object({
  id: z.string(),
  name: z.string(),
  clientId: z.string(),
  redirectUri: z.string(),
  createdAt: z.string(),
  accountCount: z.number().int().nonnegative(),
});
export type SpotifyApp = z.infer<typeof spotifyAppSchema>;

// ---- Accounts ----
export const accountSchema = z.object({
  id: z.string(),
  appId: z.string(),
  spotifyUserId: z.string(),
  displayName: z.string(),
  isPremium: z.boolean(),
  enabled: z.boolean(),
  reauthRequired: z.boolean(),
  createdAt: z.string(),
});
export type Account = z.infer<typeof accountSchema>;

export const updateAccountInputSchema = z.object({
  enabled: z.boolean(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountInputSchema>;

// ---- Account automation config ----
export const accountConfigSchema = z.object({
  silenceThresholdSeconds: z.number().int().min(5).max(86_400),
  targetVolume: z.number().int().min(0).max(100),
  deviceStrategy: deviceStrategySchema,
  targetDeviceId: z.string().nullable(),
  targetDeviceName: z.string().nullable(),
  playContextUri: z.string().regex(SPOTIFY_CONTEXT_URI_RE).nullable(),
  playUris: z.array(z.string().regex(SPOTIFY_TRACK_URI_RE)).min(1).nullable(),
  shuffle: z.boolean(),
  cooldownSeconds: z.number().int().min(0).max(86_400),
  enabled: z.boolean(),
});
export type AccountConfig = z.infer<typeof accountConfigSchema>;

// ---- Global settings ----
export const settingsSchema = z.object({
  pollIntervalSeconds: z.number().int().min(2).max(300),
});
export type Settings = z.infer<typeof settingsSchema>;

// ---- Client runtime config (served to the SPA) ----
export const clientConfigSchema = z.object({
  spotifyRedirectUri: z.string(),
});
export type ClientConfig = z.infer<typeof clientConfigSchema>;

// ---- Live devices (proxied from Spotify) ----
export const deviceSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  type: z.string(),
  isActive: z.boolean(),
  supportsVolume: z.boolean(),
  volumePercent: z.number().int().nullable(),
});
export type Device = z.infer<typeof deviceSchema>;

// ---- Live status ----
export const nowPlayingSchema = z.object({
  trackName: z.string(),
  artistName: z.string(),
  trackUrl: z.string().nullable(),
});
export type NowPlaying = z.infer<typeof nowPlayingSchema>;

export const statusItemSchema = z.object({
  accountId: z.string(),
  displayName: z.string(),
  enabled: z.boolean(),
  isPremium: z.boolean(),
  reauthRequired: z.boolean(),
  isPlaying: z.boolean(),
  deviceName: z.string().nullable(),
  silentForSeconds: z.number().int().nullable(),
  lastActionAt: z.string().nullable(),
  lastError: z.string().nullable(),
  nowPlaying: nowPlayingSchema.nullable(),
});
export type StatusItem = z.infer<typeof statusItemSchema>;

export const apiErrorSchema = z.object({
  error: z.string(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

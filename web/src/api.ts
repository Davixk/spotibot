import { z } from 'zod';
import {
  accountConfigSchema,
  accountSchema,
  apiErrorSchema,
  authStateSchema,
  clientConfigSchema,
  deviceSchema,
  settingsSchema,
  spotifyAppSchema,
  statusItemSchema,
  type Account,
  type AccountConfig,
  type AuthState,
  type ClientConfig,
  type CreateSpotifyAppInput,
  type Device,
  type Settings,
  type SpotifyApp,
  type StatusItem,
  type UpdateSpotifyAppInput,
} from '@spotibot/shared';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

async function request(path: string, options: RequestOptions = {}): Promise<unknown> {
  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: 'include',
  });

  if (res.status === 204) return null;

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(data);
    const message = parsed.success ? parsed.data.error : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data;
}

// ---- Auth ----
export async function getAuthState(): Promise<AuthState> {
  return authStateSchema.parse(await request('/auth/me'));
}

export async function login(password: string): Promise<AuthState> {
  return authStateSchema.parse(
    await request('/auth/login', { method: 'POST', body: { password } }),
  );
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' });
}

// ---- Client config ----
export async function getClientConfig(): Promise<ClientConfig> {
  return clientConfigSchema.parse(await request('/config'));
}

// ---- Spotify apps ----
export async function listApps(): Promise<SpotifyApp[]> {
  return z.array(spotifyAppSchema).parse(await request('/apps'));
}

export async function createApp(input: CreateSpotifyAppInput): Promise<SpotifyApp> {
  return spotifyAppSchema.parse(await request('/apps', { method: 'POST', body: input }));
}

export async function updateApp(id: string, input: UpdateSpotifyAppInput): Promise<SpotifyApp> {
  return spotifyAppSchema.parse(await request(`/apps/${id}`, { method: 'PUT', body: input }));
}

export async function deleteApp(id: string): Promise<void> {
  await request(`/apps/${id}`, { method: 'DELETE' });
}

// ---- Accounts ----
export async function listAccounts(): Promise<Account[]> {
  return z.array(accountSchema).parse(await request('/accounts'));
}

export async function setAccountEnabled(id: string, enabled: boolean): Promise<Account> {
  return accountSchema.parse(
    await request(`/accounts/${id}`, { method: 'PATCH', body: { enabled } }),
  );
}

export async function deleteAccount(id: string): Promise<void> {
  await request(`/accounts/${id}`, { method: 'DELETE' });
}

export async function getAccountDevices(id: string): Promise<Device[]> {
  return z.array(deviceSchema).parse(await request(`/accounts/${id}/devices`));
}

export async function getAccountConfig(id: string): Promise<AccountConfig> {
  return accountConfigSchema.parse(await request(`/accounts/${id}/config`));
}

export async function updateAccountConfig(
  id: string,
  config: AccountConfig,
): Promise<AccountConfig> {
  return accountConfigSchema.parse(
    await request(`/accounts/${id}/config`, { method: 'PUT', body: config }),
  );
}

// ---- Settings ----
export async function getSettings(): Promise<Settings> {
  return settingsSchema.parse(await request('/settings'));
}

export async function updateSettings(settings: Settings): Promise<Settings> {
  return settingsSchema.parse(await request('/settings', { method: 'PUT', body: settings }));
}

// ---- Status ----
export async function getStatus(): Promise<StatusItem[]> {
  return z.array(statusItemSchema).parse(await request('/status'));
}

/** Begins the Spotify OAuth flow for an app via a full-page navigation. */
export function startSpotifyConnect(appId: string): void {
  window.location.href = `/api/spotify/authorize?appId=${encodeURIComponent(appId)}`;
}

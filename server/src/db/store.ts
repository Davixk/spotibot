import { and, eq, sql } from 'drizzle-orm';
import type { Account, AccountConfig, Settings, SpotifyApp } from '@spotibot/shared';
import type { Database } from './index';
import {
  accountConfigs,
  accounts,
  events,
  libraryAdds,
  settings,
  spotifyApps,
  type AccountConfigRow,
  type AccountRow,
  type SettingsRow,
  type SpotifyAppRow,
} from './schema';

const SETTINGS_ID = 1;

// ---- Mappers (row -> public DTO) ----
export function toAppDto(row: SpotifyAppRow, accountCount: number): SpotifyApp {
  return {
    id: row.id,
    name: row.name,
    clientId: row.clientId,
    redirectUri: row.redirectUri,
    createdAt: row.createdAt.toISOString(),
    accountCount,
  };
}

export function toAccountDto(row: AccountRow): Account {
  return {
    id: row.id,
    appId: row.appId,
    spotifyUserId: row.spotifyUserId,
    displayName: row.displayName,
    isPremium: row.isPremium,
    enabled: row.enabled,
    reauthRequired: row.reauthRequired,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toConfigDto(row: AccountConfigRow): AccountConfig {
  return {
    silenceThresholdSeconds: row.silenceThresholdSeconds,
    targetVolume: row.targetVolume,
    deviceStrategy: row.deviceStrategy,
    targetDeviceId: row.targetDeviceId,
    targetDeviceName: row.targetDeviceName,
    playContextUri: row.playContextUri,
    playUris: row.playUris,
    shuffle: row.shuffle,
    cooldownSeconds: row.cooldownSeconds,
    enabled: row.enabled,
    autoAddToLibrary: row.autoAddToLibrary,
  };
}

export function toSettingsDto(row: SettingsRow): Settings {
  return { pollIntervalSeconds: row.pollIntervalSeconds };
}

// ---- Spotify apps ----
export interface CreateAppParams {
  name: string;
  clientId: string;
  encClientSecret: string;
  redirectUri: string;
}

export async function listSpotifyApps(db: Database): Promise<SpotifyApp[]> {
  const apps = await db.select().from(spotifyApps).orderBy(spotifyApps.createdAt);
  const counts = await db
    .select({ appId: accounts.appId, count: sql<number>`cast(count(*) as int)` })
    .from(accounts)
    .groupBy(accounts.appId);
  const countByApp = new Map(counts.map((c) => [c.appId, c.count]));
  return apps.map((app) => toAppDto(app, countByApp.get(app.id) ?? 0));
}

export async function createSpotifyApp(
  db: Database,
  params: CreateAppParams,
): Promise<SpotifyAppRow> {
  const inserted = await db.insert(spotifyApps).values(params).returning();
  const row = inserted[0];
  if (!row) throw new Error('Failed to insert spotify_apps row');
  return row;
}

export async function getSpotifyApp(db: Database, id: string): Promise<SpotifyAppRow | undefined> {
  const rows = await db.select().from(spotifyApps).where(eq(spotifyApps.id, id));
  return rows[0];
}

export async function deleteSpotifyApp(db: Database, id: string): Promise<void> {
  await db.delete(spotifyApps).where(eq(spotifyApps.id, id));
}

export interface UpdateAppParams {
  name: string;
  clientId: string;
  redirectUri: string;
  encClientSecret?: string;
}

export async function updateSpotifyApp(
  db: Database,
  id: string,
  params: UpdateAppParams,
): Promise<SpotifyAppRow | undefined> {
  const set: Partial<typeof spotifyApps.$inferInsert> = {
    name: params.name,
    clientId: params.clientId,
    redirectUri: params.redirectUri,
  };
  if (params.encClientSecret !== undefined) {
    set.encClientSecret = params.encClientSecret;
  }
  const updated = await db.update(spotifyApps).set(set).where(eq(spotifyApps.id, id)).returning();
  return updated[0];
}

export async function getAppAccountCount(db: Database, appId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(accounts)
    .where(eq(accounts.appId, appId));
  return rows[0]?.count ?? 0;
}

// ---- Accounts ----
export interface UpsertAccountParams {
  appId: string;
  spotifyUserId: string;
  displayName: string;
  encRefreshToken: string;
  isPremium: boolean;
}

export async function listAccounts(db: Database): Promise<AccountRow[]> {
  return db.select().from(accounts).orderBy(accounts.createdAt);
}

export async function getAccount(db: Database, id: string): Promise<AccountRow | undefined> {
  const rows = await db.select().from(accounts).where(eq(accounts.id, id));
  return rows[0];
}

export async function getEnabledAccounts(db: Database): Promise<AccountRow[]> {
  return db.select().from(accounts).where(eq(accounts.enabled, true));
}

export async function upsertAccount(
  db: Database,
  params: UpsertAccountParams,
): Promise<AccountRow> {
  const inserted = await db
    .insert(accounts)
    .values({
      appId: params.appId,
      spotifyUserId: params.spotifyUserId,
      displayName: params.displayName,
      encRefreshToken: params.encRefreshToken,
      isPremium: params.isPremium,
    })
    .onConflictDoUpdate({
      target: [accounts.appId, accounts.spotifyUserId],
      set: {
        displayName: params.displayName,
        encRefreshToken: params.encRefreshToken,
        isPremium: params.isPremium,
        reauthRequired: false,
      },
    })
    .returning();
  const row = inserted[0];
  if (!row) throw new Error('Failed to upsert account row');
  return row;
}

export async function setAccountEnabled(
  db: Database,
  id: string,
  enabled: boolean,
): Promise<AccountRow | undefined> {
  const updated = await db.update(accounts).set({ enabled }).where(eq(accounts.id, id)).returning();
  return updated[0];
}

export async function deleteAccount(db: Database, id: string): Promise<void> {
  await db.delete(accounts).where(eq(accounts.id, id));
}

export async function markAccountReauthRequired(db: Database, id: string): Promise<void> {
  await db.update(accounts).set({ reauthRequired: true }).where(eq(accounts.id, id));
}

export async function setAccountPremium(
  db: Database,
  id: string,
  isPremium: boolean,
): Promise<void> {
  await db.update(accounts).set({ isPremium }).where(eq(accounts.id, id));
}

export async function updateAccountRefreshToken(
  db: Database,
  id: string,
  encRefreshToken: string,
): Promise<void> {
  await db.update(accounts).set({ encRefreshToken }).where(eq(accounts.id, id));
}

// ---- Account config ----
export async function getAccountConfig(db: Database, accountId: string): Promise<AccountConfigRow> {
  await db.insert(accountConfigs).values({ accountId }).onConflictDoNothing();
  const rows = await db
    .select()
    .from(accountConfigs)
    .where(eq(accountConfigs.accountId, accountId));
  const row = rows[0];
  if (!row) throw new Error('Failed to load account config after ensuring default');
  return row;
}

export async function updateAccountConfig(
  db: Database,
  accountId: string,
  config: AccountConfig,
): Promise<AccountConfigRow> {
  await db.insert(accountConfigs).values({ accountId }).onConflictDoNothing();
  const updated = await db
    .update(accountConfigs)
    .set({
      silenceThresholdSeconds: config.silenceThresholdSeconds,
      targetVolume: config.targetVolume,
      deviceStrategy: config.deviceStrategy,
      targetDeviceId: config.targetDeviceId,
      targetDeviceName: config.targetDeviceName,
      playContextUri: config.playContextUri,
      playUris: config.playUris,
      shuffle: config.shuffle,
      cooldownSeconds: config.cooldownSeconds,
      enabled: config.enabled,
      autoAddToLibrary: config.autoAddToLibrary,
    })
    .where(eq(accountConfigs.accountId, accountId))
    .returning();
  const row = updated[0];
  if (!row) throw new Error('Failed to update account config');
  return row;
}

// ---- Settings ----
export async function getSettings(db: Database): Promise<SettingsRow> {
  await db.insert(settings).values({ id: SETTINGS_ID }).onConflictDoNothing();
  const rows = await db.select().from(settings).where(eq(settings.id, SETTINGS_ID));
  const row = rows[0];
  if (!row) throw new Error('Failed to load settings after ensuring default');
  return row;
}

export async function updateSettings(db: Database, next: Settings): Promise<SettingsRow> {
  await db.insert(settings).values({ id: SETTINGS_ID }).onConflictDoNothing();
  const updated = await db
    .update(settings)
    .set({ pollIntervalSeconds: next.pollIntervalSeconds })
    .where(eq(settings.id, SETTINGS_ID))
    .returning();
  const row = updated[0];
  if (!row) throw new Error('Failed to update settings');
  return row;
}

// ---- Events (best-effort audit log) ----
export async function recordEvent(
  db: Database,
  accountId: string | null,
  type: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await db.insert(events).values({ accountId, type, detail });
}

// ---- Library auto-add bookkeeping ----
export async function isTrackProcessed(
  db: Database,
  accountId: string,
  trackId: string,
): Promise<boolean> {
  const rows = await db
    .select({ trackId: libraryAdds.trackId })
    .from(libraryAdds)
    .where(and(eq(libraryAdds.accountId, accountId), eq(libraryAdds.trackId, trackId)))
    .limit(1);
  return rows.length > 0;
}

export async function recordTrackProcessed(
  db: Database,
  accountId: string,
  trackId: string,
): Promise<void> {
  await db.insert(libraryAdds).values({ accountId, trackId }).onConflictDoNothing();
}

import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { DeviceStrategy } from '@spotibot/shared';

export const spotifyApps = pgTable('spotify_apps', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  clientId: text('client_id').notNull(),
  encClientSecret: text('enc_client_secret').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appId: uuid('app_id')
      .notNull()
      .references(() => spotifyApps.id, { onDelete: 'cascade' }),
    spotifyUserId: text('spotify_user_id').notNull(),
    displayName: text('display_name').notNull(),
    encRefreshToken: text('enc_refresh_token').notNull(),
    isPremium: boolean('is_premium').notNull().default(false),
    enabled: boolean('enabled').notNull().default(true),
    reauthRequired: boolean('reauth_required').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('accounts_app_user_unique').on(table.appId, table.spotifyUserId)],
);

export const accountConfigs = pgTable('account_configs', {
  accountId: uuid('account_id')
    .primaryKey()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  silenceThresholdSeconds: integer('silence_threshold_seconds').notNull().default(180),
  targetVolume: integer('target_volume').notNull().default(50),
  deviceStrategy: text('device_strategy')
    .$type<DeviceStrategy>()
    .notNull()
    .default('first_available'),
  targetDeviceId: text('target_device_id'),
  targetDeviceName: text('target_device_name'),
  playContextUri: text('play_context_uri'),
  playUris: jsonb('play_uris').$type<string[]>(),
  shuffle: boolean('shuffle').notNull().default(false),
  cooldownSeconds: integer('cooldown_seconds').notNull().default(60),
  enabled: boolean('enabled').notNull().default(false),
});

export const settings = pgTable('settings', {
  id: integer('id').primaryKey().notNull(),
  pollIntervalSeconds: integer('poll_interval_seconds').notNull().default(5),
});

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  type: text('type').notNull(),
  detail: jsonb('detail'),
});

export type SpotifyAppRow = typeof spotifyApps.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
export type AccountConfigRow = typeof accountConfigs.$inferSelect;
export type SettingsRow = typeof settings.$inferSelect;

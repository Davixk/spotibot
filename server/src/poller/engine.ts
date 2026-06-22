import type { FastifyBaseLogger } from 'fastify';
import type { NowPlaying, StatusItem } from '@spotibot/shared';
import type { Database } from '../db/index';
import type { AccountConfigRow, AccountRow } from '../db/schema';
import {
  getAccountConfig,
  getEnabledAccounts,
  getSettings,
  isTrackProcessed,
  listAccounts,
  recordEvent,
  recordTrackProcessed,
  setAccountPremium,
  toAccountDto,
} from '../db/store';
import {
  getDevices,
  getPlaybackState,
  type PlaybackState,
  saveTrack,
  setShuffle,
  setVolume,
  startPlayback,
  transferPlayback,
} from '../spotify/client';
import { ReauthRequiredError, SpotifyApiError } from '../spotify/errors';
import type { TokenManager } from '../spotify/tokens';
import { pickDevice, shouldStartPlayback } from './rules';

interface AccountRuntime {
  lastPlayingAt: number;
  lastActionAt: number | null;
  isPlaying: boolean;
  deviceName: string | null;
  nowPlaying: NowPlaying | null;
  lastError: string | null;
  rateLimitedUntil: number | null;
  lastAutoAddTrackId: string | null;
}

export interface PollerDeps {
  db: Database;
  tokens: TokenManager;
  logger: FastifyBaseLogger;
}

const DEFAULT_POLL_INTERVAL_SECONDS = 5;
const DEFAULT_RATE_LIMIT_BACKOFF_SECONDS = 30;

/**
 * Supervisor loop. On each tick it loads the enabled accounts, polls each one's
 * playback state, and starts configured playback when an account has been silent
 * for longer than its threshold. Per-account runtime state lives in memory.
 */
export class PollerEngine {
  private readonly runtime = new Map<string, AccountRuntime>();
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private stopped = true;

  constructor(private readonly deps: PollerDeps) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.scheduleNext(0);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  invalidate(accountId: string): void {
    this.runtime.delete(accountId);
    this.deps.tokens.invalidate(accountId);
  }

  private scheduleNext(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      void this.runTick();
    }, delayMs);
  }

  private async runTick(): Promise<void> {
    if (this.ticking) {
      this.scheduleNext(1000);
      return;
    }
    this.ticking = true;
    let pollIntervalSeconds = DEFAULT_POLL_INTERVAL_SECONDS;
    try {
      const settings = await getSettings(this.deps.db);
      pollIntervalSeconds = settings.pollIntervalSeconds;
      const accounts = await getEnabledAccounts(this.deps.db);
      const activeIds = new Set(accounts.map((account) => account.id));
      for (const id of [...this.runtime.keys()]) {
        if (!activeIds.has(id)) this.runtime.delete(id);
      }
      for (const account of accounts) {
        await this.processAccount(account);
      }
    } catch (error) {
      this.deps.logger.error({ err: error }, 'poller tick failed');
    } finally {
      this.ticking = false;
      this.scheduleNext(pollIntervalSeconds * 1000);
    }
  }

  private getRuntime(accountId: string, now: number): AccountRuntime {
    const existing = this.runtime.get(accountId);
    if (existing) return existing;
    const fresh: AccountRuntime = {
      lastPlayingAt: now,
      lastActionAt: null,
      isPlaying: false,
      deviceName: null,
      nowPlaying: null,
      lastError: null,
      rateLimitedUntil: null,
      lastAutoAddTrackId: null,
    };
    this.runtime.set(accountId, fresh);
    return fresh;
  }

  private async processAccount(account: AccountRow): Promise<void> {
    const now = Date.now();
    const state = this.getRuntime(account.id, now);

    if (account.reauthRequired) {
      state.lastError = 'Re-authentication required';
      state.isPlaying = false;
      // We cannot observe playback, so do not charge this time as silence.
      state.lastPlayingAt = now;
      return;
    }
    if (state.rateLimitedUntil !== null && state.rateLimitedUntil > now) {
      // Blind during backoff; keep the silence clock anchored to now.
      state.lastPlayingAt = now;
      return;
    }

    try {
      const token = await this.deps.tokens.getAccessToken(account);
      const playback = await this.fetchPlayback(account, token);
      // Silence is driven purely by the playback flag. A genuinely-playing but
      // restricted (id-less) device must NOT be treated as silence.
      const isPlaying = playback !== null && playback.isPlaying;

      state.isPlaying = isPlaying;
      state.deviceName = playback?.device?.name ?? null;
      state.nowPlaying = playback?.nowPlaying ?? null;
      state.lastError = null;

      const config = await getAccountConfig(this.deps.db, account.id);

      if (config.autoAddToLibrary && isPlaying && playback?.trackId != null) {
        await this.maybeAutoAddToLibrary(account, token, playback.trackId, state);
      }

      if (isPlaying) {
        state.lastPlayingAt = now;
        return;
      }

      const shouldAct = shouldStartPlayback({
        isPlaying,
        now,
        lastPlayingAt: state.lastPlayingAt,
        lastActionAt: state.lastActionAt,
        silenceThresholdSeconds: config.silenceThresholdSeconds,
        cooldownSeconds: config.cooldownSeconds,
        enabled: config.enabled,
      });
      if (shouldAct) {
        await this.triggerPlayback(account, config, state, now);
      }
    } catch (error) {
      await this.handleError(account, state, error, now);
    }
  }

  /** Reads playback state, refreshing the token and retrying once on a 401. */
  private async fetchPlayback(account: AccountRow, token: string): Promise<PlaybackState | null> {
    try {
      return await getPlaybackState(token);
    } catch (error) {
      if (error instanceof SpotifyApiError && error.status === 401) {
        this.deps.tokens.invalidate(account.id);
        const freshToken = await this.deps.tokens.getAccessToken(account);
        return await getPlaybackState(freshToken);
      }
      throw error;
    }
  }

  /**
   * Adds the currently playing track to the account's library, but only once per
   * track ever. We persist every track we add, and never act on a track again, so
   * if the user later removes it we do not fight them by re-adding it.
   */
  private async maybeAutoAddToLibrary(
    account: AccountRow,
    token: string,
    trackId: string,
    state: AccountRuntime,
  ): Promise<void> {
    if (state.lastAutoAddTrackId === trackId) return;
    state.lastAutoAddTrackId = trackId;
    try {
      if (await isTrackProcessed(this.deps.db, account.id, trackId)) return;
      await saveTrack(token, trackId);
      await recordTrackProcessed(this.deps.db, account.id, trackId);
      await this.safeRecord(account.id, 'library_add', { trackId });
    } catch (error) {
      this.deps.logger.warn(
        { err: error, accountId: account.id, trackId },
        'failed to auto-add track to library',
      );
    }
  }

  private async triggerPlayback(
    account: AccountRow,
    config: AccountConfigRow,
    state: AccountRuntime,
    now: number,
  ): Promise<void> {
    const hasTarget =
      config.playContextUri !== null || (config.playUris !== null && config.playUris.length > 0);
    if (!hasTarget) {
      state.lastError = 'No music set configured';
      return;
    }

    const token = await this.deps.tokens.getAccessToken(account);
    const devices = await getDevices(token);
    const device = pickDevice(devices, config.deviceStrategy, {
      id: config.targetDeviceId,
      name: config.targetDeviceName,
    });
    if (!device || device.id === null) {
      state.lastError = 'No usable Spotify Connect device online';
      return;
    }

    // Arm the cooldown the moment we commit to acting, so a partial failure
    // mid-sequence still respects cooldownSeconds before retrying.
    state.lastActionAt = now;
    state.lastPlayingAt = now;

    await transferPlayback(token, device.id);
    if (device.supportsVolume) {
      await setVolume(token, device.id, config.targetVolume);
    }
    if (config.shuffle) {
      await setShuffle(token, device.id, true);
    }
    await startPlayback(token, {
      deviceId: device.id,
      contextUri: config.playContextUri,
      uris: config.playUris,
    });

    state.lastError = null;
    await this.safeRecord(account.id, 'action', {
      deviceId: device.id,
      deviceName: device.name,
      volume: config.targetVolume,
    });
    this.deps.logger.info(
      { accountId: account.id, deviceName: device.name },
      'started playback after silence',
    );
  }

  private async handleError(
    account: AccountRow,
    state: AccountRuntime,
    error: unknown,
    now: number,
  ): Promise<void> {
    // An error means we could not complete a clean observation; anchor the
    // silence clock to now so unobservable time is not charged as silence.
    state.lastPlayingAt = now;

    if (error instanceof ReauthRequiredError) {
      state.lastError = 'Re-authentication required';
      return;
    }
    if (error instanceof SpotifyApiError) {
      if (error.status === 401) {
        // Drop the rejected token so the next tick force-refreshes.
        this.deps.tokens.invalidate(account.id);
        state.lastError = 'Spotify rejected the access token; refreshing';
        return;
      }
      if (error.status === 429) {
        const backoffSeconds = error.retryAfterSeconds ?? DEFAULT_RATE_LIMIT_BACKOFF_SECONDS;
        state.rateLimitedUntil = now + backoffSeconds * 1000;
        state.lastError = 'Rate limited by Spotify';
        return;
      }
      if (error.status === 403) {
        if (error.reason === 'PREMIUM_REQUIRED') {
          await this.persistPremium(account.id, false);
          state.lastError = 'Spotify Premium is required for playback control';
        } else {
          state.lastError = `Spotify forbade the request (${error.reason ?? 'unknown reason'})`;
        }
        return;
      }
      state.lastError = error.message;
      return;
    }
    state.lastError = error instanceof Error ? error.message : 'Unknown error';
    this.deps.logger.error({ err: error, accountId: account.id }, 'account processing failed');
  }

  private async persistPremium(accountId: string, isPremium: boolean): Promise<void> {
    try {
      await setAccountPremium(this.deps.db, accountId, isPremium);
    } catch (error) {
      this.deps.logger.warn({ err: error, accountId }, 'failed to persist premium status');
    }
  }

  private async safeRecord(
    accountId: string,
    type: string,
    detail: Record<string, unknown>,
  ): Promise<void> {
    try {
      await recordEvent(this.deps.db, accountId, type, detail);
    } catch (error) {
      this.deps.logger.warn({ err: error }, 'failed to record event');
    }
  }

  async getStatus(): Promise<StatusItem[]> {
    const accounts = await listAccounts(this.deps.db);
    const now = Date.now();
    return accounts.map((account) => {
      const state = this.runtime.get(account.id);
      const dto = toAccountDto(account);
      const silentForSeconds =
        state && !state.isPlaying
          ? Math.max(0, Math.floor((now - state.lastPlayingAt) / 1000))
          : null;
      return {
        accountId: account.id,
        displayName: dto.displayName,
        enabled: dto.enabled,
        isPremium: dto.isPremium,
        reauthRequired: dto.reauthRequired,
        isPlaying: state?.isPlaying ?? false,
        deviceName: state?.deviceName ?? null,
        silentForSeconds,
        lastActionAt:
          state?.lastActionAt != null ? new Date(state.lastActionAt).toISOString() : null,
        lastError: state?.lastError ?? null,
        nowPlaying: state?.nowPlaying ?? null,
      };
    });
  }
}

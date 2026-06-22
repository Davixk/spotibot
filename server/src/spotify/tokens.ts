import { decryptSecret, encryptSecret } from '../crypto';
import type { Database } from '../db/index';
import type { AccountRow } from '../db/schema';
import { getSpotifyApp, markAccountReauthRequired, updateAccountRefreshToken } from '../db/store';
import { OAuthError, ReauthRequiredError } from './errors';
import { refreshAccessToken } from './oauth';

interface CachedToken {
  token: string;
  expiresAt: number;
}

const EXPIRY_MARGIN_MS = 30_000;

/**
 * Resolves valid Spotify access tokens for accounts, refreshing them with the
 * owning app's credentials and caching them in memory until shortly before they
 * expire. Access tokens are never persisted; only encrypted refresh tokens are.
 */
export class TokenManager {
  private readonly cache = new Map<string, CachedToken>();

  constructor(
    private readonly db: Database,
    private readonly encryptionKey: Buffer,
  ) {}

  invalidate(accountId: string): void {
    this.cache.delete(accountId);
  }

  async getAccessToken(account: AccountRow): Promise<string> {
    const now = Date.now();
    const cached = this.cache.get(account.id);
    if (cached && cached.expiresAt > now + EXPIRY_MARGIN_MS) {
      return cached.token;
    }

    const app = await getSpotifyApp(this.db, account.appId);
    if (!app) {
      throw new Error(`Spotify app ${account.appId} not found for account ${account.id}`);
    }

    const clientSecret = decryptSecret(app.encClientSecret, this.encryptionKey);
    const refreshToken = decryptSecret(account.encRefreshToken, this.encryptionKey);

    const response = await refreshAccessToken(
      { clientId: app.clientId, clientSecret },
      refreshToken,
    ).catch(async (error: unknown) => {
      if (error instanceof OAuthError && error.isInvalidGrant) {
        await markAccountReauthRequired(this.db, account.id);
        this.cache.delete(account.id);
        throw new ReauthRequiredError(account.id);
      }
      throw error;
    });

    const expiresAt = now + response.expires_in * 1000;
    this.cache.set(account.id, { token: response.access_token, expiresAt });

    if (response.refresh_token && response.refresh_token !== refreshToken) {
      await updateAccountRefreshToken(
        this.db,
        account.id,
        encryptSecret(response.refresh_token, this.encryptionKey),
      );
    }

    return response.access_token;
  }
}

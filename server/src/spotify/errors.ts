export interface SpotifyApiErrorOptions {
  retryAfterSeconds?: number | null;
  reason?: string | null;
}

/** Raised for non-2xx responses from the Spotify Web API. */
export class SpotifyApiError extends Error {
  readonly status: number;
  readonly retryAfterSeconds: number | null;
  readonly reason: string | null;

  constructor(status: number, message: string, options: SpotifyApiErrorOptions = {}) {
    super(message);
    this.name = 'SpotifyApiError';
    this.status = status;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.reason = options.reason ?? null;
  }
}

/** Raised for failures from the Spotify accounts/token endpoints. */
export class OAuthError extends Error {
  readonly status: number;
  readonly errorCode: string | null;

  constructor(status: number, errorCode: string | null, message: string) {
    super(message);
    this.name = 'OAuthError';
    this.status = status;
    this.errorCode = errorCode;
  }

  get isInvalidGrant(): boolean {
    return this.errorCode === 'invalid_grant';
  }
}

/** Raised when an account's refresh token is no longer valid and the user must re-authorize. */
export class ReauthRequiredError extends Error {
  readonly accountId: string;

  constructor(accountId: string) {
    super(`Account ${accountId} requires re-authentication`);
    this.name = 'ReauthRequiredError';
    this.accountId = accountId;
  }
}

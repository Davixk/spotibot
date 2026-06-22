import { OAuthError } from './errors';
import { oauthErrorSchema, profileSchema, tokenResponseSchema, type TokenResponse } from './types';

const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const AUTHORIZE_ENDPOINT = 'https://accounts.spotify.com/authorize';
const PROFILE_ENDPOINT = 'https://api.spotify.com/v1/me';

export const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  // Required for the `product` field on /v1/me, used to detect Spotify Premium.
  'user-read-private',
] as const;

export interface AppCredentials {
  clientId: string;
  clientSecret: string;
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', SPOTIFY_SCOPES.join(' '));
  url.searchParams.set('state', params.state);
  return url.toString();
}

function basicAuthHeader(creds: AppCredentials): string {
  const encoded = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
  return `Basic ${encoded}`;
}

async function requestToken(creds: AppCredentials, body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(creds),
    },
    body,
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    const parsed = oauthErrorSchema.safeParse(data);
    const code = parsed.success ? (parsed.data.error ?? null) : null;
    const message = parsed.success
      ? (parsed.data.error_description ?? parsed.data.error ?? 'Token request failed')
      : 'Token request failed';
    throw new OAuthError(res.status, code, message);
  }
  return tokenResponseSchema.parse(data);
}

export function exchangeCodeForTokens(
  creds: AppCredentials,
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  return requestToken(creds, body);
}

export function refreshAccessToken(
  creds: AppCredentials,
  refreshToken: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  return requestToken(creds, body);
}

export interface SpotifyProfile {
  id: string;
  displayName: string;
  isPremium: boolean;
}

export async function fetchProfile(accessToken: string): Promise<SpotifyProfile> {
  const res = await fetch(PROFILE_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new OAuthError(res.status, null, 'Failed to fetch Spotify profile');
  }
  const data: unknown = await res.json();
  const profile = profileSchema.parse(data);
  return {
    id: profile.id,
    displayName: profile.display_name ?? profile.id,
    isPremium: profile.product === 'premium',
  };
}

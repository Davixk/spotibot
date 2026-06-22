import type { Device, NowPlaying } from '@spotibot/shared';
import { SpotifyApiError } from './errors';
import {
  apiErrorBodySchema,
  devicesResponseSchema,
  playbackStateSchema,
  type DeviceApi,
} from './types';

const API_BASE = 'https://api.spotify.com/v1';

export interface PlaybackState {
  isPlaying: boolean;
  device: Device | null;
  nowPlaying: NowPlaying | null;
}

function toDevice(device: DeviceApi): Device {
  return {
    id: device.id,
    name: device.name,
    type: device.type,
    isActive: device.is_active,
    supportsVolume: device.supports_volume ?? true,
    volumePercent: device.volume_percent ?? null,
  };
}

interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

async function spotifyRequest(
  method: string,
  path: string,
  accessToken: string,
  options: RequestOptions = {},
): Promise<Response> {
  const url = new URL(`${API_BASE}${path}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.ok || res.status === 204) return res;

  if (res.status === 429) {
    const header = res.headers.get('retry-after');
    let retryAfterSeconds: number | null = null;
    if (header !== null) {
      const parsed = Number.parseInt(header, 10);
      if (!Number.isNaN(parsed)) {
        retryAfterSeconds = parsed;
      } else {
        // Retry-After may also be an HTTP-date per RFC 9110.
        const dateMs = Date.parse(header);
        if (!Number.isNaN(dateMs)) {
          retryAfterSeconds = Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));
        }
      }
    }
    throw new SpotifyApiError(429, 'Spotify rate limit hit', { retryAfterSeconds });
  }

  let reason: string | null = null;
  let message = `Spotify request failed with status ${res.status}`;
  try {
    const data: unknown = await res.json();
    const parsed = apiErrorBodySchema.safeParse(data);
    if (parsed.success && parsed.data.error) {
      reason = parsed.data.error.reason ?? null;
      message = parsed.data.error.message ?? message;
    }
  } catch {
    // Non-JSON error body; keep the default message.
  }
  throw new SpotifyApiError(res.status, message, { reason });
}

export async function getPlaybackState(accessToken: string): Promise<PlaybackState | null> {
  const res = await spotifyRequest('GET', '/me/player', accessToken);
  if (res.status === 204) return null;
  const data: unknown = await res.json();
  const state = playbackStateSchema.parse(data);
  const item = state.item ?? null;
  const nowPlaying: NowPlaying | null = item
    ? {
        trackName: item.name,
        artistName: item.artists.map((artist) => artist.name).join(', '),
        trackUrl: item.external_urls?.spotify ?? null,
      }
    : null;
  return {
    isPlaying: state.is_playing,
    device: state.device ? toDevice(state.device) : null,
    nowPlaying,
  };
}

export async function getDevices(accessToken: string): Promise<Device[]> {
  const res = await spotifyRequest('GET', '/me/player/devices', accessToken);
  const data: unknown = await res.json();
  const parsed = devicesResponseSchema.parse(data);
  return parsed.devices.map(toDevice);
}

export async function transferPlayback(accessToken: string, deviceId: string): Promise<void> {
  await spotifyRequest('PUT', '/me/player', accessToken, {
    body: { device_ids: [deviceId], play: false },
  });
}

export async function setVolume(
  accessToken: string,
  deviceId: string,
  volumePercent: number,
): Promise<void> {
  await spotifyRequest('PUT', '/me/player/volume', accessToken, {
    query: { volume_percent: volumePercent, device_id: deviceId },
  });
}

export async function setShuffle(
  accessToken: string,
  deviceId: string,
  state: boolean,
): Promise<void> {
  await spotifyRequest('PUT', '/me/player/shuffle', accessToken, {
    query: { state, device_id: deviceId },
  });
}

export interface StartPlaybackParams {
  deviceId: string;
  contextUri?: string | null;
  uris?: string[] | null;
}

export async function startPlayback(
  accessToken: string,
  params: StartPlaybackParams,
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (params.contextUri) {
    body.context_uri = params.contextUri;
  } else if (params.uris && params.uris.length > 0) {
    body.uris = params.uris;
  }
  await spotifyRequest('PUT', '/me/player/play', accessToken, {
    query: { device_id: params.deviceId },
    body,
  });
}

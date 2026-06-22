import type { Device, DeviceStrategy } from '@spotibot/shared';

export interface SilenceDecisionInput {
  /** Whether Spotify currently reports active playback on a device. */
  isPlaying: boolean;
  /** Current timestamp (ms). */
  now: number;
  /** Last timestamp (ms) playback was observed (or when watching began). */
  lastPlayingAt: number;
  /** Last timestamp (ms) the engine triggered playback, or null if never. */
  lastActionAt: number | null;
  silenceThresholdSeconds: number;
  cooldownSeconds: number;
  /** Whether the silence automation is enabled for this account. */
  enabled: boolean;
}

/**
 * Pure decision: should the engine start playback now? True only when the
 * automation is enabled, nothing is playing, silence has lasted at least the
 * threshold, and we are past the post-action cooldown.
 */
export function shouldStartPlayback(input: SilenceDecisionInput): boolean {
  if (!input.enabled) return false;
  if (input.isPlaying) return false;

  const silentForMs = input.now - input.lastPlayingAt;
  if (silentForMs < input.silenceThresholdSeconds * 1000) return false;

  if (input.lastActionAt !== null) {
    const sinceActionMs = input.now - input.lastActionAt;
    if (sinceActionMs < input.cooldownSeconds * 1000) return false;
  }

  return true;
}

export interface DeviceTarget {
  id: string | null;
  name: string | null;
}

/**
 * Pure device selection from the live device list. Returns null when no usable
 * (addressable) device is online. The engine cannot conjure a device.
 */
export function pickDevice(
  devices: Device[],
  strategy: DeviceStrategy,
  target: DeviceTarget,
): Device | null {
  const usable = devices.filter((device) => device.id !== null);
  if (usable.length === 0) return null;

  switch (strategy) {
    case 'named': {
      const match = usable.find(
        (device) =>
          (target.id !== null && device.id === target.id) ||
          (target.name !== null && device.name === target.name),
      );
      return match ?? null;
    }
    case 'last_active': {
      const active = usable.find((device) => device.isActive);
      return active ?? usable[0] ?? null;
    }
    case 'first_available':
      return usable[0] ?? null;
  }
}

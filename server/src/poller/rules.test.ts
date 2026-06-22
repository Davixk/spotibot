import { describe, expect, it } from 'vitest';
import type { Device } from '@spotibot/shared';
import { pickDevice, shouldStartPlayback, type SilenceDecisionInput } from './rules';

const baseDecision: SilenceDecisionInput = {
  isPlaying: false,
  now: 600_000,
  lastPlayingAt: 0,
  lastActionAt: null,
  silenceThresholdSeconds: 60,
  cooldownSeconds: 30,
  enabled: true,
};

function device(overrides: Partial<Device>): Device {
  return {
    id: 'dev-1',
    name: 'Speaker',
    type: 'Speaker',
    isActive: false,
    supportsVolume: true,
    volumePercent: 50,
    ...overrides,
  };
}

describe('shouldStartPlayback', () => {
  it('triggers after the silence threshold elapses', () => {
    expect(shouldStartPlayback(baseDecision)).toBe(true);
  });

  it('does not trigger when disabled', () => {
    expect(shouldStartPlayback({ ...baseDecision, enabled: false })).toBe(false);
  });

  it('does not trigger while music is playing', () => {
    expect(shouldStartPlayback({ ...baseDecision, isPlaying: true })).toBe(false);
  });

  it('does not trigger before the threshold is reached', () => {
    expect(shouldStartPlayback({ ...baseDecision, now: 30_000, lastPlayingAt: 0 })).toBe(false);
  });

  it('exactly at the threshold triggers', () => {
    expect(shouldStartPlayback({ ...baseDecision, now: 60_000, lastPlayingAt: 0 })).toBe(true);
  });

  it('respects the post-action cooldown', () => {
    expect(shouldStartPlayback({ ...baseDecision, lastActionAt: 590_000 })).toBe(false);
  });

  it('triggers again once the cooldown passes', () => {
    expect(shouldStartPlayback({ ...baseDecision, lastActionAt: 560_000 })).toBe(true);
  });
});

describe('pickDevice', () => {
  it('returns null when no devices are online', () => {
    expect(pickDevice([], 'first_available', { id: null, name: null })).toBeNull();
  });

  it('ignores devices without an addressable id', () => {
    expect(
      pickDevice([device({ id: null })], 'first_available', { id: null, name: null }),
    ).toBeNull();
  });

  it('first_available returns the first usable device', () => {
    const result = pickDevice(
      [device({ id: 'a', name: 'A' }), device({ id: 'b', name: 'B' })],
      'first_available',
      { id: null, name: null },
    );
    expect(result?.id).toBe('a');
  });

  it('last_active prefers the active device', () => {
    const result = pickDevice(
      [device({ id: 'a', isActive: false }), device({ id: 'b', isActive: true })],
      'last_active',
      { id: null, name: null },
    );
    expect(result?.id).toBe('b');
  });

  it('last_active falls back to the first device when none are active', () => {
    const result = pickDevice([device({ id: 'a' }), device({ id: 'b' })], 'last_active', {
      id: null,
      name: null,
    });
    expect(result?.id).toBe('a');
  });

  it('named matches by device id', () => {
    const result = pickDevice(
      [device({ id: 'a', name: 'Kitchen' }), device({ id: 'b', name: 'Office' })],
      'named',
      { id: 'b', name: null },
    );
    expect(result?.id).toBe('b');
  });

  it('named matches by device name', () => {
    const result = pickDevice(
      [device({ id: 'a', name: 'Kitchen' }), device({ id: 'b', name: 'Office' })],
      'named',
      { id: null, name: 'Office' },
    );
    expect(result?.id).toBe('b');
  });

  it('named returns null when the target is not online', () => {
    const result = pickDevice([device({ id: 'a', name: 'Kitchen' })], 'named', {
      id: null,
      name: 'Office',
    });
    expect(result).toBeNull();
  });
});

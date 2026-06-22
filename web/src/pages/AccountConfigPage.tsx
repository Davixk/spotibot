import { type FormEvent, type ReactElement, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { type AccountConfig, type Device, deviceStrategySchema } from '@spotibot/shared';
import { ApiError, getAccountConfig, getAccountDevices, updateAccountConfig } from '../api';

export function AccountConfigPage(): ReactElement {
  const params = useParams();
  const id = params.id ?? '';
  const configQuery = useQuery({
    queryKey: ['config', id],
    queryFn: () => getAccountConfig(id),
    enabled: id !== '',
  });

  if (configQuery.isPending) return <p className="muted">Loading…</p>;
  if (configQuery.isError || configQuery.data === undefined) {
    return <p className="error">Failed to load configuration.</p>;
  }
  return <ConfigForm accountId={id} initial={configQuery.data} />;
}

interface ConfigFormProps {
  accountId: string;
  initial: AccountConfig;
}

function ConfigForm({ accountId, initial }: ConfigFormProps): ReactElement {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AccountConfig>(initial);
  const [contextInput, setContextInput] = useState(initial.playContextUri ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const devicesQuery = useQuery({
    queryKey: ['devices', accountId],
    queryFn: () => getAccountDevices(accountId),
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: (config: AccountConfig) => updateAccountConfig(accountId, config),
    onSuccess: async (updated) => {
      setForm(updated);
      setContextInput(updated.playContextUri ?? '');
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['status'] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Failed to save');
    },
  });

  function update<K extends keyof AccountConfig>(key: K, value: AccountConfig[K]): void {
    setForm((prev) => {
      const next: AccountConfig = { ...prev };
      next[key] = value;
      return next;
    });
    setSaved(false);
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setError(null);
    const contextUri = parseContextUri(contextInput);
    if (contextInput.trim() !== '' && contextUri === null) {
      setError('Enter a valid Spotify playlist/album/artist link or URI.');
      return;
    }
    saveMutation.mutate({ ...form, playContextUri: contextUri, playUris: null });
  };

  const devices = devicesQuery.data ?? [];

  return (
    <section>
      <div className="row between">
        <h2>Automation</h2>
        <Link to="/">← Back</Link>
      </div>
      <form className="card" onSubmit={onSubmit}>
        <label className="switch">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => {
              update('enabled', e.target.checked);
            }}
          />
          <span>Enable silence automation</span>
        </label>

        <label>
          Start playback after silence (seconds)
          <input
            type="number"
            min={5}
            max={86400}
            value={form.silenceThresholdSeconds}
            onChange={(e) => {
              update('silenceThresholdSeconds', Number(e.target.value));
            }}
          />
        </label>

        <label>
          Target volume (%)
          <input
            type="number"
            min={0}
            max={100}
            value={form.targetVolume}
            onChange={(e) => {
              update('targetVolume', Number(e.target.value));
            }}
          />
        </label>

        <label>
          Cooldown between triggers (seconds)
          <input
            type="number"
            min={0}
            max={86400}
            value={form.cooldownSeconds}
            onChange={(e) => {
              update('cooldownSeconds', Number(e.target.value));
            }}
          />
        </label>

        <label>
          Device strategy
          <select
            value={form.deviceStrategy}
            onChange={(e) => {
              const parsed = deviceStrategySchema.safeParse(e.target.value);
              if (parsed.success) update('deviceStrategy', parsed.data);
            }}
          >
            <option value="first_available">First available device</option>
            <option value="last_active">Last active device</option>
            <option value="named">A specific device</option>
          </select>
        </label>

        {form.deviceStrategy === 'named' ? (
          <label>
            Device
            <DeviceSelect
              devices={devices}
              value={form.targetDeviceName}
              hasError={devicesQuery.isError}
              onChange={(deviceName) => {
                update('targetDeviceName', deviceName);
              }}
            />
          </label>
        ) : null}

        <label>
          Music set (Spotify playlist/album/artist link or URI)
          <input
            value={contextInput}
            placeholder="https://open.spotify.com/playlist/..."
            onChange={(e) => {
              setContextInput(e.target.value);
              setSaved(false);
            }}
          />
        </label>

        <label className="switch">
          <input
            type="checkbox"
            checked={form.shuffle}
            onChange={(e) => {
              update('shuffle', e.target.checked);
            }}
          />
          <span>Shuffle</span>
        </label>

        {error !== null ? <p className="error">{error}</p> : null}
        {saved ? <p className="ok-text">Saved.</p> : null}
        <button type="submit" disabled={saveMutation.isPending}>
          Save
        </button>
      </form>
    </section>
  );
}

interface DeviceSelectProps {
  devices: Device[];
  value: string | null;
  hasError: boolean;
  onChange: (deviceName: string | null) => void;
}

function DeviceSelect({ devices, value, hasError, onChange }: DeviceSelectProps): ReactElement {
  if (hasError) {
    return (
      <input
        value={value ?? ''}
        placeholder="Device name (devices unavailable)"
        onChange={(e) => {
          onChange(e.target.value === '' ? null : e.target.value);
        }}
      />
    );
  }
  return (
    <select
      value={value ?? ''}
      onChange={(e) => {
        onChange(e.target.value === '' ? null : e.target.value);
      }}
    >
      <option value="">Choose a device…</option>
      {devices.map((device) => (
        <option key={device.id ?? device.name} value={device.name}>
          {device.name} ({device.type})
        </option>
      ))}
    </select>
  );
}

function parseContextUri(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  if (/^spotify:(playlist|album|artist):[A-Za-z0-9]+$/.test(trimmed)) return trimmed;
  const match = /open\.spotify\.com\/(playlist|album|artist)\/([A-Za-z0-9]+)/.exec(trimmed);
  if (match) {
    const kind = match[1];
    const resourceId = match[2];
    if (kind !== undefined && resourceId !== undefined) {
      return `spotify:${kind}:${resourceId}`;
    }
  }
  return null;
}

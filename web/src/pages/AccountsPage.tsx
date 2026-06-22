import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { StatusItem } from '@spotibot/shared';
import { deleteAccount, getStatus, listApps, setAccountEnabled, startSpotifyConnect } from '../api';

export function AccountsPage(): ReactElement {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({ queryKey: ['status'], queryFn: getStatus, refetchInterval: 4000 });
  const appsQuery = useQuery({ queryKey: ['apps'], queryFn: listApps });
  const [selectedApp, setSelectedApp] = useState('');

  const enableMutation = useMutation({
    mutationFn: (vars: { id: string; enabled: boolean }) =>
      setAccountEnabled(vars.id, vars.enabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });

  const apps = appsQuery.data ?? [];
  const items = statusQuery.data ?? [];
  const effectiveApp = selectedApp || (apps[0]?.id ?? '');

  return (
    <section>
      <div className="row between">
        <h2>Accounts</h2>
        <div className="connect">
          {apps.length === 0 ? (
            <Link to="/apps">Add a Spotify app first →</Link>
          ) : (
            <>
              <select
                value={effectiveApp}
                onChange={(e) => {
                  setSelectedApp(e.target.value);
                }}
              >
                {apps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={effectiveApp === ''}
                onClick={() => {
                  startSpotifyConnect(effectiveApp);
                }}
              >
                Connect account
              </button>
            </>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="muted">No accounts connected yet.</p>
      ) : (
        <ul className="cards">
          {items.map((item) => (
            <AccountCard
              key={item.accountId}
              item={item}
              onToggle={(enabled) => {
                enableMutation.mutate({ id: item.accountId, enabled });
              }}
              onRemove={() => {
                removeMutation.mutate(item.accountId);
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface AccountCardProps {
  item: StatusItem;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
}

function AccountCard({ item, onToggle, onRemove }: AccountCardProps): ReactElement {
  const statusLabel = describeStatus(item);
  return (
    <li className="card">
      <div className="row between">
        <strong>{item.displayName}</strong>
        <div className="badges">
          {!item.isPremium ? <span className="badge warn">No Premium</span> : null}
          {item.reauthRequired ? <span className="badge danger">Re-auth</span> : null}
          <span className={`badge ${item.isPlaying ? 'ok' : ''}`}>
            {item.isPlaying ? 'Playing' : 'Silent'}
          </span>
        </div>
      </div>
      <p className="muted">{statusLabel}</p>
      {item.nowPlaying !== null ? (
        <p className="nowplaying">
          ♪ {item.nowPlaying.trackName} — {item.nowPlaying.artistName}
        </p>
      ) : null}
      {item.lastError !== null ? <p className="error">{item.lastError}</p> : null}
      <div className="row between">
        <label className="switch">
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={(e) => {
              onToggle(e.target.checked);
            }}
          />
          <span>Watch account</span>
        </label>
        <div className="actions">
          <Link to={`/accounts/${item.accountId}/config`}>Configure</Link>
          <button type="button" className="danger" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

function describeStatus(item: StatusItem): string {
  if (item.reauthRequired) return 'Needs re-authentication';
  if (item.isPlaying) {
    return item.deviceName !== null ? `Playing on ${item.deviceName}` : 'Playing';
  }
  if (item.silentForSeconds !== null) return `Silent for ${item.silentForSeconds}s`;
  return 'Idle';
}

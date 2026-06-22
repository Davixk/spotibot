import { type FormEvent, type ReactElement, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, createApp, deleteApp, listApps } from '../api';

export function AppsPage(): ReactElement {
  const queryClient = useQueryClient();
  const appsQuery = useQuery({ queryKey: ['apps'], queryFn: listApps });

  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState(`${window.location.origin}/api/spotify/callback`);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createApp({ name, clientId, clientSecret, redirectUri }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['apps'] });
      setName('');
      setClientId('');
      setClientSecret('');
      setError(null);
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Failed to create app');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApp(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setError(null);
    createMutation.mutate();
  };

  const apps = appsQuery.data ?? [];

  return (
    <section>
      <h2>Spotify Apps</h2>
      <p className="muted">
        Register OAuth credentials from your Spotify Developer dashboard. Each app can authorize up
        to 5 accounts in Development Mode — add more apps to manage more accounts.
      </p>

      <form className="card" onSubmit={onSubmit}>
        <label>
          Name
          <input
            value={name}
            placeholder="My Spotify app"
            required
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
        </label>
        <label>
          Client ID
          <input
            value={clientId}
            required
            onChange={(e) => {
              setClientId(e.target.value);
            }}
          />
        </label>
        <label>
          Client secret
          <input
            type="password"
            value={clientSecret}
            required
            onChange={(e) => {
              setClientSecret(e.target.value);
            }}
          />
        </label>
        <label>
          Redirect URI
          <input
            value={redirectUri}
            required
            onChange={(e) => {
              setRedirectUri(e.target.value);
            }}
          />
        </label>
        <p className="hint">Add this exact redirect URI in your Spotify app settings.</p>
        {error !== null ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={createMutation.isPending}>
          Add app
        </button>
      </form>

      <ul className="cards">
        {apps.map((app) => (
          <li className="card" key={app.id}>
            <div className="row between">
              <strong>{app.name}</strong>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  deleteMutation.mutate(app.id);
                }}
              >
                Delete
              </button>
            </div>
            <p className="muted mono">{app.clientId}</p>
            <p className="muted">
              {app.accountCount} account(s) · {app.redirectUri}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

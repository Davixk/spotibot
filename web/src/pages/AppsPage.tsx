import { type FormEvent, type ReactElement, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import type { SpotifyApp } from '@spotibot/shared';
import { ApiError, createApp, deleteApp, getClientConfig, listApps, updateApp } from '../api';

export function AppsPage(): ReactElement {
  const queryClient = useQueryClient();
  const appsQuery = useQuery({ queryKey: ['apps'], queryFn: listApps });

  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const configQuery = useQuery({ queryKey: ['client-config'], queryFn: getClientConfig });
  const suggestedRedirectUri =
    configQuery.data?.spotifyRedirectUri ?? `${window.location.origin}/api/spotify/callback`;
  const [redirectOverride, setRedirectOverride] = useState<string | null>(null);
  const redirectUri = redirectOverride ?? suggestedRedirectUri;
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createApp({ name, clientId, clientSecret, redirectUri }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['apps'] });
      setName('');
      setClientId('');
      setClientSecret('');
      setRedirectOverride(null);
      setError(null);
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Failed to create app');
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

      <div className="card instructions">
        <p>
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
            Open the Spotify Developer Dashboard
            <ExternalLink size={13} />
          </a>{' '}
          to create an app, then paste its credentials below.
        </p>
        <ol>
          <li>
            Click <strong>Create app</strong> and tick <strong>Web API</strong>.
          </li>
          <li>
            Set the app&apos;s <strong>Redirect URI</strong> to exactly{' '}
            <code className="mono">{redirectUri}</code>.
          </li>
          <li>
            Open <strong>Settings</strong>, then copy the <strong>Client ID</strong> and{' '}
            <strong>Client secret</strong> into the form.
          </li>
        </ol>
        <p className="hint">
          The redirect URI must be HTTPS (or a <code className="mono">http://127.0.0.1</code>{' '}
          loopback); Spotify rejects plain-http LAN or localhost addresses as insecure, so serve
          spotibot over HTTPS and set PUBLIC_BASE_URL to that URL. Each app authorizes up to 5
          accounts (Development Mode); add more apps for more accounts. The account you control must
          be Spotify Premium.
        </p>
      </div>

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
              setRedirectOverride(e.target.value);
            }}
          />
        </label>
        {error !== null ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={createMutation.isPending}>
          <Plus size={16} />
          Add app
        </button>
      </form>

      <ul className="cards">
        {apps.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </ul>
    </section>
  );
}

function AppCard({ app }: { app: SpotifyApp }): ReactElement {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => deleteApp(app.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });

  if (editing) {
    return (
      <EditAppForm
        app={app}
        onDone={() => {
          setEditing(false);
        }}
      />
    );
  }

  return (
    <li className="card">
      <div className="row between">
        <strong>{app.name}</strong>
        <div className="actions">
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setEditing(true);
            }}
          >
            <Pencil size={15} />
            Edit
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              deleteMutation.mutate();
            }}
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>
      <p className="muted mono">{app.clientId}</p>
      <p className="muted">
        {app.accountCount} account(s) · {app.redirectUri}
      </p>
    </li>
  );
}

interface EditAppFormProps {
  app: SpotifyApp;
  onDone: () => void;
}

function EditAppForm({ app, onDone }: EditAppFormProps): ReactElement {
  const queryClient = useQueryClient();
  const [name, setName] = useState(app.name);
  const [clientId, setClientId] = useState(app.clientId);
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState(app.redirectUri);
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateApp(app.id, {
        name,
        clientId,
        redirectUri,
        clientSecret: clientSecret.length > 0 ? clientSecret : undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['apps'] });
      onDone();
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Failed to update app');
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setError(null);
    saveMutation.mutate();
  };

  return (
    <li className="card">
      <form className="edit-form" onSubmit={onSubmit}>
        <label>
          Name
          <input
            value={name}
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
            placeholder="Leave blank to keep current secret"
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
        {error !== null ? <p className="error">{error}</p> : null}
        <div className="actions">
          <button type="submit" disabled={saveMutation.isPending}>
            <Save size={16} />
            Save
          </button>
          <button type="button" className="ghost" onClick={onDone}>
            <X size={16} />
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}

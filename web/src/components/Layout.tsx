import type { ReactElement } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../api';

export function Layout(): ReactElement {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth'] });
      await navigate('/login');
    },
  });

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">spotibot</div>
        <nav className="nav">
          <NavLink to="/" end>
            Accounts
          </NavLink>
          <NavLink to="/apps">Spotify Apps</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            logoutMutation.mutate();
          }}
          disabled={logoutMutation.isPending}
        >
          Log out
        </button>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        Controls your own Spotify Connect devices. Not affiliated with Spotify.
      </footer>
    </div>
  );
}

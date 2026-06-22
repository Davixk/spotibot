import type { ReactElement } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Headphones, KeyRound, LogOut, Settings, Users } from 'lucide-react';
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
        <div className="brand">
          <Headphones size={18} />
          spotibot
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            <Users size={16} />
            Accounts
          </NavLink>
          <NavLink to="/apps">
            <KeyRound size={16} />
            Spotify Apps
          </NavLink>
          <NavLink to="/settings">
            <Settings size={16} />
            Settings
          </NavLink>
        </nav>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            logoutMutation.mutate();
          }}
          disabled={logoutMutation.isPending}
        >
          <LogOut size={16} />
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

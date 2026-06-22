import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { getAuthState } from './api';
import { Layout } from './components/Layout';
import { AccountConfigPage } from './pages/AccountConfigPage';
import { AccountsPage } from './pages/AccountsPage';
import { AppsPage } from './pages/AppsPage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';

export function App(): ReactElement {
  const authQuery = useQuery({ queryKey: ['auth'], queryFn: getAuthState });

  if (authQuery.isPending) {
    return (
      <div className="center muted">
        <LoaderCircle size={20} className="spin" />
      </div>
    );
  }

  const authenticated = authQuery.data?.authenticated ?? false;
  if (!authenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<AccountsPage />} />
        <Route path="/apps" element={<AppsPage />} />
        <Route path="/accounts/:id/config" element={<AccountConfigPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

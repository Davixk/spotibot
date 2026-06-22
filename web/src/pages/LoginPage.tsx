import { type FormEvent, type ReactElement, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, login } from '../api';

export function LoginPage(): ReactElement {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: () => login(password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setError(null);
    loginMutation.mutate();
  };

  return (
    <div className="center">
      <form className="card login" onSubmit={onSubmit}>
        <h1>spotibot</h1>
        <p className="muted">Enter the dashboard password to continue.</p>
        <input
          type="password"
          value={password}
          placeholder="Password"
          autoFocus
          onChange={(e) => {
            setPassword(e.target.value);
          }}
        />
        {error !== null ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={loginMutation.isPending || password.length === 0}>
          {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

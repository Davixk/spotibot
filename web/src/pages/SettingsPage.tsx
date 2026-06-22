import { type FormEvent, type ReactElement, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Save } from 'lucide-react';
import type { Settings } from '@spotibot/shared';
import { getSettings, updateSettings } from '../api';

export function SettingsPage(): ReactElement {
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  if (settingsQuery.isPending) {
    return (
      <p className="muted loading">
        <LoaderCircle size={16} className="spin" />
        Loading
      </p>
    );
  }
  if (settingsQuery.isError || settingsQuery.data === undefined) {
    return <p className="error">Failed to load settings.</p>;
  }
  return <SettingsForm initial={settingsQuery.data} />;
}

function SettingsForm({ initial }: { initial: Settings }): ReactElement {
  const queryClient = useQueryClient();
  const [pollIntervalSeconds, setPollIntervalSeconds] = useState(initial.pollIntervalSeconds);
  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => updateSettings({ pollIntervalSeconds }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setSaved(false);
    saveMutation.mutate();
  };

  return (
    <section>
      <h2>Settings</h2>
      <form className="card" onSubmit={onSubmit}>
        <label>
          Poll interval (seconds)
          <input
            type="number"
            min={2}
            max={300}
            value={pollIntervalSeconds}
            onChange={(e) => {
              setPollIntervalSeconds(Number(e.target.value));
              setSaved(false);
            }}
          />
        </label>
        <p className="hint">
          How often each account&apos;s playback is checked. 5s is a good default.
        </p>
        {saved ? <p className="ok-text">Saved.</p> : null}
        <button type="submit" disabled={saveMutation.isPending}>
          <Save size={16} />
          Save
        </button>
      </form>
    </section>
  );
}

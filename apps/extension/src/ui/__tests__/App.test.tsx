import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HubrisProvider } from '../../state/HubrisProvider';
import { useHubris } from '../../state/useHubris';
import {
  completeOnboarding,
  addLog,
  createActivity,
  eraseAll,
  listActivities,
  listLogs,
  ValidationError,
} from '../../storage/repository';
import * as repository from '../../storage/repository';
import { App } from '../App';
import { ActivityForm } from '../components/ActivityForm';

function RefreshButton() {
  const { actions } = useHubris();
  return <button onClick={() => void actions.retry()}>Refresh data</button>;
}

beforeEach(async () => {
  await eraseAll();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Hubris UI', () => {
  it('completes the 3-step onboarding flow with example activities and skippable first activity form', async () => {
    render(
      <HubrisProvider>
        <App surface="popup" />
      </HubrisProvider>,
    );

    await screen.findByText(/Log in two seconds, see an honest weekly score/i);
    expect(screen.getByText(/36\/36\/28 by category/i)).toBeTruthy();
    expect(screen.getByText(/40\/35\/25 by importance/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    const exampleBtn = await screen.findByRole('button', {
      name: /Start with an example \(Leetcode and Classes\)/i,
    });
    fireEvent.click(exampleBtn);

    await screen.findByText(/Add a weekly activity/i);
    fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }));

    await screen.findByRole('tab', { name: 'Today' });
    expect(screen.getByText('Leetcode')).toBeTruthy();
    expect(screen.getByText('Classes')).toBeTruthy();
  });

  it('logs an activity, updates the score orbit, shows the toast, and undoes the log', async () => {
    await completeOnboarding(true);

    render(
      <HubrisProvider>
        <App surface="popup" />
      </HubrisProvider>,
    );

    const logButton = await screen.findByRole('button', {
      name: 'Log Leetcode, 0 of 5 this week',
    });
    fireEvent.click(logButton);

    await screen.findByText('Leetcode logged');
    await screen.findByRole('button', {
      name: 'Log Leetcode, 1 of 5 this week',
    });

    const undoButton = screen.getByRole('button', { name: 'Undo' });
    fireEvent.click(undoButton);

    await waitFor(() => {
      expect(screen.queryByText('Leetcode logged')).toBeNull();
    });
    await screen.findByRole('button', {
      name: 'Log Leetcode, 0 of 5 this week',
    });
  });

  it('keeps an open draft mounted and shows a retry alert when refresh fails', async () => {
    await completeOnboarding(false);
    const readSnapshot = vi.spyOn(repository, 'readSnapshot');
    render(
      <HubrisProvider>
        <RefreshButton />
        <App surface="popup" />
      </HubrisProvider>,
    );
    const refreshButton = await screen.findByRole('button', { name: 'Refresh data' });
    fireEvent.click(await screen.findByRole('button', { name: 'Add activity' }));
    fireEvent.change(screen.getByLabelText('Activity name'), { target: { value: 'Unsubmitted draft' } });

    readSnapshot.mockRejectedValueOnce(new Error('Refresh failed.'));
    fireEvent.click(refreshButton);

    expect(await screen.findByRole('alert')).toHaveTextContent('Refresh failed.');
    expect(screen.getByLabelText('Activity name')).toHaveValue('Unsubmitted draft');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByLabelText('Activity name')).toHaveValue('Unsubmitted draft');
  });

  it('returns to the optional activity step after retrying a failed starter refresh', async () => {
    const readSnapshot = vi.spyOn(repository, 'readSnapshot');
    render(
      <HubrisProvider>
        <App surface="popup" />
      </HubrisProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    readSnapshot.mockRejectedValue(new Error('Refresh failed.'));
    fireEvent.click(screen.getByRole('button', { name: /Start blank/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Refresh failed.');
    expect(screen.getByText('Add a weekly activity')).toBeTruthy();
    readSnapshot.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByText('Add a weekly activity')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeTruthy();
  });

  it('lists weekly suggestions with their exact action names', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 19, 15));
    await completeOnboarding(false);
    await createActivity({
      name: 'Leetcode',
      category: 'career',
      timesPerWeek: 5,
      importance: 'high',
    });
    const meditation = await createActivity({
      name: 'Meditation',
      category: 'health',
      timesPerWeek: 7,
      importance: 'high',
    });
    for (const day of [16, 17, 18]) {
      await addLog(meditation.id, undefined, new Date(2026, 10, day, 8));
    }

    render(<HubrisProvider><App surface="popup" /></HubrisProvider>);

    const region = await screen.findByRole('region', { name: 'Worth doing next' });
    expect(within(region).getByText('Leetcode needs 5 more this week, with 4 days left.')).toBeTruthy();
    expect(within(region).getByText('Keep your Meditation streak going: it is not logged today.')).toBeTruthy();
    expect(within(region).getByRole('button', { name: 'Log Leetcode' })).toBeTruthy();
    expect(within(region).getByRole('button', { name: 'Log Meditation' })).toBeTruthy();
  });

  it('logs a suggestion once, offers Undo, and refreshes the suggestion', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 19, 15));
    await completeOnboarding(false);
    const meditation = await createActivity({
      name: 'Meditation',
      category: 'health',
      timesPerWeek: 7,
      importance: 'high',
    });
    for (const day of [16, 17, 18]) {
      await addLog(meditation.id, undefined, new Date(2026, 10, day, 8));
    }
    render(<HubrisProvider><App surface="popup" /></HubrisProvider>);
    const region = await screen.findByRole('region', { name: 'Worth doing next' });
    const logButton = within(region).getByRole('button', { name: 'Log Meditation' });

    fireEvent.click(logButton);
    fireEvent.click(logButton);

    await screen.findByText('Meditation logged');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    await waitFor(async () => {
      expect(await listLogs()).toHaveLength(4);
    });
    await waitFor(() => {
      expect(within(region).queryByText(/Keep your Meditation streak going/)).toBeNull();
    });
    expect(within(region).getByText('You are on pace this week.')).toBeTruthy();
  });

  it('moves focus to the weekly log button when a logged suggestion disappears', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 19, 15));
    await completeOnboarding(false);
    const meditation = await createActivity({ name: 'Meditation', category: 'health', timesPerWeek: 7, importance: 'high' });
    for (const day of [16, 17, 18]) await addLog(meditation.id, undefined, new Date(2026, 10, day, 8));
    render(<HubrisProvider><App surface="popup" /></HubrisProvider>);
    const region = await screen.findByRole('region', { name: 'Worth doing next' });
    const logButton = within(region).getByRole('button', { name: 'Log Meditation' });
    logButton.focus();
    fireEvent.click(logButton);
    await waitFor(() => expect(within(region).queryByRole('button', { name: 'Log Meditation' })).toBeNull());
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Log Meditation, /));
  });

  it('leaves focus alone when the user moved elsewhere before the suggestion disappeared', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 19, 15));
    await completeOnboarding(false);
    const meditation = await createActivity({ name: 'Meditation', category: 'health', timesPerWeek: 7, importance: 'high' });
    for (const day of [16, 17, 18]) await addLog(meditation.id, undefined, new Date(2026, 10, day, 8));
    render(<HubrisProvider><App surface="popup" /></HubrisProvider>);
    const region = await screen.findByRole('region', { name: 'Worth doing next' });
    const logButton = within(region).getByRole('button', { name: 'Log Meditation' });
    logButton.focus();
    fireEvent.click(logButton);
    const elsewhere = screen.getByRole('button', { name: 'Add activity' });
    elsewhere.focus();
    await waitFor(() => expect(within(region).queryByRole('button', { name: 'Log Meditation' })).toBeNull());
    expect(document.activeElement).toBe(elsewhere);
  });

  it('shows an on-pace line when active activities have no suggestions', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 19, 15));
    await completeOnboarding(false);
    const reading = await createActivity({
      name: 'Reading',
      category: 'hobbies-habits',
      timesPerWeek: 3,
      importance: 'medium',
    });
    await addLog(reading.id, undefined, new Date(2026, 10, 19, 8));

    render(<HubrisProvider><App surface="popup" /></HubrisProvider>);

    const region = await screen.findByRole('region', { name: 'Worth doing next' });
    expect(within(region).getByText('You are on pace this week.')).toBeTruthy();
    expect(within(region).queryByRole('list')).toBeNull();
  });

  it('does not render suggestions when there are no active activities', async () => {
    await completeOnboarding(false);
    render(<HubrisProvider><App surface="popup" /></HubrisProvider>);

    await screen.findByText('Add your first activity');
    expect(screen.queryByRole('region', { name: 'Worth doing next' })).toBeNull();
    expect(screen.queryByText('You are on pace this week.')).toBeNull();
  });

  it('validates the activity form fields inline and displays repository ValidationError messages', async () => {
    render(
      <ActivityForm
        onSubmit={async () => {
          throw new ValidationError('Repository rejected duplicate activity.');
        }}
      />,
    );

    expect(screen.getByText('High counts 40%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save activity' }));
    expect(await screen.findByText('Enter an activity name.')).toBeTruthy();

    const nameInput = screen.getByLabelText('Activity name');
    fireEvent.change(nameInput, { target: { value: 'a'.repeat(61) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save activity' }));
    expect(
      await screen.findByText('Use at most 60 characters for the name.'),
    ).toBeTruthy();

    fireEvent.change(nameInput, { target: { value: 'Morning Swim' } });
    const goalInput = screen.getByLabelText('Weekly goal');
    fireEvent.change(goalInput, { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save activity' }));
    expect(
      await screen.findByText('Weekly goal must be at most 99.'),
    ).toBeTruthy();

    fireEvent.change(goalInput, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save activity' }));
    expect(
      await screen.findByText('Repository rejected duplicate activity.'),
    ).toBeTruthy();
  });

  it('displays readable import validation errors in Settings when importing a malformed backup', async () => {
    await completeOnboarding(false);

    render(
      <HubrisProvider>
        <App surface="popup" />
      </HubrisProvider>,
    );

    const settingsTab = await screen.findByRole('tab', { name: 'Settings' });
    fireEvent.click(settingsTab);

    const fileInput = await screen.findByLabelText('Import backup file');
    const badBackup = JSON.stringify({
      app: 'hubris',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      activities: [],
      logs: [
        {
          id: 'log-1',
          activityId: 'missing-activity',
          loggedAt: new Date().toISOString(),
        },
      ],
    });
    const file = new File([badBackup], 'invalid-backup.json', {
      type: 'application/json',
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const confirmBtn = await screen.findByRole('button', {
      name: 'Confirm import',
    });
    fireEvent.click(confirmBtn);

    await screen.findByText(/Log points to an unknown activity/i);
  });

  it('shows empty states across Today, Trends, and History when there are no activities or logs', async () => {
    await completeOnboarding(false);

    render(
      <HubrisProvider>
        <App surface="popup" />
      </HubrisProvider>,
    );

    await screen.findByText('Add your first activity');
    expect(screen.getAllByText('No activities yet').length).toBeGreaterThanOrEqual(3);

    fireEvent.click(screen.getByRole('tab', { name: 'Trends' }));
    await screen.findByTestId('trends-empty-state');
    expect(screen.getByText('No logs recorded yet')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'History' }));
    await screen.findByTestId('history-empty-state');
    expect(screen.getByText('No logs in history yet')).toBeTruthy();

    await createActivity({
      name: 'Reading',
      category: 'hobbies-habits',
      timesPerWeek: 3,
      importance: 'low',
    });
  });
});


it.each(['Edit Leetcode', 'Delete Leetcode', 'Erase all data', 'Delete log for Leetcode'])('returns focus to %s after cancel', async (name) => {
  await completeOnboarding(true);
  const activities = await listActivities();
  const example = activities.find((activity) => activity.name === 'Leetcode');
  if (!example) throw new Error('Missing example activity');
  await addLog(example.id);
  render(<HubrisProvider><App surface="popup" /></HubrisProvider>);
  fireEvent.click(await screen.findByRole('tab', { name: name.startsWith('Delete log') ? 'History' : 'Settings' }));
  const opener = screen.getByRole('button', { name });
  opener.focus();
  fireEvent.click(opener);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(opener).toHaveFocus());
});

it.each(['activity', 'log'])('returns focus to a surviving control after deleting a %s', async (kind) => {
  await completeOnboarding(false);
  const activity = await createActivity({ name: 'Practice', category: 'career', timesPerWeek: 1, importance: 'high' });
  await addLog(activity.id);
  render(<HubrisProvider><App surface="popup" /></HubrisProvider>);
  fireEvent.click(await screen.findByRole('tab', { name: kind === 'activity' ? 'Settings' : 'History' }));
  const opener = screen.getByRole('button', { name: kind === 'activity' ? 'Delete Practice' : 'Delete log for Practice' });
  opener.focus();
  fireEvent.click(opener);
  fireEvent.click(screen.getByRole('button', { name: kind === 'activity' ? 'Delete activity and logs' : 'Confirm delete' }));
  await waitFor(() => expect(opener).not.toBeInTheDocument());
  await waitFor(() => expect(kind === 'activity' ? screen.getByRole('button', { name: 'Add activity' }) : screen.getByRole('heading', { name: 'Activity history' })).toHaveFocus());
});

it('returns focus to the file control when cancelling import confirmation', async () => {
  await completeOnboarding(false);
  render(<HubrisProvider><App surface="popup" /></HubrisProvider>);
  fireEvent.click(await screen.findByRole('tab', { name: 'Settings' }));
  const input = screen.getByLabelText('Import backup file');
  input.focus();
  fireEvent.change(input, { target: { files: [new File(['{}'], 'backup.json')] } });
  const cancel = screen.getByRole('button', { name: 'Cancel' });
  cancel.focus();
  fireEvent.click(cancel);
  expect(input).toHaveFocus();
});

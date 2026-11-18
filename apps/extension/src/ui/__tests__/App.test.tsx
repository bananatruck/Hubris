import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HubrisProvider } from '../../state/HubrisProvider';
import {
  completeOnboarding,
  addLog,
  createActivity,
  eraseAll,
  listActivities,
  ValidationError,
} from '../../storage/repository';
import { App } from '../App';
import { ActivityForm } from '../components/ActivityForm';

beforeEach(async () => {
  await eraseAll();
});

afterEach(() => {
  cleanup();
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

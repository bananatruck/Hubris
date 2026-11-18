import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HubrisProvider } from './HubrisProvider';
import { useHubris } from './useHubris';
import { createActivity, eraseAll } from '../storage/repository';
import * as repository from '../storage/repository';

function Consumer() {
  const state = useHubris();
  return <>
    <p>Status: {state.status}</p>
    <p>Score: {state.report.overall}</p>
    <p>Logs: {state.logs.length}</p>
    <p>Trend: {state.trend.length}</p>
    <p>Heatmap: {state.heatmap.length}</p>
    <p>Error: {state.error ?? 'none'}</p>
    <button onClick={() => { const activity = state.activities[0]; if (activity) void state.actions.logActivity(activity.id); }}>Log</button>
    <button onClick={() => { const log = state.logs[0]; if (log) void state.actions.undoLog(log); }}>Undo</button>
    <button onClick={() => void state.actions.retry()}>Retry</button>
  </>;
}
beforeEach(eraseAll);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('loads stored activities, logs and undoes an activity, and recomputes the report', async () => {
  await createActivity({ name: 'Practice', category: 'career', timesPerWeek: 1, importance: 'high' });
  render(<HubrisProvider><Consumer /></HubrisProvider>);
  await screen.findByText('Status: ready');
  expect(screen.getByText('Score: 0')).toBeTruthy();
  expect(screen.getByText('Trend: 8')).toBeTruthy();
  expect(screen.getByText('Heatmap: 84')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Log' }));
  await waitFor(() => { expect(screen.getByText('Score: 36')).toBeTruthy(); });
  expect(screen.getByText('Logs: 1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(() => { expect(screen.getByText('Score: 0')).toBeTruthy(); });
  expect(screen.getByText('Logs: 0')).toBeTruthy();
});

it('keeps loaded data ready when a refresh fails', async () => {
  await createActivity({ name: 'Practice', category: 'career', timesPerWeek: 1, importance: 'high' });
  const readSnapshot = vi.spyOn(repository, 'readSnapshot');
  render(<HubrisProvider><Consumer /></HubrisProvider>);
  await screen.findByText('Status: ready');

  readSnapshot.mockRejectedValueOnce(new Error('Refresh failed.'));
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

  await screen.findByText('Error: Refresh failed.');
  expect(screen.getByText('Status: ready')).toBeTruthy();
  expect(screen.getByText('Logs: 0')).toBeTruthy();
});

it('aligns all 84 heatmap days into twelve Monday to Sunday weeks', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 18, 12));
  function Dates() {
    const { heatmap, status } = useHubris();
    return <p>{status === 'ready' ? `${heatmap[0]?.date} through ${heatmap[83]?.date}` : 'Loading'}</p>;
  }
  try {
    render(<HubrisProvider><Dates /></HubrisProvider>);
    const dates = await screen.findByText('2026-08-31 through 2026-11-22');
    expect(dates).toBeTruthy();
    expect(new Date('2026-08-31T12:00:00').getDay()).toBe(1);
    expect(new Date('2026-11-22T12:00:00').getDay()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

it('computes weekly suggestions from the current activities, logs, and clock', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 19, 15));
  await createActivity({ name: 'Leetcode', category: 'career', timesPerWeek: 5, importance: 'high' });
  function Suggestions() {
    const { status, suggestions } = useHubris();
    return <p>{status === 'ready' ? suggestions.map((suggestion) => suggestion.message).join('|') : 'Loading'}</p>;
  }
  try {
    render(<HubrisProvider><Suggestions /></HubrisProvider>);
    expect(await screen.findByText('Leetcode needs 5 more this week, with 4 days left.')).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});

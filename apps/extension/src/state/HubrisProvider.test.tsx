import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HubrisProvider } from './HubrisProvider';
import { useHubris } from './useHubris';
import { createActivity, eraseAll } from '../storage/repository';

function Consumer() {
  const state = useHubris();
  return <>
    <p>Status: {state.status}</p>
    <p>Score: {state.report.overall}</p>
    <p>Logs: {state.logs.length}</p>
    <p>Trend: {state.trend.length}</p>
    <p>Heatmap: {state.heatmap.length}</p>
    <button onClick={() => { const activity = state.activities[0]; if (activity) void state.actions.logActivity(activity.id); }}>Log</button>
    <button onClick={() => { const log = state.logs[0]; if (log) void state.actions.undoLog(log); }}>Undo</button>
  </>;
}
beforeEach(eraseAll);
afterEach(cleanup);
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

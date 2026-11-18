import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { computeWeeklyReport, computeWeeklyTrend, generateLogHeatmap, getWeekBounds } from '@hubris/core';
import { HubrisContext, type HubrisState } from '../../state/useHubris';
import { ValidationError } from '../../storage/validation';
import { App } from '../App';
import { SegmentedControl } from '../components/21st/segmented-control';

const now = new Date(2026, 10, 18, 12);
const activity = { id: 'a', name: 'Practice', category: 'career', timesPerWeek: 3, importance: 'high', archived: false, createdAt: now.toISOString(), updatedAt: now.toISOString() } satisfies HubrisState['activities'][number];
const log = { id: 'l', activityId: 'a', loggedAt: now.toISOString() };
function setup(overrides: Partial<HubrisState> = {}, actionOverrides: Partial<HubrisState['actions']> = {}) {
  const actions: HubrisState['actions'] = {
    createActivity: vi.fn(async () => activity), updateActivity: vi.fn(async () => activity),
    setArchived: vi.fn(async () => activity), deleteActivity: vi.fn(async () => {}),
    logActivity: vi.fn(async () => log), undoLog: vi.fn(async () => {}), deleteLog: vi.fn(async () => {}),
    exportBackup: vi.fn(async () => {}), importBackup: vi.fn(async () => ({ activities: 1, logs: 1 })),
    eraseAll: vi.fn(async () => {}), completeOnboarding: vi.fn(async () => {}), retry: vi.fn(async () => {}),
    ...actionOverrides,
  };
  const state: HubrisState = {
    status: 'ready', error: null, now, activities: [activity], logs: [log], onboardingComplete: true,
    report: computeWeeklyReport([activity], [log], now), trend: computeWeeklyTrend([activity], [log], now),
    heatmap: generateLogHeatmap([log], 84, getWeekBounds(now).end), actions, ...overrides,
  };
  render(<HubrisContext.Provider value={state}><App surface="popup" /></HubrisContext.Provider>);
  return actions;
}
const failure = () => Promise.reject(new ValidationError('Storage is full.'));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('announces the score outside the image semantics', () => {
  setup();
  const rings = screen.getByRole('img', { name: /Overall weekly score/ });
  expect(rings.tagName.toLowerCase()).toBe('svg');
  expect(rings.parentElement?.querySelector('[aria-live="polite"]')).toBeTruthy();
  expect(rings.querySelector('[aria-live]')).toBeNull();
});

it('disables only the pending log row and reports a rejected write', async () => {
  let rejectWrite: (reason: unknown) => void = () => {};
  const logActivity = vi.fn<HubrisState['actions']['logActivity']>(() => new Promise((_, reject) => { rejectWrite = reject; }));
  const other = { ...activity, id: 'b', name: 'Reading' };
  setup({ activities: [activity, other], report: computeWeeklyReport([activity, other], [log], now) }, { logActivity });
  const button = screen.getByRole('button', { name: /Log Practice/ });
  fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(screen.getByRole('button', { name: /Log Reading/ })).toBeEnabled();
  fireEvent.click(button);
  expect(logActivity).toHaveBeenCalledTimes(1);
  rejectWrite(new ValidationError('Storage is full.'));
  expect(await screen.findByRole('status')).toHaveTextContent('Storage is full.');
  await waitFor(() => expect(button).toBeEnabled());
  expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
});

it.each(['archive', 'restore', 'export'] as const)('reports %s failures', async (kind) => {
  setup(kind === 'restore' ? { activities: [{ ...activity, archived: true }] } : {}, { setArchived: failure, exportBackup: failure });
  fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: kind === 'export' ? 'Export backup' : `${kind === 'archive' ? 'Archive' : 'Restore'} Practice` }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Storage is full.'));
});

it('reports undo failure without offering another undo', async () => {
  setup({}, { undoLog: failure });
  fireEvent.click(screen.getByRole('button', { name: /Log Practice/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Could not undo. The log is still there.'));
  expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
});

it.each(['activity', 'log', 'erase'] as const)('keeps the %s dialog open while pending and on failure, then closes on success', async (kind) => {
  let rejectWrite: (reason: unknown) => void = () => {};
  const pending = vi.fn<() => Promise<void>>().mockImplementationOnce(() => new Promise((_, reject) => { rejectWrite = reject; })).mockResolvedValue(undefined);
  setup({}, { deleteActivity: pending, deleteLog: pending, eraseAll: pending });
  fireEvent.click(screen.getByRole('tab', { name: kind === 'log' ? 'History' : 'Settings' }));
  const trigger = kind === 'activity' ? 'Delete Practice' : kind === 'erase' ? 'Erase all data' : /Delete log for Practice/;
  fireEvent.click(screen.getByRole('button', { name: trigger }));
  const dialog = screen.getByRole('dialog');
  if (kind === 'erase') {
    const input = within(dialog).getByLabelText('Type erase to confirm');
    fireEvent.change(input, { target: { value: 'ERASE' } });
    expect(within(dialog).getByRole('button', { name: 'Confirm erase' })).toBeDisabled();
    fireEvent.change(input, { target: { value: 'erase' } });
  }
  const confirm = within(dialog).getByRole('button', { name: kind === 'activity' ? 'Delete activity and logs' : kind === 'log' ? 'Confirm delete' : 'Confirm erase' });
  fireEvent.click(confirm);
  expect(confirm).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
  expect(screen.getByRole('dialog')).toBe(dialog);
  rejectWrite(new ValidationError('Storage is full.'));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Storage is full.');
  await waitFor(() => expect(confirm).toBeEnabled());
  fireEvent.click(confirm);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

it('shows onboarding failure below the choices and permits retry', async () => {
  const completeOnboarding = vi.fn().mockRejectedValueOnce(new Error('Storage is full.')).mockResolvedValue(undefined);
  setup({ onboardingComplete: false }, { completeOnboarding });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: /Start blank/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Storage is full.');
  fireEvent.click(screen.getByRole('button', { name: /Start blank/ }));
  expect(await screen.findByText('Add a weekly activity')).toBeTruthy();
});

it('renders future heatmap cells as empty upcoming days without counts', () => {
  setup({ heatmap: generateLogHeatmap([{ ...log, loggedAt: new Date(2026, 10, 20, 12).toISOString() }], 84, getWeekBounds(now).end) });
  fireEvent.click(screen.getByRole('tab', { name: 'Trends' }));
  const cell = screen.getByLabelText('Fri, Nov 20, upcoming');
  expect(cell).toHaveClass('bg-transparent');
  expect(cell).not.toHaveAttribute('title', expect.stringContaining('logs'));
});

it('resets the file input so the same backup can be chosen again', async () => {
  const actions = setup();
  fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
  const input = screen.getByLabelText<HTMLInputElement>('Import backup file');
  const file = new File(['{}'], 'backup.json');
  // Browsers only allow assigning an empty string to file inputs.
  let value = 'C:\\fakepath\\backup.json';
  Object.defineProperty(input, 'value', { configurable: true, get: () => value, set: (next: string) => { value = next; } });
  fireEvent.change(input, { target: { files: [file] } });
  expect(input.value).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }));
  await waitFor(() => expect(actions.importBackup).toHaveBeenCalledTimes(1));
  fireEvent.change(input, { target: { files: [file] } });
  expect(screen.getByRole('button', { name: 'Confirm import' })).toBeTruthy();
});

it('waits for the window id and catches side panel rejection within the click gesture', async () => {
  let onWindow: (win: { id: number }) => void = () => {};
  const open = vi.fn(() => Promise.reject(new Error('Panel unavailable.')));
  vi.stubGlobal('chrome', { windows: { getCurrent: (callback: typeof onWindow) => { onWindow = callback; } }, sidePanel: { open } });
  setup();
  const button = screen.getByRole('button', { name: 'Open side panel' });
  expect(button).toBeDisabled();
  act(() => onWindow({ id: 7 }));
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(open).toHaveBeenCalledWith({ windowId: 7 });
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Panel unavailable.'));
});

describe('segmented radio keyboard', () => {
  it('has one tab stop and selects with all arrow keys, wrapping both ways', () => {
    function Control() {
      const [value, setValue] = useState('a');
      return <SegmentedControl ariaLabel="Choice" value={value} onChange={setValue} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]} />;
    }
    render(<Control />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);
    for (const [key, index] of [['ArrowLeft', 2], ['ArrowUp', 1], ['ArrowRight', 2], ['ArrowDown', 0]] as const) {
      const checked = screen.getByRole('radio', { checked: true });
      fireEvent.keyDown(checked, { key });
      expect(radios[index]).toHaveFocus();
      expect(radios[index]).toHaveAttribute('aria-checked', 'true');
      expect(radios.filter((radio) => radio.tabIndex === 0)).toHaveLength(1);
    }
  });
});


it.each(['Start blank', 'Start with an example'])('locks earlier onboarding steps after committing %s', async (choice) => {
  const actions = setup({ onboardingComplete: false });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  // Earlier steps remain available before committing a starter choice.
  const intro = screen.getByRole('button', { name: 'Step 1: How it works' });
  expect(intro).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: new RegExp(choice) }));
  await screen.findByText('Add a weekly activity');
  const starter = screen.getByRole('button', { name: 'Step 2: Choose start' });
  expect(intro).toBeDisabled();
  expect(starter).toBeDisabled();
  fireEvent.click(starter);
  fireEvent.click(intro);
  expect(screen.getByText('Add a weekly activity')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Back/ })).toBeNull();
  expect(actions.completeOnboarding).toHaveBeenCalledTimes(1);
});

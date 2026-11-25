import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { computeWeeklyReport, computeWeeklyTrend, generateLogHeatmap, generateWeeklySuggestions, getWeekBounds } from '@hubris/core';
import { HubrisContext, type HubrisState } from '../../state/useHubris';
import { ValidationError } from '../../storage/validation';
import { App } from '../App';
import { SegmentedControl } from '../components/21st/segmented-control';
import { CATEGORIES } from '../lib/categories';
import { TrendsScreen } from '../screens/TrendsScreen';

const now = new Date(2026, 10, 18, 12);
const activity = { id: 'a', name: 'Practice', category: 'career', timesPerWeek: 3, importance: 'high', archived: false, createdAt: now.toISOString(), updatedAt: now.toISOString() } satisfies HubrisState['activities'][number];
const log = { id: 'l', activityId: 'a', loggedAt: now.toISOString() };
function makeState(overrides: Partial<HubrisState> = {}, actionOverrides: Partial<HubrisState['actions']> = {}) {
  const actions: HubrisState['actions'] = {
    createActivity: vi.fn(async () => activity), updateActivity: vi.fn(async () => activity),
    setArchived: vi.fn(async () => activity), deleteActivity: vi.fn(async () => {}),
    logActivity: vi.fn(async () => ({ log, importGeneration: 0 })), undoLog: vi.fn(async () => {}), deleteLog: vi.fn(async () => {}),
    exportBackup: vi.fn(async () => {}), importBackup: vi.fn(async () => ({ activities: 1, logs: 1 })),
    eraseAll: vi.fn(async () => {}), completeOnboarding: vi.fn(async () => {}), retry: vi.fn(async () => {}),
    ...actionOverrides,
  };
  const state: HubrisState = {
    status: 'ready', error: null, now, activities: [activity], logs: [log], onboardingComplete: true,
    report: computeWeeklyReport([activity], [log], now), trend: computeWeeklyTrend([activity], [log], now),
    suggestions: [], heatmap: generateLogHeatmap([log], 84, getWeekBounds(now).end), actions, ...overrides,
  };
  return { actions, state };
}
function setup(
  overrides: Partial<HubrisState> = {},
  actionOverrides: Partial<HubrisState['actions']> = {},
  surface: 'popup' | 'sidepanel' = 'popup',
) {
  const { actions, state } = makeState(overrides, actionOverrides);
  render(<HubrisContext.Provider value={state}><App surface={surface} /></HubrisContext.Provider>);
  return actions;
}
const failure = () => Promise.reject(new ValidationError('Storage is full.'));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

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
  expect(screen.queryByRole('button', { name: /^Undo/ })).toBeNull();
});

it('keeps the pending Today screen mounted across the side-panel breakpoint', () => {
  vi.stubGlobal('innerWidth', 639);
  const logActivity = vi.fn<HubrisState['actions']['logActivity']>(() => new Promise(() => {}));
  setup({}, { logActivity }, 'sidepanel');
  const logButton = screen.getByRole('button', { name: /Log Practice/ });
  fireEvent.click(logButton);
  expect(logButton).toBeDisabled();

  vi.stubGlobal('innerWidth', 640);
  fireEvent(window, new Event('resize'));

  expect(screen.getByRole('button', { name: /Log Practice/ })).toBe(logButton);
  expect(logButton).toBeDisabled();
  fireEvent.click(logButton);
  expect(logActivity).toHaveBeenCalledTimes(1);
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
  fireEvent.click(await screen.findByRole('button', { name: 'Undo Practice' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Could not undo. The log is still there.'));
  expect(screen.queryByRole('button', { name: /^Undo/ })).toBeNull();
});

it('keeps a newer log Undo available when an older Undo fails', async () => {
  let rejectUndo: (reason: unknown) => void = () => {};
  const undoLog = vi.fn<HubrisState['actions']['undoLog']>(() => new Promise((_, reject) => {
    rejectUndo = reject;
  }));
  const reading = { ...activity, id: 'b', name: 'Reading' };
  const practiceUndo = { log: { ...log, id: 'practice-log' }, importGeneration: 0 };
  const readingUndo = { log: { ...log, id: 'reading-log', activityId: reading.id }, importGeneration: 0 };
  const logActivity = vi.fn<HubrisState['actions']['logActivity']>()
    .mockResolvedValueOnce(practiceUndo)
    .mockResolvedValueOnce(readingUndo);
  setup(
    {
      activities: [activity, reading],
      report: computeWeeklyReport([activity, reading], [log], now),
    },
    { logActivity, undoLog },
  );

  fireEvent.click(screen.getByRole('button', { name: /Log Practice/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Undo Practice' }));
  fireEvent.click(screen.getByRole('button', { name: /Log Reading/ }));
  await screen.findByRole('button', { name: 'Undo Reading' });

  rejectUndo(new ValidationError('Storage is full.'));

  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Could not undo. The log is still there.'));
  expect(screen.getByRole('button', { name: 'Undo Reading' })).toBeTruthy();
});

it('keeps each recent log independently undoable', async () => {
  vi.useFakeTimers();
  const reading = { ...activity, id: 'b', name: 'Reading' };
  const practiceUndo = { log: { ...log, id: 'practice-log' }, importGeneration: 0 };
  const readingUndo = { log: { ...log, id: 'reading-log', activityId: reading.id }, importGeneration: 0 };
  const logActivity = vi.fn<HubrisState['actions']['logActivity']>()
    .mockResolvedValueOnce(practiceUndo)
    .mockResolvedValueOnce(readingUndo);
  const actions = setup(
    {
      activities: [activity, reading],
      report: computeWeeklyReport([activity, reading], [log], now),
    },
    { logActivity },
  );

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Log Practice/ }));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Log Reading/ }));
  });

  fireEvent.click(screen.getByRole('button', { name: 'Undo Reading' }));
  expect(actions.undoLog).toHaveBeenCalledWith(readingUndo);
  expect(screen.getByRole('button', { name: 'Undo Practice' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Undo Practice' }));
  expect(actions.undoLog).toHaveBeenCalledWith(practiceUndo);
});

it('expires each recent log on its own timer', async () => {
  vi.useFakeTimers();
  const reading = { ...activity, id: 'b', name: 'Reading' };
  const logActivity = vi.fn<HubrisState['actions']['logActivity']>()
    .mockResolvedValueOnce({ log: { ...log, id: 'practice-log' }, importGeneration: 0 })
    .mockResolvedValueOnce({ log: { ...log, id: 'reading-log', activityId: reading.id }, importGeneration: 0 });
  setup(
    {
      activities: [activity, reading],
      report: computeWeeklyReport([activity, reading], [log], now),
    },
    { logActivity },
  );

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Log Practice/ }));
  });
  act(() => vi.advanceTimersByTime(2000));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Log Reading/ }));
  });
  act(() => vi.advanceTimersByTime(4000));

  expect(screen.queryByRole('button', { name: 'Undo Practice' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Undo Reading' })).toBeTruthy();
});

it('keeps every recent log undoable when more than three logs are added', async () => {
  vi.useFakeTimers();
  const activities = ['Alpha', 'Beta', 'Gamma', 'Delta'].map((name, index) => ({
    ...activity,
    id: String(index),
    name,
  }));
  const logActivity = vi.fn<HubrisState['actions']['logActivity']>();
  activities.forEach((item, index) => {
    logActivity.mockResolvedValueOnce({ log: { ...log, id: `log-${index}`, activityId: item.id }, importGeneration: 0 });
  });
  setup(
    {
      activities,
      report: computeWeeklyReport(activities, [], now),
    },
    { logActivity },
  );

  for (const item of activities) {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`Log ${item.name}`) }));
    });
  }

  for (const name of ['Alpha', 'Beta', 'Gamma', 'Delta']) {
    expect(screen.getByRole('button', { name: `Undo ${name}` })).toBeTruthy();
  }
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

it('does not close a newer edit dialog when an older save completes', async () => {
  let resolveUpdate: (value: HubrisState['activities'][number]) => void = () => {};
  const updateActivity = vi.fn<HubrisState['actions']['updateActivity']>(() => new Promise((resolve) => {
    resolveUpdate = resolve;
  }));
  const reading = { ...activity, id: 'b', name: 'Reading' };
  setup({ activities: [activity, reading] }, { updateActivity });
  fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit Practice' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  fireEvent.click(screen.getByRole('button', { name: 'Edit Reading' }));
  expect(screen.getByLabelText('Activity name')).toHaveValue('Reading');
  resolveUpdate(activity);

  await waitFor(() => expect(updateActivity).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('dialog', { name: 'Edit activity' })).toBeTruthy();
  expect(screen.getByLabelText('Activity name')).toHaveValue('Reading');
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

it('gives the heatmap one tab stop and moves focus between days with arrow keys', () => {
  setup();
  fireEvent.click(screen.getByRole('tab', { name: 'Trends' }));
  const heatmap = screen.getByRole('group', { name: '12-week activity heatmap, Monday to Sunday' });
  const cells = within(heatmap).getAllByRole('button');
  expect(cells.filter((cell) => cell.tabIndex === 0)).toHaveLength(1);

  const previousWednesday = within(heatmap).getByRole('button', { name: 'Wed, Nov 11: 0 logs' });
  previousWednesday.focus();
  fireEvent.keyDown(previousWednesday, { key: 'ArrowRight' });

  expect(within(heatmap).getByRole('button', { name: 'Wed, Nov 18: 1 log' })).toHaveFocus();
  expect(cells.filter((cell) => cell.tabIndex === 0)).toHaveLength(1);
});

it('reads the active heatmap day from the latest heatmap data', () => {
  function HeatmapHarness() {
    const [heatmap, setHeatmap] = useState(() => generateLogHeatmap([log], 84, getWeekBounds(now).end));
    const { state } = makeState({ heatmap });
    return (
      <>
        <button
          onClick={() => setHeatmap((current) => current.map((cell) =>
            cell.date === '2026-11-18' ? { ...cell, logCount: 2, intensity: 2 } : cell
          ))}
        >
          Update heatmap
        </button>
        <button onClick={() => setHeatmap((current) => current.filter((cell) => cell.date !== '2026-11-18'))}>
          Remove active day
        </button>
        <HubrisContext.Provider value={state}><TrendsScreen /></HubrisContext.Provider>
      </>
    );
  }

  render(<HeatmapHarness />);
  fireEvent.focus(screen.getByRole('button', { name: 'Wed, Nov 18: 1 log' }));
  expect(screen.getByText('Wed, Nov 18: 1 log')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Update heatmap' }));
  expect(screen.getByText('Wed, Nov 18: 2 logs')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Remove active day' }));
  expect(screen.getByText('Hover or focus a day')).toBeTruthy();
});

it('uses category metadata weights for trend bar contributions', () => {
  const career = CATEGORIES.find((category) => category.id === 'career');
  if (!career) throw new Error('Missing Career category metadata');
  const originalWeight = career.weight;
  Object.defineProperty(career, 'weight', { configurable: true, value: 0.5 });
  try {
    setup();
    fireEvent.click(screen.getByRole('tab', { name: 'Trends' }));
    expect(screen.getByRole('img', { name: /Career contribution 17/ })).toBeTruthy();
  } finally {
    Object.defineProperty(career, 'weight', { configurable: true, value: originalWeight });
  }
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

it('locks import controls while running and keeps a failed file for retry', async () => {
  let rejectImport: (reason: unknown) => void = () => {};
  const importBackup = vi.fn<HubrisState['actions']['importBackup']>(() => new Promise((_, reject) => {
    rejectImport = reject;
  }));
  setup({}, { importBackup });
  fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
  const input = screen.getByLabelText('Import backup file');
  fireEvent.change(input, { target: { files: [new File(['{}'], 'first.json')] } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }));

  expect(input).toBeDisabled();
  expect(screen.getByRole('radio', { name: 'Replace' })).toBeDisabled();
  expect(screen.getByRole('radio', { name: 'Merge' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

  rejectImport(new ValidationError('Invalid backup.'));

  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid backup.');
  expect(input).toBeEnabled();
  expect(screen.getAllByText('first.json')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Confirm import' })).toBeEnabled();
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

it('explains that Merge keeps deletions from either side only in Merge import confirmation', () => {
  setup();
  fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
  const copy = 'Merge adds what is missing here and keeps deletions made on either side.';
  fireEvent.click(screen.getByRole('radio', { name: 'Merge' }));
  expect(screen.queryByText(copy)).toBeNull();
  fireEvent.change(screen.getByLabelText('Import backup file'), { target: { files: [new File(['{}'], 'backup.json')] } });
  expect(screen.getByText(copy)).toBeTruthy();
  fireEvent.click(screen.getByRole('radio', { name: 'Replace' }));
  expect(screen.queryByText(copy)).toBeNull();
});

it('returns focus to the enabled file input after a successful import', async () => {
  setup();
  fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
  const input = screen.getByLabelText('Import backup file');
  fireEvent.change(input, { target: { files: [new File(['{}'], 'backup.json')] } });
  const confirm = screen.getByRole('button', { name: 'Confirm import' });
  confirm.focus();
  fireEvent.click(confirm);

  await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirm import' })).toBeNull());
  expect(input).toBeEnabled();
  await waitFor(() => expect(document.activeElement).toBe(input));
});

it('does not close a reopened edit dialog for the same activity when an older save completes', async () => {
  let resolveUpdate: (value: HubrisState['activities'][number]) => void = () => {};
  const updateActivity = vi.fn<HubrisState['actions']['updateActivity']>(() => new Promise((resolve) => {
    resolveUpdate = resolve;
  }));
  setup({}, { updateActivity });
  fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit Practice' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  fireEvent.click(screen.getByRole('button', { name: 'Edit Practice' }));
  fireEvent.change(screen.getByLabelText('Activity name'), { target: { value: 'Practice draft' } });
  await act(async () => { resolveUpdate(activity); });

  expect(screen.getByRole('dialog', { name: 'Edit activity' })).toBeTruthy();
  expect(screen.getByLabelText('Activity name')).toHaveValue('Practice draft');
});

it('suggests an activity that is active now even when a later version archives it', () => {
  const versions = [
    { from: '2026-11-01T00:00:00.000Z', category: 'health' as const, timesPerWeek: 7, importance: 'high' as const, archived: false },
    { from: '2026-12-01T00:00:00.000Z', category: 'health' as const, timesPerWeek: 7, importance: 'high' as const, archived: true },
  ];
  const meditation = { ...activity, id: 'm', name: 'Meditation', category: 'health' as const, timesPerWeek: 7, archived: true, versions };
  setup({
    activities: [meditation],
    logs: [],
    report: computeWeeklyReport([meditation], [], now),
    suggestions: generateWeeklySuggestions([meditation], [], now),
  });
  const region = screen.getByRole('region', { name: 'Worth doing next' });
  expect(within(region).getByRole('button', { name: 'Log Meditation' })).toBeTruthy();
});

it('returns keyboard focus to the open tab panel when the last toast is undone', async () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: /Log Practice/ }));
  const undo = await screen.findByRole('button', { name: 'Undo Practice' });
  undo.focus();
  fireEvent.click(undo);
  expect(document.activeElement).toBe(screen.getByRole('tabpanel', { name: 'Today' }));
});

it.each(['Today', 'Settings'])('does not close a newer add dialog on %s when an older save completes', async (tab) => {
  let resolveCreate: (value: HubrisState['activities'][number]) => void = () => {};
  const createActivity = vi.fn<HubrisState['actions']['createActivity']>(() => new Promise((resolve) => {
    resolveCreate = resolve;
  }));
  setup({}, { createActivity });
  fireEvent.click(screen.getByRole('tab', { name: tab }));
  fireEvent.click(screen.getByRole('button', { name: /Add activity/ }));
  fireEvent.change(screen.getByLabelText('Activity name'), { target: { value: 'First draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save activity' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  fireEvent.click(screen.getByRole('button', { name: /Add activity/ }));
  fireEvent.change(screen.getByLabelText('Activity name'), { target: { value: 'Second draft' } });
  resolveCreate(activity);

  await waitFor(() => expect(createActivity).toHaveBeenCalledTimes(1));
  await act(async () => {});
  expect(screen.getByRole('dialog', { name: 'Add activity' })).toBeTruthy();
  expect(screen.getByLabelText('Activity name')).toHaveValue('Second draft');
});

/**
 * Focus rule after a keyboard user dismisses the last toast: the active tab panel when the tabs
 * show, otherwise the main region of the current view (onboarding, loading or error).
 */
it.each<[string, Partial<HubrisState>, () => HTMLElement]>([
  ['tabs', {}, () => screen.getByRole('tabpanel', { name: 'Today' })],
  ['onboarding', { onboardingComplete: false }, () => screen.getByRole('main')],
  ['loading', { status: 'loading' }, () => screen.getByRole('main')],
  ['error', { status: 'error', error: 'Could not read local data.' }, () => screen.getByRole('main')],
])('moves focus to the %s view when its last toast is dismissed', async (_view, overrides, target) => {
  const open = vi.fn(() => Promise.reject(new Error('Panel unavailable.')));
  vi.stubGlobal('chrome', { windows: { getCurrent: (callback: (win: { id: number }) => void) => callback({ id: 7 }) }, sidePanel: { open } });
  setup(overrides);
  fireEvent.click(screen.getByRole('button', { name: 'Open side panel' }));
  const dismiss = await screen.findByRole('button', { name: 'Dismiss Panel unavailable.' });
  dismiss.focus();
  fireEvent.click(dismiss);
  expect(document.activeElement).toBe(target());
});

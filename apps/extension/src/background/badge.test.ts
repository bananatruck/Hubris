import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getBadgeState, getNextMondayTime } from './badge';
import { addLog, createActivity, eraseAll } from '../storage/repository';

afterEach(() => { vi.unstubAllGlobals(); });
describe('getNextMondayTime', () => {
  const originalTimezone = process.env.TZ;
  beforeAll(() => { process.env.TZ = 'America/New_York'; });
  afterAll(() => {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  });

  it.each([
    ['the Wednesday before spring-forward', [2026, 2, 4, 12], [2026, 2, 9, 0]],
    ['a Monday at midnight', [2026, 2, 9, 0], [2026, 2, 16, 0]],
  ] as const)('returns the next local Monday midnight from %s', (_label, referenceParts, expectedParts) => {
    const reference = new Date(referenceParts[0], referenceParts[1], referenceParts[2], referenceParts[3]);
    const expected = new Date(expectedParts[0], expectedParts[1], expectedParts[2], expectedParts[3]);
    const original = reference.getTime();
    expect(getNextMondayTime(reference)).toBe(expected.getTime());
    expect(reference.getTime()).toBe(original);
  });
});

it.each([
  [80, 'On track'], [79.9, 'On track'], [50, 'Catching up'], [49.9, 'Catching up'],
])('formats score %s and threshold status', (score, status) => {
  expect(getBadgeState(score, true)).toEqual({
    text: String(Math.round(score)),
    title: `Hubris - this week: ${Math.round(score)} (${status})`,
    color: '#7c3aed',
  });
});
it('derives status from the rounded score', () => {
  expect(getBadgeState(79.6, true)).toMatchObject({ text: '80', title: expect.stringMatching(/On track/) });
  expect(getBadgeState(49.4, true).title).toMatch(/Needs love/);
});
it('clears the badge when all activities are archived or absent', () => {
  expect(getBadgeState(0, false).text).toBe('');
});

it('registers worker events and updates the real report through Chrome action APIs', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 18, 12));
  try {
    await eraseAll();
    const activity = await createActivity({ name: 'Practice', category: 'career', timesPerWeek: 1, importance: 'high' });
    await addLog(activity.id);
    const chromeMock = {
      action: { setBadgeText: vi.fn().mockResolvedValue(undefined), setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined), setTitle: vi.fn().mockResolvedValue(undefined) },
      alarms: {
        get: vi.fn().mockResolvedValue(undefined),
        create: vi.fn().mockResolvedValue(undefined),
        onAlarm: { addListener: vi.fn() },
      },
      runtime: { onInstalled: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() }, onMessage: { addListener: vi.fn() } },
    };
    vi.stubGlobal('chrome', chromeMock);
    const { refreshBadge } = await import('./index');
    await refreshBadge();
    expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: '36' });
    expect(chromeMock.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#7c3aed' });
    expect(chromeMock.action.setTitle).toHaveBeenCalledWith({ title: 'Hubris - this week: 36 (Needs love)' });
    expect(chromeMock.alarms.get).toHaveBeenCalledWith('hubris/refresh-badge');
    expect(chromeMock.alarms.create).toHaveBeenCalledWith('hubris/refresh-badge', { periodInMinutes: 15 });
    expect(chromeMock.alarms.create).toHaveBeenCalledWith('hubris/refresh-badge-monday', {
      when: new Date(2026, 10, 23).getTime(),
    });
    const startupInit = chromeMock.runtime.onStartup.addListener.mock.calls[0]?.[0] as () => void;
    chromeMock.alarms.get.mockResolvedValue({ name: 'hubris/refresh-badge' });
    chromeMock.alarms.create.mockClear();
    // Let the import-time start() and the explicit refreshBadge() above both finish first.
    await vi.waitFor(() => expect(chromeMock.action.setBadgeText).toHaveBeenCalledTimes(2));
    const badgeUpdatesBefore = 2;
    startupInit();
    // refresh() runs after the alarm check, so one more badge update proves the check finished.
    await vi.waitFor(() => expect(chromeMock.action.setBadgeText).toHaveBeenCalledTimes(badgeUpdatesBefore + 1));
    expect(chromeMock.alarms.create).toHaveBeenCalledOnce();
    expect(chromeMock.alarms.create).toHaveBeenCalledWith('hubris/refresh-badge-monday', {
      when: new Date(2026, 10, 23).getTime(),
    });
    const alarmListener = chromeMock.alarms.onAlarm.addListener.mock.calls[0]?.[0] as
      (alarm: { name: string }) => void;
    chromeMock.alarms.create.mockClear();
    alarmListener({ name: 'hubris/refresh-badge-monday' });
    await vi.waitFor(() => expect(chromeMock.action.setBadgeText).toHaveBeenCalledTimes(badgeUpdatesBefore + 2));
    expect(chromeMock.alarms.create).toHaveBeenCalledWith('hubris/refresh-badge-monday', {
      when: new Date(2026, 10, 23).getTime(),
    });
    expect(chromeMock.runtime.onInstalled.addListener).toHaveBeenCalledOnce();
    expect(chromeMock.runtime.onStartup.addListener).toHaveBeenCalledOnce();
    expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledOnce();
    expect(chromeMock.alarms.onAlarm.addListener).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});

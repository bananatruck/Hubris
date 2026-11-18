import { afterEach, expect, it, vi } from 'vitest';
import { getBadgeState } from './badge';
import { addLog, createActivity, eraseAll } from '../storage/repository';

afterEach(() => { vi.unstubAllGlobals(); });
it.each([
  [80, 'On track'], [79.9, 'Catching up'], [50, 'Catching up'], [49.9, 'Needs love'],
])('formats score %s and threshold status', (score, status) => {
  expect(getBadgeState(score, true)).toEqual({
    text: String(Math.round(score)),
    title: `Hubris - this week: ${Math.round(score)} (${status})`,
    color: '#7c3aed',
  });
});
it('clears the badge when all activities are archived or absent', () => {
  expect(getBadgeState(0, false).text).toBe('');
});

it('registers worker events and updates the real report through Chrome action APIs', async () => {
  await eraseAll();
  const activity = await createActivity({ name: 'Practice', category: 'career', timesPerWeek: 1, importance: 'high' });
  await addLog(activity.id);
  const chromeMock = {
    action: { setBadgeText: vi.fn().mockResolvedValue(undefined), setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined), setTitle: vi.fn().mockResolvedValue(undefined) },
    alarms: { create: vi.fn().mockResolvedValue(undefined), onAlarm: { addListener: vi.fn() } },
    runtime: { onInstalled: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() }, onMessage: { addListener: vi.fn() } },
  };
  vi.stubGlobal('chrome', chromeMock);
  const { refreshBadge } = await import('./index');
  await refreshBadge();
  expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: '36' });
  expect(chromeMock.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#7c3aed' });
  expect(chromeMock.action.setTitle).toHaveBeenCalledWith({ title: 'Hubris - this week: 36 (Needs love)' });
  expect(chromeMock.alarms.create).toHaveBeenCalledWith('hubris/refresh-badge', { periodInMinutes: 15 });
  expect(chromeMock.runtime.onInstalled.addListener).toHaveBeenCalledOnce();
  expect(chromeMock.runtime.onStartup.addListener).toHaveBeenCalledOnce();
  expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledOnce();
  expect(chromeMock.alarms.onAlarm.addListener).toHaveBeenCalledOnce();
});

import { computeWeeklyReport } from '@hubris/core';
import { readSnapshot } from '../storage/repository';
import { isDataChangedMessage } from '../shared/messages';
import { getBadgeState, getNextMondayTime } from './badge';

const ALARM_NAME = 'hubris/refresh-badge';
const MONDAY_ALARM_NAME = 'hubris/refresh-badge-monday';

export async function refreshBadge() {
  const { activities, logs } = await readSnapshot();
  const report = computeWeeklyReport(activities, logs, new Date());
  const badge = getBadgeState(report.overall, activities.some((activity) => !activity.archived));
  await Promise.all([
    chrome.action.setBadgeText({ text: badge.text }),
    chrome.action.setBadgeBackgroundColor({ color: badge.color }),
    chrome.action.setTitle({ title: badge.title }),
  ]);
}

function refresh() {
  void refreshBadge().catch(() => {
    // The next alarm retries when storage is available again.
  });
}
async function scheduleMondayAlarm() {
  await chrome.alarms.create(MONDAY_ALARM_NAME, { when: getNextMondayTime() });
}
async function initialize() {
  try {
    // Re-creating an existing alarm would restart its period on every worker wake.
    if (await chrome.alarms.get(ALARM_NAME) === undefined) {
      await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 15 });
    }
    await scheduleMondayAlarm();
  } finally {
    refresh();
  }
}
function start() {
  void initialize().catch(() => {
    // The badge still refreshes on the next data change.
  });
}
chrome.runtime.onInstalled.addListener(start);
chrome.runtime.onStartup.addListener(start);
chrome.runtime.onMessage.addListener((message: unknown) => {
  if (isDataChangedMessage(message)) refresh();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) refresh();
  if (alarm.name === MONDAY_ALARM_NAME) {
    void scheduleMondayAlarm().catch(() => {
      // Startup and the fallback alarm will retry scheduling.
    });
    refresh();
  }
});
start();

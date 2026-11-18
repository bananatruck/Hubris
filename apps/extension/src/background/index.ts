import { computeWeeklyReport } from '@hubris/core';
import { readSnapshot } from '../storage/repository';
import { isDataChangedMessage } from '../shared/messages';
import { getBadgeState } from './badge';

const ALARM_NAME = 'hubris/refresh-badge';

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
async function initialize() {
  try {
    // Re-creating an existing alarm would restart its period on every worker wake.
    if (await chrome.alarms.get(ALARM_NAME) === undefined) {
      await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 15 });
    }
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
});
start();

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
function initialize() {
  void chrome.alarms.create(ALARM_NAME, { periodInMinutes: 15 });
  refresh();
}
chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);
chrome.runtime.onMessage.addListener((message: unknown) => {
  if (isDataChangedMessage(message)) refresh();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) refresh();
});
initialize();

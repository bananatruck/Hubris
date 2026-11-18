import { getStatusDisplayLabel, getStatusLabel } from '@hubris/core';

export function getNextMondayTime(referenceDate: Date = new Date()) {
  const nextMonday = new Date(referenceDate);
  const daysUntilMonday = (8 - nextMonday.getDay()) % 7 || 7;
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday.getTime();
}

export function getBadgeState(score: number, hasActiveActivities: boolean) {
  const rounded = Math.round(score);
  const display = getStatusDisplayLabel(getStatusLabel(rounded));
  // Sentence case, matching the status word in the popup and side panel.
  const status = display.charAt(0) + display.slice(1).toLowerCase();
  return {
    text: hasActiveActivities ? String(rounded) : '',
    title: `Hubris - this week: ${rounded} (${status})`,
    color: '#7c3aed',
  };
}

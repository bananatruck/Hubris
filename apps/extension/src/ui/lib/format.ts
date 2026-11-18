import { formatDateKey, getStatusDisplayLabel, getStatusLabel } from '@hubris/core';
import type { StatusLabel } from '@hubris/types';

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Compute status label and sentence-case display word from the ROUNDED score
 * so the displayed integer and status word never disagree.
 */
export function getRoundedStatus(score: number): {
  rounded: number;
  status: StatusLabel;
  word: string;
} {
  const rounded = Math.round(score);
  const status = getStatusLabel(rounded);
  const display = getStatusDisplayLabel(status);
  const word = display.charAt(0).toUpperCase() + display.slice(1).toLowerCase();
  return { rounded, status, word };
}

/**
 * Formats Monday-to-Sunday bounds like "Nov 16 - 22" or "Nov 30 - Dec 6".
 */
export function formatWeekRange(weekStartIso: string, weekEndIso: string): string {
  const start = new Date(weekStartIso);
  const end = new Date(weekEndIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return '';
  }
  const startMonth = SHORT_MONTHS[start.getMonth()] ?? '';
  const endMonth = SHORT_MONTHS[end.getMonth()] ?? '';
  const startDay = start.getDate();
  const endDay = end.getDate();
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

/**
 * Formats a YYYY-MM-DD key or Date into a readable local date label like "Tue, Nov 17".
 */
export function formatDayHeading(dateKey: string, now: Date = new Date()): string {
  const todayKey = formatDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);

  const [yearStr, monthStr, dayStr] = dateKey.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const day = Number(dayStr);
  const date = new Date(year, monthIndex, day);
  const monthName = SHORT_MONTHS[monthIndex] ?? '';
  const weekdayName = SHORT_WEEKDAYS[date.getDay()] ?? '';

  if (dateKey === todayKey) {
    return `Today, ${monthName} ${day}`;
  }
  if (dateKey === yesterdayKey) {
    return `Yesterday, ${monthName} ${day}`;
  }
  if (year !== now.getFullYear()) {
    return `${weekdayName}, ${monthName} ${day}, ${year}`;
  }
  return `${weekdayName}, ${monthName} ${day}`;
}

/**
 * Formats an ISO timestamp as a short local time like "2:15 PM".
 */
export function formatLogTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Formats a YYYY-MM-DD date string for heatmap tooltips like "Mon, Nov 16".
 */
export function formatHeatmapDate(dateKey: string): string {
  const [yearStr, monthStr, dayStr] = dateKey.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const day = Number(dayStr);
  const date = new Date(year, monthIndex, day);
  const weekday = SHORT_WEEKDAYS[date.getDay()] ?? '';
  const month = SHORT_MONTHS[monthIndex] ?? '';
  return `${weekday}, ${month} ${day}`;
}

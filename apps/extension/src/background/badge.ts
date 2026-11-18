import { getStatusDisplayLabel, getStatusLabel } from '@hubris/core';

export function getBadgeState(score: number, hasActiveActivities: boolean) {
  const rounded = Math.round(score);
  const status = getStatusDisplayLabel(getStatusLabel(rounded));
  return {
    text: hasActiveActivities ? String(rounded) : '',
    title: `Hubris - this week: ${rounded} (${status})`,
    color: '#7c3aed',
  };
}

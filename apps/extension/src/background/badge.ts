export function getBadgeState(score: number, hasActiveActivities: boolean) {
  const rounded = Math.round(score);
  const status = score >= 80 ? 'On track' : score >= 50 ? 'Catching up' : 'Needs love';
  return {
    text: hasActiveActivities ? String(rounded) : '',
    title: `Hubris - this week: ${rounded} (${status})`,
    color: '#7c3aed',
  };
}

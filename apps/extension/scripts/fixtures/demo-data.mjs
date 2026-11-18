const examples = [
  ['leetcode', 'Leetcode', 'career', 5, 'high', 3],
  ['classes', 'Classes', 'career', 4, 'medium', 2],
  ['gym', 'Gym', 'health', 3, 'high', 3],
  ['sleep', 'Sleep by 11pm', 'health', 7, 'medium', 7],
  ['stretching', 'Stretching', 'health', 2, 'low', 1],
  ['guitar', 'Guitar', 'hobbies-habits', 3, 'medium', 1],
  ['reading', 'Reading', 'hobbies-habits', 4, 'low', 4],
];

// Calendar arithmetic preserves local week boundaries across daylight-saving changes.
function dayAt(start, offset, hour = 0) {
  const date = new Date(start);
  date.setDate(date.getDate() + offset);
  date.setHours(hour, 0, 0, 0);
  return date;
}

export function demoData(now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new TypeError('demoData requires a valid Date');
  }
  const elapsedDays = (now.getDay() + 6) % 7;
  const monday = dayAt(now, -elapsedDays);
  const createdAt = dayAt(monday, -49).toISOString();
  const activities = examples.map(([slug, name, category, timesPerWeek, importance]) => ({
    id: `demo-${slug}`, name, category, timesPerWeek, importance,
    archived: false, createdAt, updatedAt: createdAt,
  }));
  const logs = [];
  for (let week = 0; week < 8; week += 1) {
    const start = dayAt(monday, -7 * week);
    const weekKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    examples.forEach(([, , , goal, , currentCount], activityIndex) => {
      const activity = activities[activityIndex];
      const count = week === 0 ? currentCount : (week * 3 + activityIndex * 2) % (goal + 2);
      const days = week === 0 ? elapsedDays + 1 : 7;
      for (let entry = 0; entry < count; entry += 1) {
        const offset = Math.floor(entry * days / count);
        const candidate = dayAt(start, offset, 9 + (entry + activityIndex) % 12);
        // On the current day, distribute early-week entries between midnight and now.
        const loggedAt = week === 0 && offset === elapsedDays
          ? new Date(dayAt(now, 0).getTime() + Math.floor((now.getTime() - dayAt(now, 0).getTime()) * (entry + 1) / (count + 1)))
          : candidate;
        logs.push({
          id: `${activity.id}-${weekKey}-${entry + 1}`,
          activityId: activity.id,
          loggedAt: loggedAt.toISOString(),
        });
      }
    });
  }
  return { activities, logs };
}

import { formatDateKey } from '@hubris/core';
import { useState } from 'react';
import type { DayHeatmapCell } from '@hubris/types';
import { useHubris } from '../../state/useHubris';
import { CATEGORIES } from '../lib/categories';
import { formatHeatmapDate, formatWeekRange } from '../lib/format';
import { GlowingEffectCard } from '../components/aceternity/glowing-effect';
import { CountUp } from '../components/reactbits/count-up';
import { SpotlightCard } from '../components/reactbits/spotlight-card';

const HEATMAP_WEEKDAYS = [
  { dayIndex: 1, short: 'M', full: 'Monday' },
  { dayIndex: 2, short: 'T', full: 'Tuesday' },
  { dayIndex: 3, short: 'W', full: 'Wednesday' },
  { dayIndex: 4, short: 'T', full: 'Thursday' },
  { dayIndex: 5, short: 'F', full: 'Friday' },
  { dayIndex: 6, short: 'S', full: 'Saturday' },
  { dayIndex: 0, short: 'S', full: 'Sunday' },
] as const;

const INTENSITY_STYLES: Readonly<Record<DayHeatmapCell['intensity'], string>> = {
  0: 'bg-raised border-line',
  1: 'bg-[#4c1d95] border-[#6d28d9]/60',
  2: 'bg-[#6d28d9] border-[#8b5cf6]/60',
  3: 'bg-[#8b5cf6] border-[#a78bfa]/70',
  4: 'bg-[#c4b5fd] border-[#ddd6fe]',
};

function parseLocalWeekday(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1).getDay();
}

export function TrendsScreen() {
  const { logs, report, trend, heatmap, now } = useHubris();
  const [activeCell, setActiveCell] = useState<DayHeatmapCell | null>(null);

  const currentWeekPoint = trend[trend.length - 1];
  const previousWeekPoint = trend.length >= 2 ? trend[trend.length - 2] : undefined;

  const allActivities = CATEGORIES.flatMap((cat) => report.categories[cat.id].activities);
  const totalGoalUnits = allActivities.reduce((sum, a) => sum + a.goal, 0);
  const totalDoneUnits = allActivities.reduce((sum, a) => sum + Math.min(a.done, a.goal), 0);

  return (
    <div className="space-y-4">
      {logs.length === 0 && (
        <SpotlightCard className="p-4 text-center space-y-1.5" data-testid="trends-empty-state">
          <h2 className="font-display text-sm font-semibold text-text">
            No logs recorded yet
          </h2>
          <p className="text-xs text-muted">
            Log an activity on Today to see your 8-week score trend and 12-week consistency heatmap fill in.
          </p>
        </SpotlightCard>
      )}

      <section aria-label="Category deltas versus last week" className="grid grid-cols-3 gap-2">
        {CATEGORIES.map((cat) => {
          const currScore = currentWeekPoint?.categories[cat.id] ?? null;
          const prevScore = previousWeekPoint?.categories[cat.id] ?? null;
          const currRounded = currScore === null ? null : Math.round(currScore);
          const prevRounded = prevScore === null ? null : Math.round(prevScore);
          const delta =
            currRounded !== null && prevRounded !== null ? currRounded - prevRounded : null;

          const deltaLabel =
            delta === null
              ? 'No baseline'
              : delta > 0
                ? `+${delta} vs last wk`
                : delta < 0
                  ? `${delta} vs last wk`
                  : '0 vs last wk';

          return (
            <GlowingEffectCard
              key={cat.id}
              glowColor={`${cat.color}22`}
              className="p-2.5 space-y-1"
            >
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-xs font-medium text-text truncate">
                  {cat.label}
                </span>
              </div>
              <div className="font-display text-lg font-bold text-text">
                {currRounded === null ? '-' : <CountUp value={currRounded} />}
              </div>
              <p className="text-[11px] text-muted tabular-nums truncate">
                {deltaLabel}
              </p>
            </GlowingEffectCard>
          );
        })}
      </section>

      <SpotlightCard className="p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-text">
            Weekly score trend
          </h2>
          <div className="flex items-center gap-2.5 text-[11px] text-muted">
            {CATEGORIES.map((cat) => (
              <span key={cat.id} className="inline-flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <span>{cat.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div
          role="group"
          aria-label="8-week stacked score bar chart"
          className="pt-4 pb-1"
        >
          <div className="grid grid-cols-8 items-end gap-2 h-32 border-b border-line px-1">
            {trend.map((point, index) => {
              const isCurrent = index === trend.length - 1;
              const rangeLabel = formatWeekRange(point.weekStart, point.weekEnd);
              const careerContrib = (point.categories.career ?? 0) * 0.36;
              const healthContrib = (point.categories.health ?? 0) * 0.36;
              const hobbiesContrib = (point.categories['hobbies-habits'] ?? 0) * 0.28;
              const overallRounded = Math.round(point.overall);

              const barAria = `${rangeLabel}${isCurrent ? ' (current week)' : ''}: overall score ${overallRounded}, Career contribution ${Math.round(careerContrib)}, Health contribution ${Math.round(healthContrib)}, Hobbies contribution ${Math.round(hobbiesContrib)}`;

              return (
                <div
                  key={point.weekStart}
                  role="img"
                  aria-label={barAria}
                  className="relative flex h-full flex-col justify-end items-center group"
                >
                  <span
                    className={
                      isCurrent
                        ? 'mb-1 font-display text-[11px] font-bold text-text tabular-nums'
                        : 'mb-1 font-display text-[10px] font-medium text-muted tabular-nums'
                    }
                  >
                    {overallRounded}
                  </span>
                  <div
                    className={
                      isCurrent
                        ? 'w-full flex flex-col justify-end rounded-t-md overflow-hidden ring-1 ring-accent-soft bg-ink/50'
                        : 'w-full flex flex-col justify-end rounded-t-md overflow-hidden bg-ink/30 opacity-85'
                    }
                    style={{ height: '100%' }}
                  >
                    <div
                      style={{
                        height: `${Math.max(0, Math.min(100, careerContrib))}%`,
                        backgroundColor: 'var(--color-career)',
                      }}
                    />
                    <div
                      style={{
                        height: `${Math.max(0, Math.min(100, healthContrib))}%`,
                        backgroundColor: 'var(--color-health)',
                      }}
                    />
                    <div
                      style={{
                        height: `${Math.max(0, Math.min(100, hobbiesContrib))}%`,
                        backgroundColor: 'var(--color-hobbies)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted px-1">
            <span>
              {trend[0] ? formatWeekRange(trend[0].weekStart, trend[0].weekEnd) : ''}
            </span>
            <span className="font-medium text-text">
              {currentWeekPoint
                ? formatWeekRange(currentWeekPoint.weekStart, currentWeekPoint.weekEnd)
                : ''}
            </span>
          </div>
        </div>

        <table className="sr-only">
          <caption>Weekly score trend over the past 8 weeks</caption>
          <thead>
            <tr>
              <th scope="col">Week</th>
              <th scope="col">Overall</th>
              <th scope="col">Career</th>
              <th scope="col">Health</th>
              <th scope="col">Hobbies</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((point) => (
              <tr key={point.weekStart}>
                <td>{formatWeekRange(point.weekStart, point.weekEnd)}</td>
                <td>{Math.round(point.overall)}</td>
                <td>{point.categories.career === null ? 'No activities' : Math.round(point.categories.career)}</td>
                <td>{point.categories.health === null ? 'No activities' : Math.round(point.categories.health)}</td>
                <td>{point.categories['hobbies-habits'] === null ? 'No activities' : Math.round(point.categories['hobbies-habits'])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SpotlightCard>

      <SpotlightCard className="p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-text">
            12-week consistency
          </h2>
          <span className="text-[11px] text-muted tabular-nums">
            {activeCell
              ? `${formatHeatmapDate(activeCell.date)}: ${activeCell.logCount} ${activeCell.logCount === 1 ? 'log' : 'logs'}`
              : 'Hover or focus a day'}
          </span>
        </div>

        <div
          role="group"
          aria-label="12-week activity heatmap, Monday to Sunday"
          className="space-y-1"
        >
          {HEATMAP_WEEKDAYS.map((rowMeta) => {
            const rowCells = heatmap.filter(
              (cell) => parseLocalWeekday(cell.date) === rowMeta.dayIndex,
            );
            return (
              <div
                key={rowMeta.full}
                className="grid grid-cols-[16px_1fr] items-center gap-2"
              >
                <span
                  aria-hidden="true"
                  className="text-[10px] font-medium text-muted text-center"
                >
                  {rowMeta.short}
                </span>
                <div className="grid grid-cols-12 gap-1">
                  {rowCells.map((cell) => {
                    const upcoming = cell.date > formatDateKey(now);
                    const label = upcoming ? `${formatHeatmapDate(cell.date)}, upcoming` : `${formatHeatmapDate(cell.date)}: ${cell.logCount} ${cell.logCount === 1 ? 'log' : 'logs'}`;
                    return (
                      <button
                        key={cell.date}
                        type="button"
                        title={label}
                        aria-label={label}
                        onMouseEnter={() => setActiveCell(upcoming ? null : cell)}
                        onFocus={() => setActiveCell(upcoming ? null : cell)}
                        onMouseLeave={() => setActiveCell(null)}
                        onBlur={() => setActiveCell(null)}
                        className={`aspect-square w-full rounded-[3px] border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft ${upcoming ? 'bg-transparent border-line' : INTENSITY_STYLES[cell.intensity]}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {allActivities.length > 0 && (
          <div className="border-t border-line pt-2.5 space-y-1">
            <p className="text-xs font-semibold text-text">
              {totalDoneUnits} of {totalGoalUnits} goals logged
            </p>
            <p className="text-[11px] text-muted leading-relaxed">
              {allActivities.map((a) => `${a.name} ${a.done}/${a.goal}`).join(' - ')}
            </p>
          </div>
        )}
      </SpotlightCard>
    </div>
  );
}

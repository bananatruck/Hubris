import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ActivityLog, ActivityScoreRow, ScoredCategory } from '@hubris/types';
import { useHubris } from '../../state/useHubris';
import { errorMessage } from '../lib/errors';
import { useNotify } from '../lib/notify';
import { CATEGORIES, CATEGORY_BY_ID, IMPORTANCE_BY_ID } from '../lib/categories';
import { getRoundedStatus } from '../lib/format';
import { ActivityForm } from '../components/ActivityForm';
import { Button } from '../components/21st/button';
import { Dialog, DialogContent, DialogTrigger } from '../components/21st/dialog';
import { GlowingEffectCard } from '../components/aceternity/glowing-effect';
import { AnimatedCircularProgressBar, type OrbitArc } from '../components/magicui/animated-circular-progress-bar';
import { NumberTicker } from '../components/magicui/number-ticker';
import { ClickSpark } from '../components/reactbits/click-spark';
import { CountUp } from '../components/reactbits/count-up';
import { SpotlightCard } from '../components/reactbits/spotlight-card';

export interface TodayScreenProps {
  onLogged: (activityName: string, log: ActivityLog) => void;
}

const ORBIT_RADII: Readonly<Record<ScoredCategory, number>> = {
  career: 86,
  health: 70,
  'hobbies-habits': 55,
};

const ORBIT_TRACK_COLORS: Readonly<Record<ScoredCategory, string>> = {
  career: 'rgba(59, 130, 246, 0.14)',
  health: 'rgba(34, 197, 94, 0.14)',
  'hobbies-habits': 'rgba(245, 158, 11, 0.14)',
};

function GoalDots({ row, color }: { row: ActivityScoreRow; color: string }) {
  const maxVisualDots = Math.min(row.goal, 10);
  const filledDots = Math.min(row.done, maxVisualDots);
  const overCount = row.done > row.goal ? row.done - row.goal : 0;

  return (
    <div
      role="img"
      className="flex items-center gap-1 flex-wrap justify-end"
      aria-label={`${row.done} of ${row.goal} completed`}
    >
      {row.goal <= 10 ? (
        Array.from({ length: maxVisualDots }, (_, idx) => {
          const isFilled = idx < filledDots;
          return (
            <span
              key={idx}
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full transition-colors"
              style={{
                backgroundColor: isFilled ? color : 'var(--color-line)',
              }}
            />
          );
        })
      ) : (
        <span className="text-xs font-medium text-muted tabular-nums">
          {Math.min(row.done, row.goal)}/{row.goal}
        </span>
      )}
      {overCount > 0 && (
        <span className="ml-0.5 rounded-full bg-accent/25 border border-accent-soft/40 px-1.5 py-0.5 text-[10px] font-semibold text-accent-soft tabular-nums">
          +{overCount}
        </span>
      )}
    </div>
  );
}

export function TodayScreen({ onLogged }: TodayScreenProps) {
  const { report, actions } = useHubris();
  const notify = useNotify();
  const pendingWrites = useRef(new Set<string>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { rounded: roundedOverall, word: statusWord } = getRoundedStatus(report.overall);

  const arcs: OrbitArc[] = CATEGORIES.map((cat) => ({
    id: cat.id,
    label: cat.label,
    score: report.categories[cat.id].score,
    color: cat.color,
    trackColor: ORBIT_TRACK_COLORS[cat.id],
    strokeWidth: cat.ringThickness,
    radius: ORBIT_RADII[cat.id],
  }));

  const totalActiveActivities = CATEGORIES.reduce(
    (sum, cat) => sum + report.categories[cat.id].activities.length,
    0,
  );

  const handleLog = async (row: ActivityScoreRow) => {
    if (pendingWrites.current.has(row.activityId)) return;
    pendingWrites.current.add(row.activityId);
    setPendingIds(new Set(pendingWrites.current));
    try {
      const createdLog = await actions.logActivity(row.activityId);
      onLogged(row.name, createdLog);
    } catch (cause) {
      notify({ message: errorMessage(cause), tone: 'error' });
    } finally {
      pendingWrites.current.delete(row.activityId);
      setPendingIds(new Set(pendingWrites.current));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center pt-1 pb-1">
        <AnimatedCircularProgressBar
          overallScore={report.overall}
          statusWord={statusWord}
          arcs={arcs}
        >
          <div
            aria-live="polite"
            aria-atomic="true"
            className="flex flex-col items-center justify-center"
          >
            <NumberTicker
              value={roundedOverall}
              className="text-5xl font-extrabold text-text leading-none"
            />
            <span className="mt-1 text-xs font-medium text-muted">
              {statusWord}
            </span>
          </div>
        </AnimatedCircularProgressBar>
      </div>

      <section aria-label="Category scores" className="space-y-1.5">
        {CATEGORIES.map((cat) => {
          const catReport = report.categories[cat.id];
          const onTrackCount = catReport.activities.filter((a) => Math.round(a.score) >= 80).length;
          const totalInCat = catReport.activities.length;

          return (
            <GlowingEffectCard
              key={cat.id}
              glowColor={`${cat.color}22`}
              className="px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    aria-hidden="true"
                    className="h-5 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-sm font-medium text-text">
                    {cat.label}
                  </span>
                </div>

                <span className="text-xs text-muted truncate px-2">
                  {catReport.score === null
                    ? 'No activities yet'
                    : `${onTrackCount} of ${totalInCat} ${totalInCat === 1 ? 'activity' : 'activities'} on track`}
                </span>

                <div className="shrink-0 text-right min-w-[2rem]">
                  {catReport.score === null ? (
                    <span className="text-sm font-semibold text-muted">-</span>
                  ) : (
                    <CountUp
                      value={Math.round(catReport.score)}
                      className="text-base font-bold text-text"
                    />
                  )}
                </div>
              </div>
            </GlowingEffectCard>
          );
        })}
      </section>

      <section aria-label="This week" className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-text">
            This week
          </h2>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add activity
              </Button>
            </DialogTrigger>
            <DialogContent
              title="Add activity"
              description="Create a weekly activity to track in your ledger."
            >
              <ActivityForm
                submitLabel="Save activity"
                onCancel={() => setAddDialogOpen(false)}
                onSubmit={actions.createActivity}
                onSuccess={() => setAddDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {totalActiveActivities === 0 ? (
          <SpotlightCard className="p-5 text-center space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-text">
                No activities yet
              </p>
              <p className="text-xs text-muted">
                Add your first weekly habit across Career, Health, or Hobbies to start tracking this week.
              </p>
            </div>
            <Button variant="primary" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add your first activity
            </Button>
          </SpotlightCard>
        ) : (
          <SpotlightCard className="divide-y divide-line overflow-hidden">
            {CATEGORIES.map((cat) => {
              const rows = report.categories[cat.id].activities;
              if (rows.length === 0) return null;
              return rows.map((row) => {
                const impMeta = IMPORTANCE_BY_ID[row.importance];
                const catMeta = CATEGORY_BY_ID[cat.id];
                return (
                  <div
                    key={row.activityId}
                    className="flex items-center justify-between gap-2 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: catMeta.color }}
                      />
                      <span className="text-sm font-medium text-text truncate">
                        {row.name}
                      </span>
                      <span className="shrink-0 rounded-full bg-raised border border-line px-2 py-0.5 text-[11px] font-medium text-muted">
                        {impMeta.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <GoalDots row={row} color={catMeta.color} />
                      <ClickSpark>
                        <button
                          type="button"
                          aria-label={`Log ${row.name}, ${row.done} of ${row.goal} this week`}
                          disabled={pendingIds.has(row.activityId)}
                          onClick={() => void handleLog(row)}
                          className="inline-flex h-7 w-8 items-center justify-center rounded-full bg-accent text-white transition-transform active:scale-95 hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft cursor-pointer"
                        >
                          <svg
                            width="18"
                            height="12"
                            viewBox="0 0 18 12"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M4 2.5V9.5M0.5 6H7.5"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                            <path
                              d="M11.5 3.5L14 1.8V10.2"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </ClickSpark>
                    </div>
                  </div>
                );
              });
            })}
          </SpotlightCard>
        )}
      </section>
    </div>
  );
}

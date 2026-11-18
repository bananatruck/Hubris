import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { formatDateKey } from '@hubris/core';
import type { ActivityLog, ScoredCategory } from '@hubris/types';
import { useHubris } from '../../state/useHubris';
import { useDialogAction } from '../lib/useDialogAction';
import { CATEGORIES, CATEGORY_BY_ID } from '../lib/categories';
import { formatDayHeading, formatLogTime } from '../lib/format';
import { Button } from '../components/21st/button';
import { Dialog, DialogContent } from '../components/21st/dialog';
import { SegmentedControl, type SegmentedOption } from '../components/21st/segmented-control';
import { SpotlightCard } from '../components/reactbits/spotlight-card';

type CategoryFilter = 'all' | ScoredCategory;

const FILTER_OPTIONS: readonly SegmentedOption<CategoryFilter>[] = [
  { value: 'all', label: 'All' },
  ...CATEGORIES.map((cat) => ({
    value: cat.id,
    label: cat.label,
    dotColor: cat.color,
  })),
];

export function HistoryScreen() {
  const { activities, logs, now, actions } = useHubris();
  const deletion = useDialogAction();
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [logToDelete, setLogToDelete] = useState<ActivityLog | null>(null);

  const activityMap = useMemo(() => {
    return new Map(activities.map((a) => [a.id, a]));
  }, [activities]);

  const filteredGroups = useMemo(() => {
    const matching = logs
      .filter((log) => {
        if (filter === 'all') return true;
        const activity = activityMap.get(log.activityId);
        return activity?.category === filter;
      })
      .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());

    const groups = new Map<string, ActivityLog[]>();
    for (const log of matching) {
      const key = formatDateKey(new Date(log.loggedAt));
      const list = groups.get(key);
      if (list) {
        list.push(log);
      } else {
        groups.set(key, [log]);
      }
    }
    return Array.from(groups.entries());
  }, [logs, filter, activityMap]);

  const handleConfirmDelete = () => {
    if (!logToDelete) return;
    void deletion.run(() => actions.deleteLog(logToDelete.id), () => setLogToDelete(null));
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-text">
          Activity history
        </h2>
        <span className="text-xs text-muted tabular-nums">
          {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      <SegmentedControl
        ariaLabel="Filter history by category"
        options={FILTER_OPTIONS}
        value={filter}
        onChange={setFilter}
        layoutId="history-cat-filter"
      />

      {filteredGroups.length === 0 ? (
        <SpotlightCard className="p-5 text-center space-y-1.5" data-testid="history-empty-state">
          <p className="text-sm font-medium text-text">
            No logs in history yet
          </p>
          <p className="text-xs text-muted">
            {filter === 'all'
              ? 'Tap +1 next to any activity on Today to record your first log.'
              : 'No logs recorded for this category yet.'}
          </p>
        </SpotlightCard>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map(([dateKey, dayLogs]) => (
            <section key={dateKey} aria-label={formatDayHeading(dateKey, now)} className="space-y-1.5">
              <h3 className="text-xs font-semibold text-muted px-1">
                {formatDayHeading(dateKey, now)}
              </h3>
              <SpotlightCard className="divide-y divide-line overflow-hidden">
                {dayLogs.map((log) => {
                  const activity = activityMap.get(log.activityId);
                  const catMeta = activity ? CATEGORY_BY_ID[activity.category] : CATEGORIES[0];
                  const activityName = activity?.name ?? 'Deleted activity';

                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: catMeta.color }}
                          />
                          <span className="text-sm font-medium text-text truncate">
                            {activityName}
                          </span>
                          <span className="text-[11px] text-muted tabular-nums">
                            {formatLogTime(log.loggedAt)}
                          </span>
                        </div>
                        {log.note && (
                          <p className="pl-4 text-xs text-muted break-words">
                            {log.note}
                          </p>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete log for ${activityName}`}
                        onClick={() => { deletion.clearError(); setLogToDelete(log); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted hover:text-red-300" aria-hidden="true" />
                      </Button>
                    </div>
                  );
                })}
              </SpotlightCard>
            </section>
          ))}
        </div>
      )}

      <Dialog
        open={logToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletion.pending) setLogToDelete(null);
        }}
      >
        <DialogContent
          title="Delete log entry"
          description="Removing this log will recalculate your weekly score immediately."
        >
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted">
              Are you sure you want to delete this log for{' '}
              <strong className="text-text font-medium">
                {logToDelete ? (activityMap.get(logToDelete.activityId)?.name ?? 'this activity') : ''}
              </strong>
              ?
            </p>
            {deletion.error && <p role="alert" className="text-xs text-red-200">{deletion.error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" disabled={deletion.pending} onClick={() => setLogToDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={deletion.pending} onClick={handleConfirmDelete}>
                Confirm delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

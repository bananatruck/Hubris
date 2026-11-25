import { useEffect, useId, useRef } from 'react';
import { Flame, Hourglass, Sun } from 'lucide-react';
import { activeReportCategories } from '@hubris/core';
import type { Suggestion } from '@hubris/types';
import { useHubris } from '../../state/useHubris';
import { CATEGORY_BY_ID } from '../lib/categories';
import { Button } from './21st/button';
import { ClickSpark } from './reactbits/click-spark';
import { SpotlightCard } from './reactbits/spotlight-card';

export interface SuggestionListProps {
  pendingIds: ReadonlySet<string>;
  onLog: (activityId: string, activityName: string) => Promise<void>;
}

function SuggestionIcon({ type }: { type: Suggestion['type'] }) {
  if (type === 'at-risk') return <Hourglass className="h-3.5 w-3.5" aria-hidden="true" />;
  if (type === 'streak-protector') return <Flame className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Sun className="h-3.5 w-3.5" aria-hidden="true" />;
}

export function SuggestionList({ pendingIds, onLog }: SuggestionListProps) {
  const headingId = useId();
  const { activities, report, suggestions } = useHubris();
  const listRef = useRef<HTMLUListElement>(null);
  // The suggestion a keyboard or pointer user just logged, and where it sat in the list.
  const pendingFocus = useRef<{ activityId: string; index: number } | null>(null);
  const suggestedIds = suggestions.slice(0, 3).map((suggestion) => suggestion.activityId).join(',');

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending || suggestedIds.split(',').includes(pending.activityId)) return;
    pendingFocus.current = null;
    // Only step in when the removed button took focus with it; never pull focus from where the user went.
    if (document.activeElement && document.activeElement !== document.body) return;
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [];
    const target = buttons[pending.index] ?? buttons[pending.index - 1]
      ?? document.querySelector<HTMLElement>(`[data-log-activity="${CSS.escape(pending.activityId)}"]`);
    target?.focus();
  }, [suggestedIds]);
  const active = activeReportCategories(report);
  if (active.size === 0) return null;

  const rows = suggestions.slice(0, 3).flatMap((suggestion) => {
    const activity = activities.find((candidate) => candidate.id === suggestion.activityId);
    const categoryId = activity && active.get(activity.id);
    return activity && categoryId ? [{ activity, suggestion, category: CATEGORY_BY_ID[categoryId] }] : [];
  });

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h2 id={headingId} className="font-display text-base font-semibold text-text">
        Worth doing next
      </h2>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">You are on pace this week.</p>
      ) : (
        <ul ref={listRef} className="space-y-1.5">
          {rows.map(({ activity, suggestion, category }, index) => {
            return (
              <li key={suggestion.id}>
                <SpotlightCard
                  className="px-2.5 py-2"
                  spotlightColor={`${category.color}14`}
                >
                  <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border"
                      style={{
                        color: category.color,
                        backgroundColor: `${category.color}14`,
                        borderColor: `${category.color}40`,
                      }}
                    >
                      <SuggestionIcon type={suggestion.type} />
                    </span>
                    <p className="min-w-0 text-xs leading-4 text-text">
                      {suggestion.message}
                    </p>
                    <ClickSpark sparkColor={category.color} className="shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={pendingIds.has(activity.id)}
                        onClick={() => {
                          pendingFocus.current = { activityId: activity.id, index };
                          void onLog(activity.id, activity.name);
                        }}
                      >
                        {suggestion.ctaLabel}
                      </Button>
                    </ClickSpark>
                  </div>
                </SpotlightCard>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

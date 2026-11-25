import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BarChart3, CalendarCheck2, Clock, PanelRightOpen, RotateCcw, Settings } from 'lucide-react';
import type { LogUndo } from '../storage/repository';
import { useHubris } from '../state/useHubris';
import { NotificationContext, type Notification } from './lib/notify';
import { errorMessage } from './lib/errors';
import { formatWeekRange } from './lib/format';
import { Button } from './components/21st/button';
import { Toast, type ToastData } from './components/21st/toast';
import { AceternityTabBar, TabsContent, TabsRoot, type AceternityTabItem } from './components/aceternity/tabs';
import { SpotlightCard } from './components/reactbits/spotlight-card';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { TodayScreen } from './screens/TodayScreen';
import { TrendsScreen } from './screens/TrendsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type TabValue = 'today' | 'trends' | 'history' | 'settings';

const NAV_ITEMS: readonly AceternityTabItem[] = [
  { value: 'today', label: 'Today', icon: <CalendarCheck2 className="h-4 w-4" /> },
  { value: 'trends', label: 'Trends', icon: <BarChart3 className="h-4 w-4" /> },
  { value: 'history', label: 'History', icon: <Clock className="h-4 w-4" /> },
  { value: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
];

function LoadingSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="space-y-4 p-4"
    >
      <span className="sr-only">Loading your weekly ledger...</span>
      <div className="mx-auto h-48 w-48 rounded-full border-8 border-raised bg-panel/60 animate-pulse" />
      <div className="space-y-2">
        <div className="h-11 rounded-xl bg-panel border border-line animate-pulse" />
        <div className="h-11 rounded-xl bg-panel border border-line animate-pulse" />
        <div className="h-11 rounded-xl bg-panel border border-line animate-pulse" />
      </div>
      <div className="space-y-2 pt-2">
        <div className="h-12 rounded-xl bg-panel border border-line animate-pulse" />
        <div className="h-12 rounded-xl bg-panel border border-line animate-pulse" />
      </div>
    </div>
  );
}

function activeTabPanel() {
  return document.querySelector<HTMLElement>('[role="tabpanel"][data-state="active"]');
}

export function App({ surface }: { surface: 'popup' | 'sidepanel' }) {
  const { status, error, report, onboardingComplete, actions } = useHubris();
  const [activeTab, setActiveTab] = useState<TabValue>('today');
  const [keepOnboardingForStep3, setKeepOnboardingForStep3] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [windowId, setWindowId] = useState<number | null>(null);

  const canShowSidePanelButton =
    surface === 'popup' &&
    typeof chrome !== 'undefined' &&
    Boolean(chrome.sidePanel?.open) &&
    Boolean(chrome.windows?.getCurrent);

  useEffect(() => {
    if (!canShowSidePanelButton) return;
    let active = true;
    try {
      chrome.windows.getCurrent((win) => {
        if (active && typeof win?.id === 'number') {
          setWindowId(win.id);
        }
      });
    } catch {
      // Ignore if called outside an extension window
    }
    return () => {
      active = false;
    };
  }, [canShowSidePanelButton]);

  const addToast = useCallback((toast: ToastData) => {
    setToasts((current) => [...current, toast]);
  }, []);

  const notify = useCallback((notification: Notification) => {
    addToast({ ...notification, id: crypto.randomUUID() });
  }, [addToast]);

  const handleOpenSidePanel = () => {
    if (typeof chrome !== 'undefined' && chrome.sidePanel?.open && windowId !== null) {
      try {
        void chrome.sidePanel.open({ windowId }).catch((cause: unknown) => {
          notify({ message: errorMessage(cause), tone: 'error' });
        });
      } catch (cause) {
        notify({ message: errorMessage(cause), tone: 'error' });
      }
    }
  };

  const handleLogged = useCallback(
    (activityName: string, undo: LogUndo) => {
      addToast({
        id: undo.log.id,
        tone: 'info',
        message: `${activityName} logged`,
        undoLabel: `Undo ${activityName}`,
        onUndo: () => {
          void actions.undoLog(undo).catch(() => {
            addToast({
              id: crypto.randomUUID(),
              message: 'Could not undo. The log is still there.',
              tone: 'error',
            });
          });
        },
      });
    },
    [actions, addToast],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const weekRangeText = formatWeekRange(report.weekStart, report.weekEnd);
  const showOnboarding = !onboardingComplete || keepOnboardingForStep3;
  const twoColumnClass = surface === 'sidepanel'
    ? 'sm:grid sm:grid-cols-2 sm:gap-5 sm:items-start'
    : '';
  const wideOnlyClass = surface === 'sidepanel' ? 'hidden sm:block' : 'hidden';

  return (
    <NotificationContext.Provider value={notify}>
      <div
        data-surface={surface}
        className={
          surface === 'popup'
            ? 'flex min-h-[600px] w-full max-w-[380px] flex-col bg-ink text-text'
            : 'mx-auto flex min-h-screen w-full max-w-5xl flex-col bg-ink text-text'
        }
      >
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-ink/95 px-3.5 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent font-display text-base font-extrabold text-white shadow-xs"
            >
              H
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-sm font-bold leading-tight text-text">
                Hubris
              </h1>
              {weekRangeText && (
                <p className="text-[11px] text-muted leading-tight tabular-nums">
                  {weekRangeText}
                </p>
              )}
            </div>
          </div>

          {canShowSidePanelButton && (
            <Button
              variant="secondary"
              size="icon"
              aria-label="Open side panel"
              title="Open side panel"
              disabled={windowId === null}
              onClick={handleOpenSidePanel}
            >
              <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </header>

        {status === 'ready' && error && (
          <div
            role="alert"
            className="mx-3.5 mt-3 flex items-center justify-between gap-3 rounded-lg border border-red-500/40 bg-red-950/60 px-3 py-2 text-xs text-red-200"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </span>
            <Button variant="secondary" size="sm" onClick={() => void actions.retry()}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </Button>
          </div>
        )}

        {status === 'loading' ? (
          <main className="flex-1">
            <LoadingSkeleton />
          </main>
        ) : status === 'error' ? (
          <main className="flex flex-1 items-center justify-center p-4">
            <SpotlightCard className="w-full max-w-sm p-5 text-center space-y-3">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-950 text-red-300 border border-red-500/40">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h2 className="font-display text-base font-semibold text-text">
                  Could not load your ledger
                </h2>
                <p role="alert" className="text-xs text-red-200">
                  {error ?? 'Could not read local data. Try again.'}
                </p>
              </div>
              <Button variant="primary" onClick={() => void actions.retry()}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </Button>
            </SpotlightCard>
          </main>
        ) : showOnboarding ? (
          <main className="flex-1 overflow-y-auto">
            <OnboardingScreen
              onEnterStep3={() => setKeepOnboardingForStep3(true)}
              onFinish={() => setKeepOnboardingForStep3(false)}
            />
          </main>
        ) : (
          <TabsRoot
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as TabValue)}
            className="flex flex-1 flex-col min-h-0"
          >
            <main className="flex-1 overflow-y-auto px-3.5 py-3 pb-20">
              <TabsContent value="today" className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-ink">
                <div className={twoColumnClass}>
                  <TodayScreen onLogged={handleLogged} />
                  <div className={wideOnlyClass}>
                    <TrendsScreen />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="trends" className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-ink">
                <div className={twoColumnClass}>
                  <div className={wideOnlyClass}>
                    <TodayScreen onLogged={handleLogged} />
                  </div>
                  <TrendsScreen />
                </div>
              </TabsContent>

              <TabsContent value="history" className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-ink">
                <HistoryScreen />
              </TabsContent>

              <TabsContent value="settings" className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-ink">
                <SettingsScreen />
              </TabsContent>
            </main>

            <nav aria-label="Main navigation" className="sticky bottom-0 z-30 mt-auto">
              <AceternityTabBar
                ariaLabel="Sections"
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as TabValue)}
                items={NAV_ITEMS}
              />
            </nav>
          </TabsRoot>
        )}
        <Toast toasts={toasts} onDismiss={dismissToast} durationMs={6000} fallbackFocus={activeTabPanel} />
      </div>
    </NotificationContext.Provider>
  );
}

import { useState } from 'react';
import { Sparkles, FilePlus2 } from 'lucide-react';
import { useHubris } from '../../state/useHubris';
import { errorMessage } from '../lib/errors';
import { CATEGORIES, IMPORTANCE_OPTIONS } from '../lib/categories';
import { ActivityForm } from '../components/ActivityForm';
import { Button } from '../components/21st/button';
import { BorderBeam } from '../components/magicui/border-beam';
import { Stepper, type StepItem } from '../components/reactbits/stepper';
import { SpotlightCard } from '../components/reactbits/spotlight-card';

export interface OnboardingScreenProps {
  onEnterStep3?: () => void;
  onFinish: () => void;
}

export function OnboardingScreen({ onEnterStep3, onFinish }: OnboardingScreenProps) {
  const { actions } = useHubris();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleChooseStarter = async (withExamples: boolean) => {
    setBusy(true);
    setError(null);
    onEnterStep3?.();
    try {
      await actions.completeOnboarding(withExamples);
      setStep(2);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const steps: readonly StepItem[] = [
    {
      id: 'intro',
      title: 'How it works',
      content: (
        <SpotlightCard className="p-4 space-y-4">
          <BorderBeam />
          <div className="space-y-1.5">
            <h2 className="font-display text-lg font-bold text-text">
              Log in two seconds, see an honest weekly score
            </h2>
            <p className="text-xs leading-relaxed text-muted">
              Hubris is a quiet weekly ledger of intention versus action across Career, Health, and Hobbies. Tap once to log an activity and see your score move immediately.
            </p>
          </div>

          <div className="space-y-2.5 rounded-lg border border-line bg-ink/70 p-3">
            <h3 className="text-xs font-semibold text-text">
              How the weekly score works
            </h3>
            <div className="space-y-1.5 text-xs text-muted">
              <p>
                <strong className="text-text font-medium">36/36/28 by category:</strong>{' '}
                {CATEGORIES.map((c) => `${c.label} ${c.weightPercent}%`).join(', ')}.
              </p>
              <p>
                <strong className="text-text font-medium">40/35/25 by importance:</strong>{' '}
                {IMPORTANCE_OPTIONS.map((i) => `${i.label} ${i.weightPercent}%`).join(', ')} inside each category.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button variant="primary" size="lg" onClick={() => setStep(1)}>
              Next
            </Button>
          </div>
        </SpotlightCard>
      ),
    },
    {
      id: 'starter',
      title: 'Choose start',
      content: (
        <SpotlightCard className="p-4 space-y-3.5">
          <div className="space-y-1">
            <h2 className="font-display text-base font-bold text-text">
              How would you like to begin?
            </h2>
            <p className="text-xs text-muted">
              Seed Career with two example habits or start with an empty ledger.
            </p>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleChooseStarter(true)}
              className="w-full rounded-xl border border-accent-soft/40 bg-raised/90 p-3.5 text-left transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent-soft">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-text">
                    Start with an example (Leetcode and Classes)
                  </p>
                  <p className="text-[11px] text-muted">
                    Adds Leetcode (5 times a week, High) and Classes (4 times a week, Medium) under Career.
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleChooseStarter(false)}
              className="w-full rounded-xl border border-line bg-ink/80 p-3.5 text-left transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-raised text-muted">
                  <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-text">
                    Start blank
                  </p>
                  <p className="text-[11px] text-muted">
                    Begin with zero activities and add only your own weekly goals.
                  </p>
                </div>
              </div>
            </button>
          </div>

          {error && <p role="alert" className="text-xs text-red-200">{error}</p>}

          <div className="flex justify-between pt-1">
            <Button variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
          </div>
        </SpotlightCard>
      ),
    },
    {
      id: 'first-activity',
      title: 'First activity',
      content: (
        <SpotlightCard className="p-4 space-y-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <h2 className="font-display text-base font-bold text-text">
                Add a weekly activity
              </h2>
              <p className="text-xs text-muted">
                Create an activity now, or skip and add one anytime from Today.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onFinish}>
              Skip
            </Button>
          </div>

          <ActivityForm
            submitLabel="Add activity"
            cancelLabel="Skip for now"
            onCancel={onFinish}
            onSubmit={actions.createActivity}
            onSuccess={onFinish}
          />
        </SpotlightCard>
      ),
    },
  ];

  return (
    <section aria-label="Welcome to Hubris" className="p-3.5">
      <Stepper
        steps={steps}
        currentStep={step}
        onStepChange={(next) => {
          if (next <= step) setStep(next);
        }}
      />
    </section>
  );
}

// React Bits - https://reactbits.dev/components/stepper
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface StepItem {
  id: string;
  title: string;
  content: ReactNode;
}

export interface StepperProps {
  steps: readonly StepItem[];
  currentStep: number;
  onStepChange?: (stepIndex: number) => void;
  footer?: ReactNode;
  className?: string;
}

export function Stepper({
  steps,
  currentStep,
  onStepChange,
  footer,
  className,
}: StepperProps) {
  const prefersReducedMotion = useReducedMotion();
  const activeStep = steps[currentStep] ?? steps[0];

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <nav aria-label="Onboarding steps" className="flex items-center justify-between gap-2">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          return (
            <div key={step.id} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!onStepChange || index > currentStep}
                onClick={() => onStepChange?.(index)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Step ${index + 1}: ${step.title}`}
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft',
                  isCurrent
                    ? 'bg-accent text-white ring-2 ring-accent-soft/40'
                    : isCompleted
                      ? 'bg-accent/25 text-accent-soft border border-accent/40'
                      : 'bg-raised text-muted border border-line',
                )}
              >
                {index + 1}
              </button>
              <span
                className={cn(
                  'text-xs font-medium truncate',
                  isCurrent ? 'text-text' : 'text-muted',
                )}
              >
                {step.title}
              </span>
              {index < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={cn(
                    'h-px flex-1 transition-colors',
                    isCompleted ? 'bg-accent' : 'bg-line',
                  )}
                />
              )}
            </div>
          );
        })}
      </nav>

      {activeStep && (
        <motion.div
          key={activeStep.id}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
          className="min-w-0"
        >
          {activeStep.content}
        </motion.div>
      )}

      {footer && <div className="pt-1">{footer}</div>}
    </div>
  );
}

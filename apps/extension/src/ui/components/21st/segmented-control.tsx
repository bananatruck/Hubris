// 21st.dev - https://21st.dev/components/segmented-control
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  subtitle?: string;
  dotColor?: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  layoutId?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  layoutId,
  className,
}: SegmentedControlProps<T>) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'grid gap-1 rounded-lg border border-line bg-ink p-1',
        options.length === 2 ? 'grid-cols-2' : options.length === 4 ? 'grid-cols-4' : 'grid-cols-3',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex flex-col items-center justify-center rounded-md px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft',
              selected ? 'text-text' : 'text-muted hover:text-text',
            )}
          >
            {selected && (
              <motion.span
                layoutId={prefersReducedMotion ? undefined : layoutId}
                aria-hidden="true"
                className="absolute inset-0 rounded-md bg-raised border border-accent-soft/40"
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: 'spring', bounce: 0.15, duration: 0.3 }
                }
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {option.dotColor && (
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: option.dotColor }}
                />
              )}
              <span>{option.label}</span>
            </span>
            {option.subtitle && (
              <span className="relative z-10 text-[10px] text-muted mt-0.5">
                {option.subtitle}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

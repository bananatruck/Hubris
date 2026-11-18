// 21st.dev - https://21st.dev/components/number-stepper
import { Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface NumberStepperProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  className?: string;
}

export function NumberStepper({
  id,
  value,
  onChange,
  min = 1,
  max = 99,
  ariaInvalid,
  ariaDescribedBy,
  className,
}: NumberStepperProps) {
  const handleDecrement = () => {
    const next = Number.isFinite(value) ? Math.max(min, value - 1) : min;
    onChange(next);
  };

  const handleIncrement = () => {
    const next = Number.isFinite(value) ? Math.min(max, value + 1) : min;
    onChange(next);
  };

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <button
        type="button"
        aria-label="Decrease weekly goal"
        disabled={value <= min}
        onClick={handleDecrement}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-raised text-text transition-colors hover:bg-line/70 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Number.isNaN(value) ? '' : value}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === '') {
            onChange(0);
            return;
          }
          const parsed = Number(raw);
          onChange(parsed);
        }}
        className={cn(
          'h-8 w-16 rounded-lg border border-line bg-raised px-2 text-center font-display text-sm font-semibold text-text tabular-nums',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft',
          ariaInvalid && 'border-red-400 focus-visible:ring-red-400',
        )}
      />
      <button
        type="button"
        aria-label="Increase weekly goal"
        disabled={value >= max}
        onClick={handleIncrement}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-raised text-text transition-colors hover:bg-line/70 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span className="text-xs text-muted pl-1">times a week</span>
    </div>
  );
}

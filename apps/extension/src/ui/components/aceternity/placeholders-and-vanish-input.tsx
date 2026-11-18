// Aceternity UI - https://ui.aceternity.com/components/placeholders-and-vanish-input
import { useEffect, useState, type ChangeEvent } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '../../lib/cn';

export interface PlaceholdersAndVanishInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholders: readonly string[];
  maxLength?: number;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  className?: string;
  autoFocus?: boolean;
}

export function PlaceholdersAndVanishInput({
  id,
  value,
  onChange,
  placeholders,
  maxLength,
  ariaInvalid,
  ariaDescribedBy,
  className,
  autoFocus,
}: PlaceholdersAndVanishInputProps) {
  const prefersReducedMotion = useReducedMotion();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion || placeholders.length <= 1 || value.length > 0) return;
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [placeholders, prefersReducedMotion, value.length]);

  const currentPlaceholder = placeholders[placeholderIndex] ?? placeholders[0] ?? '';

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="relative w-full">
      <input
        id={id}
        type="text"
        value={value}
        onChange={handleChange}
        maxLength={maxLength}
        placeholder={currentPlaceholder}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        autoFocus={autoFocus}
        className={cn(
          'w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm text-text placeholder:text-muted/75',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:border-accent-soft',
          ariaInvalid && 'border-red-400 focus-visible:ring-red-400',
          className,
        )}
      />
    </div>
  );
}

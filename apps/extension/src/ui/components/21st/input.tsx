// 21st.dev - https://21st.dev/shadcn/input
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm text-text placeholder:text-muted/75',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:border-accent-soft',
        hasError && 'border-red-400 focus-visible:ring-red-400',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

// Magic UI - https://magicui.design/docs/components/number-ticker
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/cn';

export interface NumberTickerProps {
  value: number;
  className?: string;
  suffix?: string;
}

export function NumberTicker({ value, className, suffix }: NumberTickerProps) {
  const prefersReducedMotion = useReducedMotion();
  const rounded = Math.round(value);

  return (
    <motion.span
      key={rounded}
      initial={prefersReducedMotion ? false : { opacity: 0.75, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
      className={cn('inline-block tabular-nums tracking-tight font-display', className)}
    >
      {rounded}
      {suffix ?? ''}
    </motion.span>
  );
}

// React Bits - https://reactbits.dev/text-animations/count-up
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/cn';

export interface CountUpProps {
  value: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

export function CountUp({ value, suffix = '', prefix = '', className }: CountUpProps) {
  const prefersReducedMotion = useReducedMotion();
  const rounded = Math.round(value);

  return (
    <motion.span
      key={rounded}
      initial={prefersReducedMotion ? false : { opacity: 0.7, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.18 }}
      className={cn('inline-block tabular-nums font-display', className)}
    >
      {prefix}
      {rounded}
      {suffix}
    </motion.span>
  );
}

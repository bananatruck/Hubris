// React Bits - https://reactbits.dev/animations/click-spark
import { useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/cn';

export interface ClickSparkProps {
  children: ReactNode;
  sparkColor?: string;
  className?: string;
}

const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

export function ClickSpark({
  children,
  sparkColor = '#a78bfa',
  className,
}: ClickSparkProps) {
  const prefersReducedMotion = useReducedMotion();
  const [burstKey, setBurstKey] = useState(0);

  const handleTrigger = () => {
    if (prefersReducedMotion) return;
    setBurstKey((prev) => prev + 1);
  };

  return (
    <div
      onClick={handleTrigger}
      className={cn('relative inline-flex items-center justify-center', className)}
    >
      {children}
      {burstKey > 0 && !prefersReducedMotion && (
        <span
          key={burstKey}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          {SPARK_ANGLES.map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const tx = Math.cos(rad) * 18;
            const ty = Math.sin(rad) * 18;
            return (
              <motion.span
                key={angle}
                initial={{ opacity: 0.95, x: 0, y: 0, scale: 1 }}
                animate={{ opacity: 0, x: tx, y: ty, scale: 0.25 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="absolute h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: sparkColor }}
              />
            );
          })}
        </span>
      )}
    </div>
  );
}

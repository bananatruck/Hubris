// React Bits - https://reactbits.dev/components/spotlight-card
import { useState, type HTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '../../lib/cn';

export interface SpotlightCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  spotlightColor?: string;
}

export function SpotlightCard({
  children,
  spotlightColor = 'rgba(167, 139, 250, 0.12)',
  className,
  ...props
}: SpotlightCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setPosition(null)}
      className={cn(
        'relative overflow-hidden rounded-xl border border-line bg-panel',
        className,
      )}
      {...props}
    >
      {position && !prefersReducedMotion && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(260px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 80%)`,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// Aceternity UI - https://ui.aceternity.com/components/glowing-effect
import { useState, type HTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '../../lib/cn';

export interface GlowingEffectCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  glowColor?: string;
}

export function GlowingEffectCard({
  children,
  glowColor = 'rgba(124, 58, 237, 0.18)',
  className,
  ...props
}: GlowingEffectCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setCoords({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setCoords(null)}
      className={cn(
        'relative overflow-hidden rounded-xl border border-line bg-panel transition-colors',
        className,
      )}
      {...props}
    >
      {coords && !prefersReducedMotion && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-200"
          style={{
            background: `radial-gradient(220px circle at ${coords.x}px ${coords.y}px, ${glowColor}, transparent 75%)`,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

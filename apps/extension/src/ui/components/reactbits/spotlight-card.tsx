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
  style,
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

  // The spotlight is a background image, painted under the content, so children stay direct children
  // of the card and the caller's space-y-* and divide-y utilities keep working.
  const spotlight = position && !prefersReducedMotion
    ? `radial-gradient(260px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 80%)`
    : undefined;

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setPosition(null)}
      className={cn(
        'relative overflow-hidden rounded-xl border border-line bg-panel',
        className,
      )}
      style={spotlight ? { ...style, backgroundImage: spotlight } : style}
      {...props}
    >
      {children}
    </div>
  );
}

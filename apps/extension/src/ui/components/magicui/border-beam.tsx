// Magic UI - https://magicui.design/docs/components/border-beam
import { useReducedMotion } from 'motion/react';
import { cn } from '../../lib/cn';

export interface BorderBeamProps {
  className?: string;
  colorFrom?: string;
  colorTo?: string;
}

export function BorderBeam({
  className,
  colorFrom = '#7c3aed',
  colorTo = '#a78bfa',
}: BorderBeamProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent',
        className,
      )}
      style={{
        background: `linear-gradient(var(--color-panel), var(--color-panel)) padding-box, linear-gradient(135deg, ${colorFrom}55, transparent 45%, ${colorTo}44) border-box`,
        opacity: prefersReducedMotion ? 0.5 : 0.85,
      }}
    />
  );
}

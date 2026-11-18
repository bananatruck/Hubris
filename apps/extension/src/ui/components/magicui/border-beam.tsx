// Magic UI - https://magicui.design/docs/components/border-beam
import type { CSSProperties } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '../../lib/cn';

export interface BorderBeamProps {
  className?: string;
  colorFrom?: string;
  colorTo?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
}

const borderRingMask: CSSProperties = {
  maskImage:
    'linear-gradient(transparent, transparent), linear-gradient(#000, #000)',
  WebkitMaskImage:
    'linear-gradient(transparent, transparent), linear-gradient(#000, #000)',
  maskClip: 'padding-box, border-box',
  WebkitMaskClip: 'padding-box, border-box',
  maskComposite: 'intersect',
  WebkitMaskComposite: 'source-in',
};

export function BorderBeam({
  className,
  colorFrom = '#7c3aed',
  colorTo = '#a78bfa',
  size = 60,
  duration = 8,
  borderWidth = 1,
}: BorderBeamProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent',
          className,
        )}
        style={{
          ...borderRingMask,
          borderWidth,
          background: `linear-gradient(var(--color-panel), var(--color-panel)) padding-box, linear-gradient(135deg, ${colorFrom}44, ${colorTo}33) border-box`,
        }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent',
        className,
      )}
      style={{
        ...borderRingMask,
        borderWidth,
      }}
    >
      <div
        className="absolute aspect-square bg-gradient-to-l from-[var(--beam-from)] via-[var(--beam-to)] to-transparent"
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            animation: `hubris-border-beam ${duration}s linear infinite`,
            '--beam-from': colorFrom,
            '--beam-to': colorTo,
          } as CSSProperties
        }
      />
    </div>
  );
}
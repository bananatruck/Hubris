// Magic UI - https://magicui.design/docs/components/animated-circular-progress-bar
import { useReducedMotion } from 'motion/react';
import { cn } from '../../lib/cn';

export interface OrbitArc {
  id: string;
  label: string;
  score: number | null;
  color: string;
  trackColor?: string;
  strokeWidth: number;
  radius: number;
}

export interface AnimatedCircularProgressBarProps {
  overallScore: number;
  statusWord: string;
  arcs: readonly OrbitArc[];
  showArcLabels?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function AnimatedCircularProgressBar({
  overallScore,
  statusWord,
  arcs,
  showArcLabels = false,
  className,
  children,
}: AnimatedCircularProgressBarProps) {
  const prefersReducedMotion = useReducedMotion();
  const size = 204;
  const center = size / 2;
  const roundedOverall = Math.round(overallScore);

  const ariaSummary = `Overall weekly score ${roundedOverall}, ${statusWord}. ${arcs
    .map((arc) => `${arc.label}: ${arc.score === null ? 'no activities yet' : Math.round(arc.score)}`)
    .join(', ')}.`;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center select-none', className)}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        role="img"
        aria-label={ariaSummary}
      >
        {arcs.map((arc) => {
          const circumference = 2 * Math.PI * arc.radius;
          const clamped = arc.score === null ? 0 : Math.max(0, Math.min(100, arc.score));
          const dashOffset = circumference - (clamped / 100) * circumference;

          return (
            <g key={arc.id}>
              <circle
                cx={center}
                cy={center}
                r={arc.radius}
                fill="none"
                stroke={arc.trackColor ?? 'rgba(255, 255, 255, 0.07)'}
                strokeWidth={arc.strokeWidth}
              />
              {clamped > 0 && (
                <circle
                  cx={center}
                  cy={center}
                  r={arc.radius}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={arc.strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  style={{
                    transition: prefersReducedMotion
                      ? 'none'
                      : 'stroke-dashoffset 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                  transform={`rotate(-90 ${center} ${center})`}
                />
              )}
              {showArcLabels && arc.score !== null && (
                <text
                  x={center - 8}
                  y={center - arc.radius + 3}
                  textAnchor="end"
                  fill={arc.color}
                  fontSize="10"
                  fontWeight="600"
                >
                  {Math.round(arc.score)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        {children}
      </div>
    </div>
  );
}

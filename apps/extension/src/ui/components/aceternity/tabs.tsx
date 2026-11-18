// Aceternity UI - https://ui.aceternity.com/components/tabs
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface AceternityTabItem {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface AceternityTabsProps {
  value: string;
  onValueChange: (value: string) => void;
  items: readonly AceternityTabItem[];
  layoutId?: string;
  ariaLabel: string;
  className?: string;
}

export const TabsRoot = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function AceternityTabBar({
  value,
  onValueChange,
  items,
  layoutId = 'hubris-nav-tab',
  ariaLabel,
  className,
}: AceternityTabsProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <TabsPrimitive.List
      aria-label={ariaLabel}
      className={cn(
        'grid grid-cols-4 gap-1 bg-panel/95 border-t border-line px-2 py-1.5 backdrop-blur-md',
        className,
      )}
    >
      {items.map((item) => {
        const isActive = value === item.value;
        return (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            onClick={() => onValueChange(item.value)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 px-2 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-1 focus-visible:ring-offset-ink',
              isActive ? 'text-accent-soft' : 'text-muted hover:text-text',
            )}
          >
            {isActive && (
              <motion.span
                layoutId={prefersReducedMotion ? undefined : layoutId}
                aria-hidden="true"
                className="absolute inset-0 rounded-lg bg-accent/15 border border-accent/30"
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: 'spring', bounce: 0.15, duration: 0.35 }
                }
              />
            )}
            {item.icon && <span className="relative z-10" aria-hidden="true">{item.icon}</span>}
            <span className="relative z-10">{item.label}</span>
          </TabsPrimitive.Trigger>
        );
      })}
    </TabsPrimitive.List>
  );
}

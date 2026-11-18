// 21st.dev - https://21st.dev/shadcn/dialog
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export interface DialogContentProps
  extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  title: string;
  description?: string;
  children: ReactNode;
}

export function DialogContent({
  title,
  description,
  children,
  className,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/80 backdrop-blur-xs" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-[356px] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-panel p-4 text-text shadow-2xl focus:outline-none',
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-2 pb-2">
          <div className="space-y-1">
            <DialogPrimitive.Title className="font-display text-base font-semibold text-text">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description
              className={cn('text-xs text-muted', !description && 'sr-only')}
            >
              {description ?? title}
            </DialogPrimitive.Description>
          </div>
          <DialogPrimitive.Close
            aria-label="Close dialog"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

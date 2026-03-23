'use client';

import { useState, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tooltip — hover tooltip using CSS positioning (no dependency)
//
// Usage:
//   <Tooltip content="This is a tooltip">
//     <button>Hover me</button>
//   </Tooltip>
//   <Tooltip content="Right aligned" position="right">
//     <span>Info</span>
//   </Tooltip>
// ---------------------------------------------------------------------------

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const POSITION_CLASSES = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
} as const;

export function Tooltip({ content, children, position = 'top', className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const show = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(true), 200);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-50 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium',
            'bg-slate-900 text-white shadow-lg dark:bg-slate-700',
            'animate-in fade-in-0 zoom-in-95',
            POSITION_CLASSES[position],
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

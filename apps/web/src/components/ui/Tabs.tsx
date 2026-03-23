'use client';

import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tabs — pill-style toggle group for filtering/switching views
//
// Usage:
//   <Tabs
//     value={activeTab}
//     onChange={setActiveTab}
//     items={[
//       { value: 'all', label: 'All', count: 42 },
//       { value: 'active', label: 'Active', count: 10 },
//       { value: 'completed', label: 'Completed' },
//     ]}
//   />
// ---------------------------------------------------------------------------

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  items: TabItem[];
  className?: string;
  size?: 'sm' | 'md';
}

export function Tabs({ value, onChange, items, className, size = 'md' }: TabsProps) {
  return (
    <div className={cn('inline-flex rounded-lg bg-[var(--color-bg-secondary)] p-1', className)}>
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === item.value
              ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
              : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]',
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span
              className={cn(
                'rounded-full px-1.5 text-[10px] font-semibold',
                value === item.value
                  ? 'bg-[var(--color-brand-500)]/10 text-[var(--color-brand-500)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]',
              )}
            >
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

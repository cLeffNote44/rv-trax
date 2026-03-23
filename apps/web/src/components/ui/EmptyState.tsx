import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// EmptyState — placeholder for empty data views
//
// Usage:
//   <EmptyState
//     icon={Package}
//     title="No units found"
//     description="Add your first unit to get started"
//     action={{ label: "Add Unit", onClick: () => {} }}
//   />
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('py-16 text-center', className)}>
      <Icon className="mx-auto h-12 w-12 text-[var(--color-text-tertiary)]" />
      <p className="mt-3 text-sm font-medium text-[var(--color-text-secondary)]">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand-600)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brand-700)]"
        >
          {action.label}
        </button>
      )}
      {children}
    </div>
  );
}

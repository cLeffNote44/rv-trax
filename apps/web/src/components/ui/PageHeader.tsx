import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// PageHeader — consistent page header with icon, title, description, actions
//
// Usage:
//   <PageHeader
//     icon={Package}
//     title="Inventory"
//     description="Manage your RV units"
//     badge={<Badge>{count}</Badge>}
//     backHref="/dashboard"
//     actions={<Button>Add Unit</Button>}
//   />
// ---------------------------------------------------------------------------

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  badge?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  badge,
  backHref,
  backLabel = 'Back',
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            {Icon && <Icon className="h-7 w-7 text-[var(--color-brand-500)]" />}
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{title}</h1>
            {badge}
          </div>
          {description && (
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

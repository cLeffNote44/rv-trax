import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// AlertBanner — contextual feedback banners (error, success, warning, info)
//
// Usage:
//   <AlertBanner variant="error" message="Something went wrong" onRetry={refetch} />
//   <AlertBanner variant="success" message="Saved successfully" />
//   <AlertBanner variant="warning">Custom content here</AlertBanner>
// ---------------------------------------------------------------------------

const VARIANT_CONFIG = {
  error: {
    icon: XCircle,
    border: 'border-red-200 dark:border-red-800',
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-400',
    iconColor: 'text-red-600',
    buttonBg: 'bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:text-red-300',
  },
  success: {
    icon: CheckCircle2,
    border: 'border-green-200 dark:border-green-800',
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-400',
    iconColor: 'text-green-600',
    buttonBg: 'bg-green-100 hover:bg-green-200 dark:bg-green-800 dark:text-green-300',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-200 dark:border-amber-800',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-400',
    iconColor: 'text-amber-600',
    buttonBg: 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-800 dark:text-amber-300',
  },
  info: {
    icon: Info,
    border: 'border-blue-200 dark:border-blue-800',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-400',
    iconColor: 'text-blue-600',
    buttonBg: 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-300',
  },
} as const;

interface AlertBannerProps {
  variant?: keyof typeof VARIANT_CONFIG;
  message?: string;
  children?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
  className?: string;
}

export function AlertBanner({
  variant = 'error',
  message,
  children,
  onRetry,
  retryLabel = 'Retry',
  onDismiss,
  className,
}: AlertBannerProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-4',
        config.border,
        config.bg,
        className,
      )}
    >
      <Icon className={cn('h-5 w-5 flex-shrink-0', config.iconColor)} />
      <p className={cn('flex-1 text-sm', config.text)}>{message ?? children}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            config.buttonBg,
          )}
        >
          {retryLabel}
        </button>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={cn('rounded p-1 transition-colors', config.buttonBg)}
          aria-label="Dismiss"
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

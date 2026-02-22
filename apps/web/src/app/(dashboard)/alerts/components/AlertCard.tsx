'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Alert } from '@rv-trax/shared';
import { AlertSeverity, AlertStatus } from '@rv-trax/shared';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface AlertCardProps {
  alert: Alert;
  onAcknowledge: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
  onSnooze: (alertId: string, hours: number) => void;
}

const severityConfig: Record<
  string,
  { icon: ReactNode; border: string; bg: string; text: string }
> = {
  [AlertSeverity.CRITICAL]: {
    icon: (
      <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    ),
    border: 'border-l-red-500',
    bg: 'bg-red-50 dark:bg-red-950/20',
    text: 'text-red-700 dark:text-red-400',
  },
  [AlertSeverity.WARNING]: {
    icon: (
      <svg
        className="h-5 w-5 text-amber-600"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    ),
    border: 'border-l-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    text: 'text-amber-700 dark:text-amber-400',
  },
  [AlertSeverity.INFO]: {
    icon: (
      <svg
        className="h-5 w-5 text-blue-600"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
          clipRule="evenodd"
        />
      </svg>
    ),
    border: 'border-l-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    text: 'text-blue-700 dark:text-blue-400',
  },
};

export function AlertCard({
  alert,
  onAcknowledge,
  onDismiss,
  onSnooze,
}: AlertCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = severityConfig[alert.severity] ?? severityConfig[AlertSeverity.INFO]!;
  const isAcknowledged = alert.status === AlertStatus.ACKNOWLEDGED;
  const isDismissed = alert.status === AlertStatus.DISMISSED;
  const isSnoozed = alert.status === AlertStatus.SNOOZED;

  return (
    <Card
      className={cn(
        'border-l-4 transition-colors',
        config.border,
        (isAcknowledged || isDismissed) && 'opacity-60'
      )}
    >
      <div
        className="cursor-pointer p-4"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">{config.icon}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className={cn('font-medium', config.text)}>{alert.title}</h4>
              <span className="shrink-0 text-xs text-[var(--color-text-tertiary)]">
                {formatRelativeTime(alert.created_at)}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              {alert.message}
            </p>
            <div className="mt-2 flex items-center gap-3">
              {alert.unit_id && (
                <a
                  href={`/inventory/${alert.unit_id}`}
                  className="text-xs font-medium text-[var(--color-brand-600)] hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View Unit
                </a>
              )}
              {isAcknowledged && (
                <span className="text-xs text-green-600">
                  Acknowledged
                  {alert.acknowledged_at &&
                    ` ${formatRelativeTime(alert.acknowledged_at)}`}
                </span>
              )}
              {isSnoozed && alert.snoozed_until && (
                <span className="text-xs text-amber-600">
                  Snoozed until{' '}
                  {new Date(alert.snoozed_until).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Actions */}
      {expanded && !isDismissed && (
        <div className="flex items-center gap-2 border-t border-[var(--color-border)] px-4 py-3">
          {!isAcknowledged && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onAcknowledge(alert.id);
              }}
            >
              Acknowledge
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(alert.id);
            }}
          >
            Dismiss
          </Button>
          <div onClick={(e) => e.stopPropagation()}>
            <select
              className="h-8 w-32 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-xs text-[var(--color-text-primary)]"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onSnooze(alert.id, parseInt(e.target.value, 10));
                  e.target.value = '';
                }
              }}
            >
              <option value="" disabled>Snooze...</option>
              <option value="1">Snooze 1h</option>
              <option value="4">Snooze 4h</option>
              <option value="24">Snooze 24h</option>
            </select>
          </div>
        </div>
      )}
    </Card>
  );
}

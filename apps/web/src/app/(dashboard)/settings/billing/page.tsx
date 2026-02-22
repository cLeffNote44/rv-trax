'use client';

import { useEffect, useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';
import type { BillingInfo, Invoice } from '@rv-trax/shared';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { getBillingOverview, getInvoices } from '@/lib/api';

const tierLabels: Record<string, string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

const tierColors: Record<string, string> = {
  starter: 'bg-gray-100 text-gray-800',
  professional: 'bg-blue-100 text-blue-800',
  enterprise: 'bg-purple-100 text-purple-800',
};

const statusVariant: Record<string, 'success' | 'info' | 'error' | 'default'> = {
  active: 'success',
  past_due: 'error',
  cancelled: 'error',
  restricted: 'warning' as 'error',
};

const invoiceStatusVariant: Record<string, 'success' | 'info' | 'default'> = {
  paid: 'success',
  open: 'info',
  draft: 'default',
};

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-100', className)} />;
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [billingData, invoiceData] = await Promise.all([
          getBillingOverview(),
          getInvoices(),
        ]);
        if (!cancelled) {
          setBilling(billingData);
          setInvoices(invoiceData);
        }
      } catch {
        // Keep loading state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const unitPct = billing ? Math.min(100, Math.round((billing.unit_count / billing.unit_limit) * 100)) : 0;
  const lotPct = billing ? Math.min(100, Math.round((billing.lot_count / billing.lot_limit) * 100)) : 0;
  const showUpgrade = billing && billing.subscription_tier !== 'enterprise';

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <a
          href="/settings"
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          Settings
        </a>
        <span className="text-[var(--color-text-tertiary)]">/</span>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Billing &amp; Subscription
        </h1>
      </div>

      {/* Current Plan Card */}
      {loading ? (
        <Card>
          <CardContent className="space-y-4 py-6">
            <SkeletonBlock className="h-6 w-48" />
            <SkeletonBlock className="h-4 w-64" />
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-full" />
          </CardContent>
        </Card>
      ) : billing ? (
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <Badge variant={statusVariant[billing.subscription_status] ?? 'default'}>
              {billing.subscription_status === 'past_due'
                ? 'Past Due'
                : billing.subscription_status.charAt(0).toUpperCase() +
                  billing.subscription_status.slice(1)}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold',
                  tierColors[billing.subscription_tier] ?? 'bg-gray-100 text-gray-800'
                )}
              >
                {tierLabels[billing.subscription_tier] ?? billing.subscription_tier}
              </span>
              {billing.current_period_end && (
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Renews {formatDate(billing.current_period_end)}
                </span>
              )}
            </div>

            {/* Usage - Units */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Units</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {billing.unit_count} / {billing.unit_limit}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    unitPct > 90 ? 'bg-red-500' : unitPct > 70 ? 'bg-amber-500' : 'bg-blue-500'
                  )}
                  style={{ width: `${unitPct}%` }}
                />
              </div>
            </div>

            {/* Usage - Lots */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Lots</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {billing.lot_count} / {billing.lot_limit}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    lotPct > 90 ? 'bg-red-500' : lotPct > 70 ? 'bg-amber-500' : 'bg-blue-500'
                  )}
                  style={{ width: `${lotPct}%` }}
                />
              </div>
            </div>

            {showUpgrade && (
              <Button className="mt-2">Upgrade Plan</Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <CreditCard className="h-12 w-12 text-[var(--color-text-tertiary)]" />
              <p className="text-sm text-[var(--color-text-secondary)]">
                No invoices yet
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Paid Date
                    </th>
                    <th className="px-6 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-[var(--color-border)] last:border-0"
                    >
                      <td className="px-6 py-3 text-[var(--color-text-primary)]">
                        {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                      </td>
                      <td className="px-6 py-3 font-medium text-[var(--color-text-primary)]">
                        {formatCurrency(invoice.amount_cents / 100)}
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={invoiceStatusVariant[invoice.status] ?? 'default'}>
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-[var(--color-text-secondary)]">
                        {invoice.paid_at ? formatDate(invoice.paid_at) : '--'}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {invoice.hosted_invoice_url ? (
                          <a
                            href={invoice.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
                          >
                            View Invoice
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-[var(--color-text-tertiary)]">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

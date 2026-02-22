'use client';

import Link from 'next/link';
import { Wrench, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useApi } from '@/hooks/useApi';
import { getWorkOrders, getRecalls } from '@/lib/api';

export default function ServicePage() {
  const { data: workOrderData } = useApi(
    () => getWorkOrders({ status: 'pending' }),
    []
  );
  const { data: recallData } = useApi(
    () => getRecalls({ status: 'open' }),
    []
  );

  const openWorkOrderCount = workOrderData?.pagination.total_count ?? 0;
  const activeRecallCount = recallData?.pagination.total_count ?? 0;

  const links = [
    {
      href: '/service/work-orders',
      title: 'Work Orders',
      description: 'Manage PDI, repairs, detail, and other service work orders for your units.',
      icon: <Wrench className="h-6 w-6" />,
      count: openWorkOrderCount,
      countLabel: 'open',
    },
    {
      href: '/service/recalls',
      title: 'Recalls',
      description: 'Track manufacturer recalls and manage affected units in your inventory.',
      icon: <AlertTriangle className="h-6 w-6" />,
      count: activeRecallCount,
      countLabel: 'active',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
        Service
      </h1>

      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <Link key={link.title} href={link.href}>
            <Card className="group h-full cursor-pointer p-5 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="mb-3 text-[var(--color-text-secondary)] transition-colors group-hover:text-[var(--color-brand-600)]">
                  {link.icon}
                </div>
                {link.count > 0 && (
                  <Badge variant="info">
                    {link.count} {link.countLabel}
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-[var(--color-text-primary)]">
                {link.title}
              </h3>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {link.description}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

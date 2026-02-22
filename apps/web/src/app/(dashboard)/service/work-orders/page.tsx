'use client';

import { useState, useCallback } from 'react';
import { Wrench, Plus, Clock, User, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useApi } from '@/hooks/useApi';
import { getWorkOrders, createWorkOrder, updateWorkOrder } from '@/lib/api';
import { formatDate, formatStatus, cn } from '@/lib/utils';
import type { WorkOrder } from '@rv-trax/shared';

const STATUS_TABS = ['all', 'pending', 'assigned', 'in_progress', 'complete'] as const;

const statusColors: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-800',
  assigned: 'bg-indigo-100 text-indigo-800',
  in_progress: 'bg-amber-100 text-amber-800',
  complete: 'bg-green-100 text-green-800',
  blocked: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-100 text-blue-700',
  urgent: 'bg-red-100 text-red-700',
};

const typeOptions = [
  { value: 'pdi', label: 'PDI' },
  { value: 'winterize', label: 'Winterize' },
  { value: 'dewinterize', label: 'Dewinterize' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'recall', label: 'Recall' },
  { value: 'customer_repair', label: 'Customer Repair' },
  { value: 'detail', label: 'Detail' },
  { value: 'other', label: 'Other' },
];

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgent' },
];

function getNextStatus(current: string): string | null {
  const transitions: Record<string, string> = {
    pending: 'assigned',
    assigned: 'in_progress',
    in_progress: 'complete',
  };
  return transitions[current] ?? null;
}

export default function WorkOrdersPage() {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formUnitId, setFormUnitId] = useState('');
  const [formType, setFormType] = useState('pdi');
  const [formPriority, setFormPriority] = useState('normal');
  const [formAssignedTo, setFormAssignedTo] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formDueDate, setFormDueDate] = useState('');

  const statusQuery = activeTab === 'all' ? undefined : activeTab;
  const { data, isLoading, refetch } = useApi(
    () => getWorkOrders({ status: statusQuery }),
    [statusQuery]
  );

  const workOrders = data?.data ?? [];

  const resetForm = useCallback(() => {
    setFormUnitId('');
    setFormType('pdi');
    setFormPriority('normal');
    setFormAssignedTo('');
    setFormNotes('');
    setFormDueDate('');
  }, []);

  const handleCreate = useCallback(async () => {
    if (!formUnitId.trim()) return;
    setSubmitting(true);
    try {
      await createWorkOrder({
        unit_id: formUnitId.trim(),
        order_type: formType as WorkOrder['order_type'],
        priority: formPriority as WorkOrder['priority'],
        assigned_to: formAssignedTo.trim() || null,
        notes: formNotes.trim() || null,
        due_date: formDueDate || null,
      });
      setCreateOpen(false);
      resetForm();
      refetch();
    } catch {
      // Error handled by API layer
    } finally {
      setSubmitting(false);
    }
  }, [formUnitId, formType, formPriority, formAssignedTo, formNotes, formDueDate, resetForm, refetch]);

  const handleStatusTransition = useCallback(
    async (wo: WorkOrder) => {
      const next = getNextStatus(wo.status);
      if (!next) return;
      try {
        await updateWorkOrder(wo.id, { status: next as WorkOrder['status'] });
        refetch();
      } catch {
        // Error handled by API layer
      }
    },
    [refetch]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Work Orders
        </h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Work Order
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab
                ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            )}
          >
            {formatStatus(tab)}
          </button>
        ))}
      </div>

      {/* Work Orders List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : workOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] py-16">
          <Wrench className="mb-3 h-10 w-10 text-[var(--color-text-tertiary)]" />
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            No work orders found
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            Create a work order to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workOrders.map((wo) => {
            const nextStatus = getNextStatus(wo.status);
            return (
              <Card key={wo.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-3">
                  {/* Type + Priority + Status badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                        statusColors[wo.status] ?? 'bg-gray-100 text-gray-800'
                      )}
                    >
                      {formatStatus(wo.status)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                      {formatStatus(wo.order_type)}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                        priorityColors[wo.priority] ?? 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {formatStatus(wo.priority)}
                    </span>
                  </div>

                  {/* Unit ID */}
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    Unit: {wo.unit_id}
                  </p>

                  {/* Notes preview */}
                  {wo.notes && (
                    <p className="line-clamp-2 text-sm text-[var(--color-text-secondary)]">
                      {wo.notes}
                    </p>
                  )}

                  {/* Meta info */}
                  <div className="mt-auto space-y-1.5 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-tertiary)]">
                    {wo.assigned_to && (
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        <span>{wo.assigned_to}</span>
                      </div>
                    )}
                    {wo.due_date && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Due {formatDate(wo.due_date)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Created {formatDate(wo.created_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {nextStatus && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusTransition(wo)}
                    >
                      Move to {formatStatus(nextStatus)}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          resetForm();
        }}
        title="Create Work Order"
        description="Fill in the details to create a new work order."
      >
        <div className="space-y-4">
          <Input
            label="Unit Stock #"
            placeholder="e.g. STK-001"
            value={formUnitId}
            onChange={(e) => setFormUnitId(e.target.value)}
          />
          <Select
            label="Order Type"
            options={typeOptions}
            value={formType}
            onChange={(e) => setFormType(e.target.value)}
          />
          <Select
            label="Priority"
            options={priorityOptions}
            value={formPriority}
            onChange={(e) => setFormPriority(e.target.value)}
          />
          <Input
            label="Assigned To"
            placeholder="Name or ID"
            value={formAssignedTo}
            onChange={(e) => setFormAssignedTo(e.target.value)}
          />
          <Input
            label="Due Date"
            type="date"
            value={formDueDate}
            onChange={(e) => setFormDueDate(e.target.value)}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">
              Notes
            </label>
            <textarea
              className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
              placeholder="Additional notes..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              isLoading={submitting}
              disabled={!formUnitId.trim()}
            >
              Create
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

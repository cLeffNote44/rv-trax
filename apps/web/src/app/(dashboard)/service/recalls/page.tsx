'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle, Plus, Clock, Tag, Hash, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { useApi } from '@/hooks/useApi';
import { getRecalls, createRecall } from '@/lib/api';
import { formatDate, formatStatus, cn } from '@/lib/utils';
import type { Recall } from '@rv-trax/shared';

const STATUS_TABS = ['all', 'open', 'in_progress', 'closed'] as const;

const statusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-800',
  in_progress: 'bg-amber-100 text-amber-800',
  closed: 'bg-green-100 text-green-800',
};

export default function RecallsPage() {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMakes, setFormMakes] = useState('');
  const [formModels, setFormModels] = useState('');
  const [formYearStart, setFormYearStart] = useState('');
  const [formYearEnd, setFormYearEnd] = useState('');

  const statusQuery = activeTab === 'all' ? undefined : activeTab;
  const { data, isLoading, refetch } = useApi(
    () => getRecalls({ status: statusQuery }),
    [statusQuery]
  );

  const recalls = data?.data ?? [];

  const resetForm = useCallback(() => {
    setFormTitle('');
    setFormDescription('');
    setFormMakes('');
    setFormModels('');
    setFormYearStart('');
    setFormYearEnd('');
  }, []);

  const handleCreate = useCallback(async () => {
    if (!formTitle.trim()) return;
    setSubmitting(true);
    try {
      await createRecall({
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        affected_makes: formMakes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        affected_models: formModels
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        affected_year_start: formYearStart ? Number(formYearStart) : null,
        affected_year_end: formYearEnd ? Number(formYearEnd) : null,
      });
      setCreateOpen(false);
      resetForm();
      refetch();
    } catch {
      // Error handled by API layer
    } finally {
      setSubmitting(false);
    }
  }, [formTitle, formDescription, formMakes, formModels, formYearStart, formYearEnd, resetForm, refetch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Recalls
        </h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Recall
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

      {/* Recalls List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : recalls.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] py-16">
          <AlertTriangle className="mb-3 h-10 w-10 text-[var(--color-text-tertiary)]" />
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            No recalls found
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            Create a recall to start tracking affected units.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recalls.map((recall) => (
            <Card key={recall.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3">
                {/* Status badge */}
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                      statusColors[recall.status] ?? 'bg-gray-100 text-gray-800'
                    )}
                  >
                    {formatStatus(recall.status)}
                  </span>
                  {recall.matched_unit_count > 0 && (
                    <Badge variant="warning">
                      {recall.matched_unit_count} unit{recall.matched_unit_count !== 1 ? 's' : ''} affected
                    </Badge>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {recall.title}
                </h3>

                {/* Description */}
                {recall.description && (
                  <p className="line-clamp-2 text-sm text-[var(--color-text-secondary)]">
                    {recall.description}
                  </p>
                )}

                {/* Affected Makes/Models/Years */}
                <div className="mt-auto space-y-1.5 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-tertiary)]">
                  {recall.affected_makes.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" />
                      <span>{recall.affected_makes.join(', ')}</span>
                    </div>
                  )}
                  {recall.affected_models.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5" />
                      <span>{recall.affected_models.join(', ')}</span>
                    </div>
                  )}
                  {(recall.affected_year_start || recall.affected_year_end) && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        Years: {recall.affected_year_start ?? '...'} - {recall.affected_year_end ?? '...'}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Created {formatDate(recall.created_at)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          resetForm();
        }}
        title="Create Recall"
        description="Enter recall details to start tracking affected units."
      >
        <div className="space-y-4">
          <Input
            label="Title"
            placeholder="e.g. Frame Weld Recall #2024-001"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">
              Description
            </label>
            <textarea
              className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
              placeholder="Describe the recall..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
            />
          </div>
          <Input
            label="Affected Makes"
            placeholder="e.g. Forest River, Keystone"
            hint="Comma-separated list"
            value={formMakes}
            onChange={(e) => setFormMakes(e.target.value)}
          />
          <Input
            label="Affected Models"
            placeholder="e.g. Wildwood, Cougar"
            hint="Comma-separated list"
            value={formModels}
            onChange={(e) => setFormModels(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Year Start"
              type="number"
              placeholder="e.g. 2020"
              value={formYearStart}
              onChange={(e) => setFormYearStart(e.target.value)}
            />
            <Input
              label="Year End"
              type="number"
              placeholder="e.g. 2024"
              value={formYearEnd}
              onChange={(e) => setFormYearEnd(e.target.value)}
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
              disabled={!formTitle.trim()}
            >
              Create
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

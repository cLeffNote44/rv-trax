'use client';

import { useState, useCallback } from 'react';
import { LayoutGrid, Plus, CheckCircle, ArrowRight, Copy, Eye, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApi } from '@/hooks/useApi';
import {
  getLots,
  getStagingPlans,
  createStagingPlan,
  activateStagingPlan,
  getComplianceScore,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import type { MoveListItem, ComplianceScore } from '@rv-trax/shared';

export default function StagingPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [moveList, setMoveList] = useState<MoveListItem[]>([]);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formLotId, setFormLotId] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Compliance lot selection
  const [complianceLotId, setComplianceLotId] = useState('');

  const { data: lotsData } = useApi(() => getLots(), []);
  const lots = lotsData ?? [];

  const { data: plansData, isLoading, refetch } = useApi(() => getStagingPlans(), []);
  const plans = plansData?.data ?? [];

  const { data: compliance } = useApi(
    () =>
      complianceLotId
        ? getComplianceScore(complianceLotId)
        : Promise.resolve(null as unknown as ComplianceScore),
    [complianceLotId],
  );

  // Auto-select first lot for compliance if available
  const effectiveLotId = complianceLotId || (lots.length > 0 ? lots[0]!.id : '');
  const displayCompliance = complianceLotId ? compliance : null;

  // Set default compliance lot once lots load
  if (!complianceLotId && lots.length > 0 && lots[0]) {
    // Use a microtask to avoid setting state during render
    queueMicrotask(() => setComplianceLotId(lots[0]!.id));
  }

  const lotOptions = lots.map((l) => ({ value: l.id, label: l.name }));

  const resetForm = useCallback(() => {
    setFormName('');
    setFormLotId('');
    setFormDescription('');
  }, []);

  const handleCreate = useCallback(async () => {
    if (!formName.trim() || !formLotId) return;
    setSubmitting(true);
    try {
      await createStagingPlan({
        name: formName.trim(),
        lot_id: formLotId,
        description: formDescription.trim() || null,
      });
      setCreateOpen(false);
      resetForm();
      refetch();
    } catch {
      // Error handled by API layer
    } finally {
      setSubmitting(false);
    }
  }, [formName, formLotId, formDescription, resetForm, refetch]);

  const handleActivate = useCallback(
    async (planId: string) => {
      setActivatingId(planId);
      try {
        const result = await activateStagingPlan(planId);
        setMoveList(result.move_list);
        refetch();
      } catch {
        // Error handled by API layer
      } finally {
        setActivatingId(null);
      }
    },
    [refetch],
  );

  const scoreColor = (pct: number) =>
    pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = (pct: number) =>
    pct >= 80
      ? 'bg-green-50 border-green-200'
      : pct >= 50
        ? 'bg-amber-50 border-amber-200'
        : 'bg-red-50 border-red-200';

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={LayoutGrid}
        title="Lot Staging"
        description="Organize and optimize your lot layout"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Plan
          </Button>
        }
      />

      {/* Compliance Score Card */}
      {lots.length > 0 && (
        <Card
          className={cn('border', displayCompliance ? scoreBg(displayCompliance.score_pct) : '')}
        >
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Compliance Score
              </h2>
              {lots.length > 1 && (
                <div className="w-48">
                  <Select
                    options={lotOptions}
                    value={effectiveLotId}
                    onChange={(e) => setComplianceLotId(e.target.value)}
                  />
                </div>
              )}
            </div>

            {displayCompliance ? (
              <div className="space-y-3">
                <div className="flex items-baseline gap-3">
                  <span
                    className={cn('text-4xl font-bold', scoreColor(displayCompliance.score_pct))}
                  >
                    {displayCompliance.score_pct}%
                  </span>
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {displayCompliance.in_correct_zone} of {displayCompliance.total_tracked} units
                    in correct zone
                  </span>
                </div>

                {displayCompliance.out_of_place.length > 0 && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Out of Place Units
                    </p>
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-tertiary)]">
                            <th className="px-3 py-2">Stock #</th>
                            <th className="px-3 py-2">Expected</th>
                            <th className="px-3 py-2">Actual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayCompliance.out_of_place.map((u) => (
                            <tr
                              key={u.unit_id}
                              className="border-b border-[var(--color-border)] last:border-0"
                            >
                              <td className="px-3 py-1.5 font-medium text-[var(--color-text-primary)]">
                                {u.stock_number}
                              </td>
                              <td className="px-3 py-1.5 text-[var(--color-text-secondary)]">
                                {u.expected_row}
                              </td>
                              <td className="px-3 py-1.5 text-[var(--color-text-secondary)]">
                                {u.actual_row ?? 'Unknown'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                Select a lot to view compliance score.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Staging Plans */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No staging plans yet"
          description="Create a plan to organize your lot layout."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const lot = lots.find((l) => l.id === plan.lot_id);
            return (
              <Card key={plan.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {plan.name}
                    </h3>
                    <Badge variant="default">
                      {plan.assignments.length} assignment{plan.assignments.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>

                  {lot && (
                    <p className="text-xs text-[var(--color-text-tertiary)]">Lot: {lot.name}</p>
                  )}

                  {plan.description && (
                    <p className="line-clamp-2 text-sm text-[var(--color-text-secondary)]">
                      {plan.description}
                    </p>
                  )}

                  <div className="mt-auto flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      isLoading={activatingId === plan.id}
                      onClick={() => handleActivate(plan.id)}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Activate
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Copy className="h-3.5 w-3.5" />
                      Clone
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Move List (shown after activation) */}
      {moveList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Move List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-tertiary)]">
                    <th className="px-3 py-2">Stock #</th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2">From</th>
                    <th className="px-3 py-2"></th>
                    <th className="px-3 py-2">To</th>
                    <th className="px-3 py-2">Distance</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {moveList.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[var(--color-border)] last:border-0"
                    >
                      <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">
                        {item.stock_number}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                        {item.year} {item.make} {item.model}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                        {item.current_row ?? 'N/A'} / {item.current_spot ?? 'N/A'}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-tertiary)]">
                        <ArrowRight className="h-4 w-4" />
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                        {item.target_row} / {item.target_spot}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                        {item.distance_m}m
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            item.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : item.status === 'in_progress'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-700',
                          )}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Plan Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          resetForm();
        }}
        title="Create Staging Plan"
        description="Define a new staging plan for a lot."
      >
        <div className="space-y-4">
          <Input
            label="Plan Name"
            placeholder="e.g. Winter Layout 2026"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <Select
            label="Lot"
            options={lotOptions}
            placeholder="Select a lot"
            value={formLotId}
            onChange={(e) => setFormLotId(e.target.value)}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">
              Description
            </label>
            <textarea
              className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
              placeholder="Describe the staging plan..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
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
              disabled={!formName.trim() || !formLotId}
            >
              Create
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

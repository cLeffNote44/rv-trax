'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { SortingState, RowSelectionState } from '@tanstack/react-table';
import { Package, Plus, Upload, Download } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { getUnits, createUnit } from '@/lib/api';
import type { UnitsQuery } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { usePagination } from '@/hooks/usePagination';
import { UnitType } from '@rv-trax/shared';
import type { Unit, PaginatedResponse } from '@rv-trax/shared';

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog } from '@/components/ui/Dialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { PaginationControls } from '@/components/shared/PaginationControls';
import InventoryTable from './components/InventoryTable';
import InventoryFilters from './components/InventoryFilters';
import type { InventoryFilterValues } from './components/InventoryFilters';
import ImportWizard from './components/ImportWizard';

// ---------------------------------------------------------------------------
// Add Unit form schema
// ---------------------------------------------------------------------------

const addUnitSchema = z.object({
  stock_number: z.string().min(1, 'Stock number is required'),
  vin: z.string().optional(),
  year: z.coerce.number().min(1900, 'Invalid year').max(2100, 'Invalid year'),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  unit_type: z.string().min(1, 'Type is required'),
  floorplan: z.string().optional(),
  length_ft: z.coerce.number().positive('Must be positive').optional().or(z.literal('')),
  msrp: z.coerce.number().nonnegative('Must be non-negative').optional().or(z.literal('')),
});

type AddUnitFormData = z.infer<typeof addUnitSchema>;

// ---------------------------------------------------------------------------
// Unit type options for the select
// ---------------------------------------------------------------------------

const unitTypeOptions = [
  { value: UnitType.MOTORHOME, label: 'Motorhome' },
  { value: UnitType.FIFTH_WHEEL, label: 'Fifth Wheel' },
  { value: UnitType.TRAVEL_TRAILER, label: 'Travel Trailer' },
  { value: UnitType.TOY_HAULER, label: 'Toy Hauler' },
  { value: UnitType.TRUCK_CAMPER, label: 'Truck Camper' },
  { value: UnitType.POPUP, label: 'Pop-up' },
  { value: UnitType.VAN, label: 'Van' },
];

// ---------------------------------------------------------------------------
// API base for export link
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InventoryPage() {
  const searchParams = useSearchParams();

  // ---- Filter state initialised from URL search params ----
  const [filters, setFilters] = useState<InventoryFilterValues>(() => {
    const statusParam = searchParams.get('status');
    const searchParam = searchParams.get('search');
    const typeParam = searchParams.get('type');
    const makeParam = searchParams.get('make');
    return {
      search: searchParam ?? '',
      statuses: statusParam ? statusParam.split(',') : [],
      types: typeParam ? typeParam.split(',') : [],
      makes: makeParam ? makeParam.split(',') : [],
    };
  });

  // ---- Sorting state ----
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // ---- Pagination ----
  const pagination = usePagination(50);

  // ---- Build API query ----
  const apiQuery = useMemo<UnitsQuery>(() => {
    const q: UnitsQuery = {
      limit: pagination.pageSize,
    };
    if (pagination.cursor) {
      q.cursor = pagination.cursor;
    }
    if (filters.search) {
      q.search = filters.search;
    }
    if (filters.statuses.length > 0) {
      q.status = filters.statuses.join(',');
    }
    if (sorting.length > 0 && sorting[0]) {
      q.sort = sorting[0].id;
      q.order = sorting[0].desc ? 'desc' : 'asc';
    }
    return q;
  }, [pagination.cursor, pagination.pageSize, filters.search, filters.statuses, sorting]);

  // ---- Fetch units ----
  const {
    data: unitsResponse,
    isLoading,
    error,
    refetch,
  } = useApi<PaginatedResponse<Unit>>(() => getUnits(apiQuery), [JSON.stringify(apiQuery)]);

  // ---- Sync pagination info from response ----
  useEffect(() => {
    if (unitsResponse) {
      pagination.setPageInfo({
        hasMore: unitsResponse.pagination.has_more,
        totalCount: unitsResponse.pagination.total_count,
      });
    }
  }, [unitsResponse]);

  // Derive units and total count
  const units = unitsResponse?.data ?? [];
  const totalCount = unitsResponse?.pagination.total_count ?? 0;

  // ---- Available makes for filter (derived from current page, not ideal but pragmatic) ----
  const availableMakes = useMemo(() => {
    const makes = new Set<string>();
    units.forEach((u) => makes.add(u.make));
    return Array.from(makes).sort();
  }, [units]);

  // ---- Client-side filter for types and makes (API may not support multi-filter) ----
  const filteredUnits = useMemo(() => {
    let result = units;
    if (filters.types.length > 0) {
      result = result.filter((u) => filters.types.includes(u.unit_type));
    }
    if (filters.makes.length > 0) {
      result = result.filter((u) => filters.makes.includes(u.make));
    }
    return result;
  }, [units, filters.types, filters.makes]);

  // ---- Reset pagination when filters change ----
  const handleFiltersChange = useCallback(
    (newFilters: InventoryFilterValues) => {
      setFilters(newFilters);
      pagination.reset();
      setRowSelection({});
    },
    [pagination],
  );

  // ---- Reset pagination when sorting changes ----
  const handleSortingChange = useCallback(
    (newSorting: SortingState) => {
      setSorting(newSorting);
      pagination.reset();
    },
    [pagination],
  );

  // ---- Pagination handlers ----
  const handleNextPage = useCallback(() => {
    const nextCursor = unitsResponse?.pagination.next_cursor;
    if (nextCursor) {
      pagination.nextPage(nextCursor);
    }
  }, [unitsResponse, pagination]);

  // ---- Pagination display values ----
  const from = totalCount > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const to = Math.min(from + filteredUnits.length - 1, totalCount);

  // ---- Dialog states ----
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---- Add Unit form ----
  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors: formErrors },
  } = useForm<AddUnitFormData>({
    resolver: zodResolver(addUnitSchema),
    defaultValues: {
      stock_number: '',
      vin: '',
      year: new Date().getFullYear(),
      make: '',
      model: '',
      unit_type: '',
      floorplan: '',
      length_ft: '' as unknown as number,
      msrp: '' as unknown as number,
    },
  });

  const handleAddUnit = async (data: AddUnitFormData) => {
    setIsSubmitting(true);
    try {
      const payload: Partial<Unit> = {
        stock_number: data.stock_number,
        vin: data.vin || null,
        year: data.year,
        make: data.make,
        model: data.model,
        unit_type: data.unit_type as UnitType,
        floorplan: data.floorplan || null,
        length_ft: typeof data.length_ft === 'number' ? data.length_ft : null,
        msrp: typeof data.msrp === 'number' ? data.msrp : null,
      };
      await createUnit(payload);
      setAddDialogOpen(false);
      resetForm();
      refetch();
    } catch (err) {
      console.error('Failed to create unit:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseAddDialog = useCallback(() => {
    setAddDialogOpen(false);
    resetForm();
  }, [resetForm]);

  const handleImportComplete = useCallback(() => {
    refetch();
  }, [refetch]);

  // ---- Export ----
  const handleExport = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.statuses.length > 0) params.set('status', filters.statuses.join(','));
    const qs = params.toString();
    window.open(`${API_BASE}/units/export${qs ? `?${qs}` : ''}`, '_blank');
  }, [filters.search, filters.statuses]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={Package}
        title="Inventory"
        badge={<Badge variant="default">{totalCount}</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportWizardOpen(true)}>
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Unit
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <InventoryFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        availableMakes={availableMakes}
      />

      {/* Error state */}
      {error && (
        <AlertBanner
          variant="error"
          message={`Failed to load inventory: ${error}`}
          onRetry={refetch}
        />
      )}

      {/* Table */}
      <InventoryTable
        units={filteredUnits}
        loading={isLoading}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
      />

      {/* Pagination */}
      {totalCount > 0 && (
        <PaginationControls
          from={from}
          to={to}
          total={totalCount}
          hasMore={pagination.hasMore}
          hasPrevious={pagination.hasPrev}
          onPrevious={pagination.prevPage}
          onNext={handleNextPage}
        />
      )}

      {/* Add Unit Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={handleCloseAddDialog}
        title="Add New Unit"
        description="Enter details for the new inventory unit."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit(handleAddUnit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Stock Number *"
              {...register('stock_number')}
              error={formErrors.stock_number?.message}
              placeholder="e.g. STK-1234"
            />
            <Input
              label="VIN"
              {...register('vin')}
              error={formErrors.vin?.message}
              placeholder="17-character VIN"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Year *"
              type="number"
              {...register('year')}
              error={formErrors.year?.message}
            />
            <Input
              label="Make *"
              {...register('make')}
              error={formErrors.make?.message}
              placeholder="e.g. Winnebago"
            />
            <Input
              label="Model *"
              {...register('model')}
              error={formErrors.model?.message}
              placeholder="e.g. View 24D"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type *"
              options={unitTypeOptions}
              placeholder="Select type"
              {...register('unit_type')}
              error={formErrors.unit_type?.message}
            />
            <Input
              label="Floorplan"
              {...register('floorplan')}
              error={formErrors.floorplan?.message}
              placeholder="e.g. 24D"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Length (ft)"
              type="number"
              step="0.1"
              {...register('length_ft')}
              error={formErrors.length_ft?.message}
              placeholder="e.g. 24"
            />
            <Input
              label="MSRP"
              type="number"
              step="1"
              {...register('msrp')}
              error={formErrors.msrp?.message}
              placeholder="e.g. 85000"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-[var(--color-border)] pt-4">
            <Button type="button" variant="outline" onClick={handleCloseAddDialog}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Add Unit
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Import Wizard */}
      <ImportWizard
        open={importWizardOpen}
        onClose={() => setImportWizardOpen(false)}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}

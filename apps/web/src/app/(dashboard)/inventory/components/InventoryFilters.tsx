'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronDown, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UnitStatus, UnitType } from '@rv-trax/shared';

export interface InventoryFilterValues {
  search: string;
  statuses: string[];
  types: string[];
  makes: string[];
}

interface InventoryFiltersProps {
  filters: InventoryFilterValues;
  onFiltersChange: (filters: InventoryFilterValues) => void;
  availableMakes: string[];
}

const statusOptions = [
  { value: UnitStatus.NEW_ARRIVAL, label: 'New Arrival', color: 'bg-violet-500' },
  { value: UnitStatus.PDI_PENDING, label: 'PDI Pending', color: 'bg-orange-500' },
  { value: UnitStatus.PDI_IN_PROGRESS, label: 'PDI In Progress', color: 'bg-orange-400' },
  { value: UnitStatus.LOT_READY, label: 'Lot Ready', color: 'bg-cyan-500' },
  { value: UnitStatus.AVAILABLE, label: 'Available', color: 'bg-emerald-500' },
  { value: UnitStatus.HOLD, label: 'Hold', color: 'bg-yellow-500' },
  { value: UnitStatus.SHOWN, label: 'Shown', color: 'bg-blue-500' },
  { value: UnitStatus.DEPOSIT, label: 'Deposit', color: 'bg-indigo-500' },
  { value: UnitStatus.SOLD, label: 'Sold', color: 'bg-red-500' },
  { value: UnitStatus.PENDING_DELIVERY, label: 'Pending Delivery', color: 'bg-rose-500' },
  { value: UnitStatus.DELIVERED, label: 'Delivered', color: 'bg-slate-500' },
  { value: UnitStatus.IN_SERVICE, label: 'In Service', color: 'bg-amber-500' },
  { value: UnitStatus.WHOLESALE, label: 'Wholesale', color: 'bg-stone-500' },
  { value: UnitStatus.ARCHIVED, label: 'Archived', color: 'bg-slate-400' },
];

const typeOptions = [
  { value: UnitType.MOTORHOME, label: 'Motorhome' },
  { value: UnitType.FIFTH_WHEEL, label: 'Fifth Wheel' },
  { value: UnitType.TRAVEL_TRAILER, label: 'Travel Trailer' },
  { value: UnitType.TOY_HAULER, label: 'Toy Hauler' },
  { value: UnitType.TRUCK_CAMPER, label: 'Truck Camper' },
  { value: UnitType.POPUP, label: 'Pop-up' },
  { value: UnitType.VAN, label: 'Van' },
];

function DropdownMultiSelect({
  label,
  options,
  selected,
  onToggle,
  renderOption,
}: {
  label: string;
  options: { value: string; label: string; color?: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  renderOption?: (opt: { value: string; label: string; color?: string }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors',
          selected.length > 0
            ? 'border-blue-300 bg-blue-50 text-blue-700'
            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs text-white">
            {selected.length}
          </span>
        )}
        <ChevronDown className="ml-0.5 h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => onToggle(opt.value)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              {renderOption ? (
                renderOption(opt)
              ) : (
                <span>{opt.label}</span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InventoryFilters({
  filters,
  onFiltersChange,
  availableMakes,
}: InventoryFiltersProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (localSearch !== filters.search) {
        onFiltersChange({ ...filters, search: localSearch });
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localSearch, filters, onFiltersChange]);

  const toggleArrayFilter = (
    key: 'statuses' | 'types' | 'makes',
    value: string,
  ) => {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: next });
  };

  const activeFilterCount =
    filters.statuses.length + filters.types.length + filters.makes.length;

  const hasActiveFilters = activeFilterCount > 0 || filters.search.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search stock #, VIN, make, model..."
          className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-slate-400" />

        {/* Status filter */}
        <DropdownMultiSelect
          label="Status"
          options={statusOptions}
          selected={filters.statuses}
          onToggle={(v) => toggleArrayFilter('statuses', v)}
          renderOption={(opt) => (
            <span className="flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full', opt.color)} />
              {opt.label}
            </span>
          )}
        />

        {/* Type filter */}
        <DropdownMultiSelect
          label="Type"
          options={typeOptions}
          selected={filters.types}
          onToggle={(v) => toggleArrayFilter('types', v)}
        />

        {/* Make filter */}
        <DropdownMultiSelect
          label="Make"
          options={availableMakes.map((m) => ({ value: m, label: m }))}
          selected={filters.makes}
          onToggle={(v) => toggleArrayFilter('makes', v)}
        />

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() =>
              onFiltersChange({
                search: '',
                statuses: [],
                types: [],
                makes: [],
              })
            }
            className="flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <X className="h-3.5 w-3.5" />
            Clear
            {activeFilterCount > 0 && (
              <span className="text-xs text-red-400">({activeFilterCount})</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

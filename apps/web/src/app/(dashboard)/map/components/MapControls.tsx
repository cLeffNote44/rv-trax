'use client';

import { useState } from 'react';
import {
  Layers,
  Crosshair,
  ChevronDown,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UnitStatus, UnitType } from '@rv-trax/shared';

interface MapControlsProps {
  unitCount: number;
  mapStyle: 'satellite' | 'streets';
  onMapStyleChange: (style: 'satellite' | 'streets') => void;
  onCenterLot: () => void;
  filters: {
    status: string[];
    type: string[];
    make: string[];
  };
  onFiltersChange: (filters: {
    status: string[];
    type: string[];
    make: string[];
  }) => void;
  availableMakes: string[];
}

const statusOptions = [
  { value: UnitStatus.NEW_ARRIVAL, label: 'New Arrival' },
  { value: UnitStatus.PDI_PENDING, label: 'PDI Pending' },
  { value: UnitStatus.PDI_IN_PROGRESS, label: 'PDI In Progress' },
  { value: UnitStatus.LOT_READY, label: 'Lot Ready' },
  { value: UnitStatus.AVAILABLE, label: 'Available' },
  { value: UnitStatus.HOLD, label: 'Hold' },
  { value: UnitStatus.SHOWN, label: 'Shown' },
  { value: UnitStatus.DEPOSIT, label: 'Deposit' },
  { value: UnitStatus.SOLD, label: 'Sold' },
  { value: UnitStatus.IN_SERVICE, label: 'In Service' },
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

function MultiSelectDropdown({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
          selected.length > 0
            ? 'border-blue-300 bg-blue-50 text-blue-700'
            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">
            {selected.length}
          </span>
        )}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-1 max-h-60 w-48 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {options.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => onToggle(opt.value)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function MapControls({
  unitCount,
  mapStyle,
  onMapStyleChange,
  onCenterLot,
  filters,
  onFiltersChange,
  availableMakes,
}: MapControlsProps) {
  const toggleFilter = (
    key: 'status' | 'type' | 'make',
    value: string,
  ) => {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: next });
  };

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.type.length > 0 ||
    filters.make.length > 0;

  return (
    <div className="absolute left-4 top-4 z-10 flex flex-col gap-3">
      {/* Unit count + style toggle */}
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur-sm">
        <span className="text-sm font-semibold text-slate-900">
          {unitCount} units
        </span>
        <div className="mx-2 h-4 w-px bg-slate-200" />
        <button
          type="button"
          onClick={() =>
            onMapStyleChange(mapStyle === 'satellite' ? 'streets' : 'satellite')
          }
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          <Layers className="h-3.5 w-3.5" />
          {mapStyle === 'satellite' ? 'Streets' : 'Satellite'}
        </button>
        <button
          type="button"
          onClick={onCenterLot}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          <Crosshair className="h-3.5 w-3.5" />
          Center
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur-sm">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Filters
        </span>
        <MultiSelectDropdown
          label="Status"
          options={statusOptions}
          selected={filters.status}
          onToggle={(v) => toggleFilter('status', v)}
        />
        <MultiSelectDropdown
          label="Type"
          options={typeOptions}
          selected={filters.type}
          onToggle={(v) => toggleFilter('type', v)}
        />
        <MultiSelectDropdown
          label="Make"
          options={availableMakes.map((m) => ({ value: m, label: m }))}
          selected={filters.make}
          onToggle={(v) => toggleFilter('make', v)}
        />
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() =>
              onFiltersChange({ status: [], type: [], make: [] })
            }
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  X,
  Battery,
  Signal,
  MapPin,
  ExternalLink,
  Navigation,
  Pencil,
} from 'lucide-react';
import { cn, getStatusColor, formatRelativeTime } from '@/lib/utils';
import type { Unit, Tracker } from '@rv-trax/shared';

interface UnitSidePanelProps {
  unitId: string;
  onClose: () => void;
}

const statusLabels: Record<string, string> = {
  new_arrival: 'New Arrival',
  pdi_pending: 'PDI Pending',
  pdi_in_progress: 'PDI In Progress',
  lot_ready: 'Lot Ready',
  available: 'Available',
  hold: 'Hold',
  shown: 'Shown',
  deposit: 'Deposit',
  sold: 'Sold',
  pending_delivery: 'Pending Delivery',
  delivered: 'Delivered',
  in_service: 'In Service',
  wholesale: 'Wholesale',
  archived: 'Archived',
};

export default function UnitSidePanel({ unitId, onClose }: UnitSidePanelProps) {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchUnit() {
      setLoading(true);
      try {
        const api = await import('@/lib/api');
        const u = await api.getUnit(unitId);
        if (!cancelled) {
          setUnit(u);
        }
        // Try to fetch associated tracker
        try {
          const trackersRes = await api.getTrackers({ unit_id: unitId });
          if (!cancelled && trackersRes.data.length > 0) {
            setTracker(trackersRes.data[0]!);
          }
        } catch {
          // No tracker or failed
        }
      } catch {
        // Failed to load unit
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchUnit();
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  const getBatteryColor = (pct: number | null) => {
    if (pct == null) return 'bg-slate-300';
    if (pct > 50) return 'bg-emerald-500';
    if (pct > 20) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-[380px] flex-col border-l border-slate-200 bg-white shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Unit Details</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 space-y-4 p-4 animate-pulse">
          <div className="h-48 rounded-lg bg-slate-200" />
          <div className="h-6 w-2/3 rounded bg-slate-200" />
          <div className="h-4 w-1/2 rounded bg-slate-200" />
          <div className="space-y-2">
            <div className="h-4 rounded bg-slate-100" />
            <div className="h-4 rounded bg-slate-100" />
            <div className="h-4 rounded bg-slate-100" />
          </div>
        </div>
      ) : unit ? (
        <div className="flex-1 overflow-y-auto">
          {/* Photo */}
          <div className="relative h-48 bg-slate-100">
            {unit.thumbnail_url ? (
              <img
                src={unit.thumbnail_url}
                alt={`${unit.year} ${unit.make} ${unit.model}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-300">
                <MapPin className="h-16 w-16" />
              </div>
            )}
          </div>

          <div className="space-y-5 p-4">
            {/* Title + Status */}
            <div>
              <p className="text-xs font-medium text-slate-500">
                Stock #{unit.stock_number}
              </p>
              <h4 className="mt-0.5 text-lg font-bold text-slate-900">
                {unit.year} {unit.make} {unit.model}
              </h4>
              <span
                className={cn(
                  'mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                  getStatusColor(unit.status),
                )}
              >
                {statusLabels[unit.status] ?? unit.status}
              </span>
            </div>

            {/* Location */}
            <div>
              <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Location
              </h5>
              <div className="space-y-1.5">
                {unit.current_zone && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Zone</span>
                    <span className="font-medium text-slate-900">
                      {unit.current_zone}
                    </span>
                  </div>
                )}
                {unit.current_row && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Row</span>
                    <span className="font-medium text-slate-900">
                      {unit.current_row}
                    </span>
                  </div>
                )}
                {unit.current_spot && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Spot</span>
                    <span className="font-medium text-slate-900">
                      {unit.current_spot}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Tracker Info */}
            {tracker && (
              <div>
                <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Tracker
                </h5>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Device EUI</span>
                    <span className="font-mono text-xs font-medium text-slate-900">
                      {tracker.device_eui}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Battery className="h-3.5 w-3.5" />
                      Battery
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            getBatteryColor(tracker.battery_pct),
                          )}
                          style={{
                            width: `${tracker.battery_pct ?? 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-900">
                        {tracker.battery_pct ?? '--'}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Signal className="h-3.5 w-3.5" />
                      Last Seen
                    </span>
                    <span className="text-xs text-slate-700">
                      {tracker.last_seen_at
                        ? formatRelativeTime(tracker.last_seen_at)
                        : 'Never'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Links */}
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <Link
                href={`/inventory/${unit.id}`}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <ExternalLink className="h-4 w-4" />
                View Full Details
              </Link>
              {unit.current_lat != null && unit.current_lng != null && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${unit.current_lat},${unit.current_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Navigation className="h-4 w-4" />
                  Navigate
                </a>
              )}
              <Link
                href={`/inventory/${unit.id}?edit=true`}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" />
                Edit Unit
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          Unit not found
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getTrackers, createTracker } from '@/lib/api';
import type { Tracker, PaginatedResponse } from '@rv-trax/shared';
import { TrackerStatus } from '@rv-trax/shared';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { TrackerTable } from './components/TrackerTable';
import { BatteryDashboard } from './components/BatteryDashboard';
import { PaginationControls } from '@/components/shared/PaginationControls';

type FilterTab = 'all' | 'assigned' | 'unassigned' | 'low_battery' | 'offline' | 'retired';

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'low_battery', label: 'Low Battery' },
  { value: 'offline', label: 'Offline' },
  { value: 'retired', label: 'Retired' },
];

export default function TrackersPage() {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [page, setPage] = useState(0);

  // Register dialog state
  const [registerOpen, setRegisterOpen] = useState(false);
  const [newDeviceEui, setNewDeviceEui] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [registering, setRegistering] = useState(false);

  // Bulk register
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulkUploading, setBulkUploading] = useState(false);

  const fetchTrackers = useCallback(async () => {
    setLoading(true);
    try {
      const statusFilter = activeTab === 'all' ? undefined : activeTab;
      const response: PaginatedResponse<Tracker> = await getTrackers({
        status: statusFilter,
        cursor: cursors[page] ?? undefined,
      });
      setTrackers(response.data);
      setTotalCount(response.pagination.total_count);
      setHasMore(response.pagination.has_more);
      if (response.pagination.next_cursor && !cursors[page + 1]) {
        setCursors((prev) => {
          const next = [...prev];
          next[page + 1] = response.pagination.next_cursor;
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to fetch trackers:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, cursors, page]);

  useEffect(() => {
    fetchTrackers();
  }, [fetchTrackers]);

  // Reset pagination when tab changes
  useEffect(() => {
    setPage(0);
    setCursors([null]);
  }, [activeTab]);

  // Summary counts
  const summaryData = {
    total: totalCount,
    assigned: trackers.filter((t) => t.status === TrackerStatus.ASSIGNED).length,
    unassigned: trackers.filter((t) => t.status === TrackerStatus.UNASSIGNED).length,
    lowBattery: trackers.filter(
      (t) => t.battery_pct !== null && t.battery_pct < 20
    ).length,
    offline: trackers.filter((t) => t.status === TrackerStatus.OFFLINE).length,
  };

  const handleRegister = async () => {
    if (!newDeviceEui.trim()) return;
    setRegistering(true);
    try {
      await createTracker({
        device_eui: newDeviceEui.trim(),
        label: newLabel.trim() || undefined,
      });
      setRegisterOpen(false);
      setNewDeviceEui('');
      setNewLabel('');
      fetchTrackers();
    } catch (err) {
      console.error('Failed to register tracker:', err);
    } finally {
      setRegistering(false);
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkUploading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter((l) => l.trim());
      for (const line of lines) {
        const parts = line.split(',').map((s) => s.trim());
        const device_eui = parts[0];
        const label = parts[1] || undefined;
        if (device_eui) {
          await createTracker({ device_eui, label });
        }
      }
      fetchTrackers();
    } catch (err) {
      console.error('Bulk upload failed:', err);
    } finally {
      setBulkUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const pageSize = trackers.length || 25;
  const from = page * pageSize + 1;
  const to = Math.min(from + trackers.length - 1, totalCount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Trackers
          </h1>
          <Badge>{totalCount}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleBulkUpload}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={bulkUploading}
          >
            {bulkUploading ? 'Uploading...' : 'Bulk Register (CSV)'}
          </Button>

          <Button onClick={() => setRegisterOpen(true)}>Register Tracker</Button>

          <Dialog
            open={registerOpen}
            onClose={() => setRegisterOpen(false)}
            title="Register Tracker"
            description="Enter the Device EUI from the tracker hardware label."
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="device-eui"
                  className="text-sm font-medium text-[var(--color-text-primary)]"
                >
                  Device EUI *
                </label>
                <Input
                  id="device-eui"
                  placeholder="e.g. A84041000181F5E2"
                  value={newDeviceEui}
                  onChange={(e) => setNewDeviceEui(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="tracker-label"
                  className="text-sm font-medium text-[var(--color-text-primary)]"
                >
                  Label (optional)
                </label>
                <Input
                  id="tracker-label"
                  placeholder="e.g. Lot A - Row 3"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRegisterOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleRegister}
                disabled={!newDeviceEui.trim() || registering}
              >
                {registering ? 'Registering...' : 'Register'}
              </Button>
            </div>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Total</p>
          <p className="text-2xl font-bold">{summaryData.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Assigned</p>
          <p className="text-2xl font-bold text-green-600">{summaryData.assigned}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Unassigned</p>
          <p className="text-2xl font-bold text-gray-500">{summaryData.unassigned}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Low Battery</p>
          <p className="text-2xl font-bold text-amber-600">{summaryData.lowBattery}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Offline</p>
          <p className="text-2xl font-bold text-red-600">{summaryData.offline}</p>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-lg bg-[var(--color-bg-secondary)] p-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-white text-[var(--color-text-primary)] shadow-sm dark:bg-[var(--color-bg-tertiary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Battery Dashboard */}
      <BatteryDashboard trackers={trackers} />

      {/* Tracker Table */}
      <TrackerTable trackers={trackers} loading={loading} onRefresh={fetchTrackers} />

      {/* Pagination */}
      {totalCount > 0 && (
        <PaginationControls
          from={from}
          to={to}
          total={totalCount}
          hasMore={hasMore}
          hasPrevious={page > 0}
          onPrevious={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      )}
    </div>
  );
}

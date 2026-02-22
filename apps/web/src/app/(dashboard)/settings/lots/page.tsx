'use client';

import { useEffect, useState, useCallback } from 'react';
import { getLots, updateLot, createLot } from '@/lib/api';
import type { Lot } from '@rv-trax/shared';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';

export default function LotsPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLot, setEditingLot] = useState<Lot | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editRowCount, setEditRowCount] = useState('');
  const [editSpotsPerRow, setEditSpotsPerRow] = useState('');
  const [saving, setSaving] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchLots = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLots();
      setLots(data);
    } catch (err) {
      console.error('Failed to fetch lots:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLots();
  }, [fetchLots]);

  const openEdit = (lot: Lot) => {
    setEditingLot(lot);
    setEditName(lot.name);
    setEditAddress(lot.address);
    setEditRowCount('');
    setEditSpotsPerRow('');
  };

  const handleSaveEdit = async () => {
    if (!editingLot) return;
    setSaving(true);
    try {
      await updateLot(editingLot.id, {
        name: editName,
        address: editAddress,
      });
      setEditingLot(null);
      fetchLots();
    } catch (err) {
      console.error('Failed to update lot:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createLot({
        name: newName.trim(),
        address: newAddress.trim(),
      });
      setCreateOpen(false);
      setNewName('');
      setNewAddress('');
      fetchLots();
    } catch (err) {
      console.error('Failed to create lot:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <a
            href="/settings"
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Settings
          </a>
          <span className="text-[var(--color-text-tertiary)]">/</span>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Lot Configuration
          </h1>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Add Lot</Button>
      </div>

      {/* Lot Cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="animate-pulse p-5">
              <div className="mb-3 h-5 w-32 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="space-y-2">
                <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-4 w-36 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            </Card>
          ))}
        </div>
      ) : lots.length === 0 ? (
        <Card className="p-12 text-center text-[var(--color-text-tertiary)]">
          No lots configured. Add your first lot to get started.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {lots.map((lot) => (
            <Card
              key={lot.id}
              className="cursor-pointer p-5 transition-shadow hover:shadow-md"
              onClick={() => openEdit(lot)}
            >
              <div className="mb-2 flex items-start justify-between">
                <h3 className="font-semibold text-[var(--color-text-primary)]">
                  {lot.name}
                </h3>
                <Badge
                  variant={lot.boundary.length > 0 ? 'success' : 'default'}
                  className="text-xs"
                >
                  {lot.boundary.length > 0 ? 'Boundary Set' : 'No Boundary'}
                </Badge>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {lot.address}
              </p>
              <div className="mt-3 flex gap-4 text-xs text-[var(--color-text-tertiary)]">
                <span>
                  Lat: {lot.center_lat.toFixed(4)}, Lng: {lot.center_lng.toFixed(4)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Lot Dialog */}
      <Dialog
        open={!!editingLot}
        onClose={() => setEditingLot(null)}
        title="Edit Lot"
        description="Update lot details and configuration."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">
              Lot Name
            </label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">
              Address
            </label>
            <Input
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
            />
          </div>

          {/* Boundary Map Placeholder */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">
              Lot Boundary
            </label>
            <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <p className="text-center text-sm text-[var(--color-text-tertiary)]">
                Map boundary editor will be available in a future update.
                <br />
                {editingLot?.boundary.length
                  ? `Current boundary has ${editingLot.boundary.length} points.`
                  : 'No boundary defined yet.'}
              </p>
            </div>
          </div>

          {/* Grid Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--color-text-primary)]">
                Row Count
              </label>
              <Input
                type="number"
                placeholder="e.g. 10"
                value={editRowCount}
                onChange={(e) => setEditRowCount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--color-text-primary)]">
                Spots Per Row
              </label>
              <Input
                type="number"
                placeholder="e.g. 20"
                value={editSpotsPerRow}
                onChange={(e) => setEditSpotsPerRow(e.target.value)}
              />
            </div>
          </div>

          {/* Upload Map Image */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">
              Map Image
            </label>
            <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <p className="text-sm text-[var(--color-text-tertiary)]">
                Upload Map Image (coming soon)
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setEditingLot(null)}>
            Cancel
          </Button>
          <Button onClick={handleSaveEdit} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </Dialog>

      {/* Create Lot Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Lot"
        description="Create a new lot for your dealership."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">
              Lot Name
            </label>
            <Input
              placeholder="e.g. Main Lot"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">
              Address
            </label>
            <Input
              placeholder="123 Dealer Dr, Dallas, TX 75001"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
          >
            {creating ? 'Creating...' : 'Create Lot'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

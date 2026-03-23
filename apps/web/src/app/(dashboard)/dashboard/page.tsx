'use client';

import { useEffect, useState, useCallback } from 'react';
import { LayoutDashboard, Settings2, Plus, X, RotateCcw, Check } from 'lucide-react';
import { getDashboardConfig, saveDashboardConfig, resetDashboardConfig } from '@/lib/api';
import type { DashboardWidget } from '@/lib/api';
import WidgetRenderer from './components/widgets/WidgetRenderer';
import { WIDGET_REGISTRY, getWidgetDef } from './components/widgets/WidgetRegistry';

// ---------------------------------------------------------------------------
// Default layout (same as API default)
// ---------------------------------------------------------------------------

const DEFAULT_LAYOUT: DashboardWidget[] = [
  { widget_id: 'inventory_summary', x: 0, y: 0, w: 2, h: 1 },
  { widget_id: 'tracker_health', x: 2, y: 0, w: 1, h: 1 },
  { widget_id: 'alert_feed', x: 0, y: 1, w: 1, h: 1 },
  { widget_id: 'aging_chart', x: 1, y: 1, w: 2, h: 1 },
  { widget_id: 'recent_activity', x: 0, y: 2, w: 1, h: 1 },
  { widget_id: 'unit_status_breakdown', x: 1, y: 2, w: 1, h: 1 },
  { widget_id: 'quick_actions', x: 2, y: 2, w: 1, h: 1 },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [layout, setLayout] = useState<DashboardWidget[]>(DEFAULT_LAYOUT);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load saved layout
  useEffect(() => {
    getDashboardConfig()
      .then((res) => {
        if (res.data.layout && res.data.layout.length > 0) {
          setLayout(res.data.layout);
        }
      })
      .catch(() => {
        // Use default
      })
      .finally(() => setLoaded(true));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveDashboardConfig(layout);
      setEditMode(false);
    } catch {
      // Silently fail — layout is still local
    } finally {
      setSaving(false);
    }
  }, [layout]);

  const handleReset = useCallback(async () => {
    setSaving(true);
    try {
      const res = await resetDashboardConfig();
      setLayout(res.data.layout);
      setEditMode(false);
    } catch {
      setLayout(DEFAULT_LAYOUT);
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  }, []);

  const removeWidget = (widgetId: string) => {
    setLayout((prev) => prev.filter((w) => w.widget_id !== widgetId));
  };

  const addWidget = (widgetId: string) => {
    const def = getWidgetDef(widgetId);
    if (!def) return;
    // Find next available y position
    const maxY = layout.length > 0 ? Math.max(...layout.map((w) => w.y)) + 1 : 0;
    setLayout((prev) => [
      ...prev,
      {
        widget_id: widgetId,
        x: 0,
        y: maxY,
        w: def.defaultW,
        h: def.defaultH,
      },
    ]);
  };

  const activeWidgetIds = new Set(layout.map((w) => w.widget_id));
  const availableWidgets = WIDGET_REGISTRY.filter((w) => !activeWidgetIds.has(w.id));

  // Sort widgets by y then x for display
  const sortedLayout = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-7 w-7 text-[var(--color-brand-500)]" />
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Dashboard</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Overview of your lot inventory and tracker health
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-600)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brand-700)] disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Layout'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
            >
              <Settings2 className="h-4 w-4" />
              Customize
            </button>
          )}
        </div>
      </div>

      {/* Add Widget Bar (edit mode) */}
      {editMode && availableWidgets.length > 0 && (
        <div className="rounded-xl border border-dashed border-[var(--color-brand-500)]/40 bg-[var(--color-brand-500)]/5 p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Add Widgets
          </p>
          <div className="flex flex-wrap gap-2">
            {availableWidgets.map((w) => (
              <button
                key={w.id}
                onClick={() => addWidget(w.id)}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm transition-colors hover:border-[var(--color-brand-500)] hover:bg-[var(--color-bg-secondary)]"
              >
                <Plus className="h-3.5 w-3.5 text-[var(--color-brand-500)]" />
                <w.icon className="h-4 w-4 text-[var(--color-text-secondary)]" />
                <span className="text-[var(--color-text-primary)]">{w.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Widget Grid */}
      {!loaded ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[200px] animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedLayout.map((widget) => {
            const def = getWidgetDef(widget.widget_id);
            const colSpan = widget.w >= 2 ? 'sm:col-span-2' : '';

            return (
              <div
                key={widget.widget_id}
                className={`relative rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-5 shadow-sm transition-shadow hover:shadow-md ${colSpan} ${
                  editMode ? 'ring-2 ring-[var(--color-brand-500)]/20' : ''
                }`}
              >
                {/* Widget header */}
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {def?.name ?? widget.widget_id}
                  </h3>
                  {editMode && (
                    <button
                      onClick={() => removeWidget(widget.widget_id)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/20"
                      title="Remove widget"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Widget content */}
                <WidgetRenderer widgetId={widget.widget_id} />
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {loaded && layout.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] py-16 text-center">
          <LayoutDashboard className="mx-auto h-12 w-12 text-[var(--color-text-tertiary)]" />
          <p className="mt-3 text-sm font-medium text-[var(--color-text-secondary)]">
            No widgets configured
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            Click &ldquo;Customize&rdquo; to add widgets to your dashboard
          </p>
        </div>
      )}
    </div>
  );
}

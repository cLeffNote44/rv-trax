'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Copy,
  Check,
  Eye,
  Palette,
  ExternalLink,
  Code,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { getWidgetConfig, updateWidgetConfig, type WidgetConfig } from '@/lib/api';

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'new_arrival', label: 'New Arrival' },
  { value: 'lot_ready', label: 'Lot Ready' },
  { value: 'hold', label: 'On Hold' },
  { value: 'shown', label: 'Shown' },
  { value: 'deposit', label: 'Deposit' },
];

export default function WidgetSettingsPage() {
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local edit state
  const [themeColor, setThemeColor] = useState('#338dfc');
  const [showPrices, setShowPrices] = useState(true);
  const [showStatuses, setShowStatuses] = useState<string[]>(['available', 'new_arrival']);
  const [isActive, setIsActive] = useState(false);
  const [linkTemplate, setLinkTemplate] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const result = await getWidgetConfig();
        setConfig(result);
        setThemeColor(result.theme_color);
        setShowPrices(result.show_prices);
        setShowStatuses(result.show_statuses);
        setIsActive(result.is_active);
        setLinkTemplate(result.link_template ?? '');
      } catch {
        // Widget may not be configured yet
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const embedCode = useMemo(() => {
    const dealershipId = config?.dealership_id ?? 'YOUR_DEALERSHIP_ID';
    return `<div id="rv-trax-widget"></div>
<script src="https://app.rvtrax.com/widget.js"
  data-dealership="${dealershipId}"
  data-theme="${themeColor}"
  ${showPrices ? '' : 'data-hide-prices="true"'}
></script>`;
  }, [config?.dealership_id, themeColor, showPrices]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateWidgetConfig({
        theme_color: themeColor,
        show_prices: showPrices,
        show_statuses: showStatuses,
        is_active: isActive,
        link_template: linkTemplate || null,
      });
      setConfig(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleStatus(status: string) {
    setShowStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-64 rounded bg-[var(--color-bg-tertiary)]" />
        <div className="h-96 rounded-xl bg-[var(--color-bg-tertiary)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--color-text-primary)]">
          <Globe className="h-6 w-6 text-[var(--color-brand-600)]" />
          Public Inventory Widget
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Embed a live inventory feed on your dealership website. Customers can browse available
          units without needing an account.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Configuration */}
        <div className="space-y-6">
          {/* Active toggle */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[var(--color-text-primary)]">Widget Status</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {isActive ? 'Widget is live and visible to customers' : 'Widget is disabled'}
                </p>
              </div>
              <button
                onClick={() => setIsActive(!isActive)}
                className="text-[var(--color-brand-600)]"
              >
                {isActive ? (
                  <ToggleRight className="h-8 w-8" />
                ) : (
                  <ToggleLeft className="h-8 w-8 text-[var(--color-text-tertiary)]" />
                )}
              </button>
            </div>
          </div>

          {/* Theme color */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
              <Palette className="h-4 w-4" />
              Appearance
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-[var(--color-text-secondary)]">
                  Theme Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--color-border)]"
                  />
                  <input
                    type="text"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">
                    Show Prices
                  </div>
                  <div className="text-xs text-[var(--color-text-tertiary)]">
                    Display MSRP on unit cards
                  </div>
                </div>
                <button onClick={() => setShowPrices(!showPrices)}>
                  {showPrices ? (
                    <ToggleRight className="h-6 w-6 text-[var(--color-brand-600)]" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-[var(--color-text-tertiary)]" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Visible statuses */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
              <Eye className="h-4 w-4" />
              Visible Statuses
            </h3>
            <p className="mb-3 text-xs text-[var(--color-text-tertiary)]">
              Choose which unit statuses are shown to customers
            </p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleStatus(opt.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    showStatuses.includes(opt.value)
                      ? 'bg-[var(--color-brand-600)] text-white'
                      : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Link template */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
              <ExternalLink className="h-4 w-4" />
              Detail Link Template
            </h3>
            <p className="mb-3 text-xs text-[var(--color-text-tertiary)]">
              URL template for unit detail pages on your website. Use {'{{stock_number}}'} as
              placeholder.
            </p>
            <input
              type="text"
              value={linkTemplate}
              onChange={(e) => setLinkTemplate(e.target.value)}
              placeholder="https://yoursite.com/inventory/{{stock_number}}"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm placeholder:text-[var(--color-text-tertiary)]"
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brand-700)] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        {/* Embed code & preview */}
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
              <Code className="h-4 w-4" />
              Embed Code
            </h3>
            <p className="mb-3 text-xs text-[var(--color-text-tertiary)]">
              Paste this code into your website to show the inventory widget
            </p>
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-300">
                <code>{embedCode}</code>
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 rounded-md bg-slate-700 p-1.5 text-slate-300 transition-colors hover:bg-slate-600"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Preview mockup */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6">
            <h3 className="mb-4 font-semibold text-[var(--color-text-primary)]">Widget Preview</h3>
            <div
              className="overflow-hidden rounded-lg border border-[var(--color-border)]"
              style={{ borderTopColor: themeColor, borderTopWidth: 3 }}
            >
              <div className="p-4">
                <div className="mb-3 text-sm font-semibold" style={{ color: themeColor }}>
                  Available Inventory
                </div>
                {/* Mock unit cards */}
                {[
                  { stock: 'RV-2026-001', name: '2026 Forest River Salem', price: '$34,999' },
                  { stock: 'RV-2026-002', name: '2025 Jayco Eagle HT', price: '$42,500' },
                  { stock: 'RV-2026-003', name: '2024 Winnebago View', price: '$89,900' },
                ].map((unit) => (
                  <div
                    key={unit.stock}
                    className="mb-2 flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-[var(--color-text-primary)]">
                        {unit.name}
                      </div>
                      <div className="text-xs text-[var(--color-text-tertiary)]">{unit.stock}</div>
                    </div>
                    {showPrices && (
                      <div className="text-sm font-bold" style={{ color: themeColor }}>
                        {unit.price}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-center">
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  Powered by RV Trax
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

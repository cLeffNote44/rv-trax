'use client';

import { useState, useCallback } from 'react';
import { Truck, Wrench, MapPin, Bell, Mail, Smartphone, Loader2, Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { updateNotificationPreferences } from '@/lib/api';

// ── Types ───────────────────────────────────────────────────────────────────

interface StatusNotificationPref {
  status: string;
  in_app: boolean;
  email: boolean;
  push: boolean;
}

interface StatusDefinition {
  status: string;
  label: string;
}

interface CategoryDefinition {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  statuses: StatusDefinition[];
}

// ── Channel definitions ─────────────────────────────────────────────────────

const CHANNELS = [
  { key: 'in_app' as const, label: 'In-App', icon: Bell },
  { key: 'email' as const, label: 'Email', icon: Mail },
  { key: 'push' as const, label: 'Push', icon: Smartphone },
];

// ── Status categories ───────────────────────────────────────────────────────

const CATEGORIES: CategoryDefinition[] = [
  {
    key: 'sales',
    label: 'Sales',
    icon: Truck,
    description: 'Notifications when units are sold, pending delivery, or delivered.',
    statuses: [
      { status: 'sold', label: 'Sold' },
      { status: 'pending_delivery', label: 'Pending Delivery' },
      { status: 'delivered', label: 'Delivered' },
    ],
  },
  {
    key: 'service',
    label: 'Service',
    icon: Wrench,
    description: 'Notifications when units enter service or PDI begins.',
    statuses: [
      { status: 'in_service', label: 'In Service' },
      { status: 'pdi_in_progress', label: 'PDI In Progress' },
    ],
  },
  {
    key: 'lot',
    label: 'Lot',
    icon: MapPin,
    description: 'Notifications when units become available or lot-ready.',
    statuses: [
      { status: 'available', label: 'Available' },
      { status: 'lot_ready', label: 'Lot Ready' },
    ],
  },
];

// ── Default preferences ─────────────────────────────────────────────────────

function buildDefaults(): StatusNotificationPref[] {
  const prefs: StatusNotificationPref[] = [];
  for (const category of CATEGORIES) {
    for (const s of category.statuses) {
      prefs.push({
        status: s.status,
        in_app: true,
        email: true,
        push: false,
      });
    }
  }
  return prefs;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function StatusNotificationSettings() {
  const [preferences, setPreferences] = useState<StatusNotificationPref[]>(buildDefaults);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const getPref = useCallback(
    (status: string) => preferences.find((p) => p.status === status),
    [preferences],
  );

  const togglePref = (status: string, channel: 'in_app' | 'email' | 'push') => {
    setPreferences((prev) =>
      prev.map((p) => (p.status === status ? { ...p, [channel]: !p[channel] } : p)),
    );
    setDirty(true);
    setSuccessMessage('');
  };

  const toggleCategory = (categoryKey: string, channel: 'in_app' | 'email' | 'push') => {
    const category = CATEGORIES.find((c) => c.key === categoryKey);
    if (!category) return;

    const statusKeys = category.statuses.map((s) => s.status);
    const allEnabled = statusKeys.every((s) => getPref(s)?.[channel]);

    setPreferences((prev) =>
      prev.map((p) => (statusKeys.includes(p.status) ? { ...p, [channel]: !allEnabled } : p)),
    );
    setDirty(true);
    setSuccessMessage('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMessage('');
    try {
      // Map to the API format used by the existing preferences endpoint
      const mapped = preferences.map((p) => ({
        alert_type: `status_change_${p.status}`,
        in_app: p.in_app,
        push: p.push,
        email: p.email,
        sms: false,
      }));
      await updateNotificationPreferences(mapped);
      setSuccessMessage('Status notification preferences saved.');
      setDirty(false);
    } catch (err) {
      console.error('Failed to save status notification preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Status Change Notifications
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Choose which unit status transitions trigger notifications and how they are delivered.
          Notifications are sent to team members based on their role.
        </p>
      </div>

      {CATEGORIES.map((category) => {
        const Icon = category.icon;

        return (
          <Card key={category.key} className="overflow-hidden p-0">
            {/* Category header */}
            <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
              <Icon className="h-5 w-5 text-[var(--color-text-secondary)]" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {category.label}
                </h3>
                <p className="text-xs text-[var(--color-text-tertiary)]">{category.description}</p>
              </div>

              {/* Category-level toggles */}
              <div className="flex items-center gap-6">
                {CHANNELS.map((ch) => {
                  const statusKeys = category.statuses.map((s) => s.status);
                  const allEnabled = statusKeys.every((s) => getPref(s)?.[ch.key]);
                  const someEnabled = !allEnabled && statusKeys.some((s) => getPref(s)?.[ch.key]);

                  return (
                    <button
                      key={ch.key}
                      type="button"
                      onClick={() => toggleCategory(category.key, ch.key)}
                      className="flex flex-col items-center gap-0.5"
                      title={`Toggle all ${category.label} ${ch.label} notifications`}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                        {ch.label}
                      </span>
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded border text-xs transition-colors ${
                          allEnabled
                            ? 'border-[var(--color-brand-600)] bg-[var(--color-brand-600)] text-white'
                            : someEnabled
                              ? 'border-[var(--color-brand-400)] bg-[var(--color-brand-100)] text-[var(--color-brand-600)]'
                              : 'border-gray-300 bg-white text-transparent dark:border-gray-600 dark:bg-gray-800'
                        }`}
                      >
                        {(allEnabled || someEnabled) && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status rows */}
            <table className="w-full text-sm">
              <tbody>
                {category.statuses.map((statusDef, idx) => {
                  const pref = getPref(statusDef.status);
                  if (!pref) return null;

                  return (
                    <tr
                      key={statusDef.status}
                      className={`transition-colors hover:bg-[var(--color-bg-secondary)] ${
                        idx < category.statuses.length - 1
                          ? 'border-b border-[var(--color-border)]'
                          : ''
                      }`}
                    >
                      <td className="px-4 py-3 pl-12 font-medium text-[var(--color-text-primary)]">
                        {statusDef.label}
                      </td>
                      {CHANNELS.map((ch) => (
                        <td key={ch.key} className="w-20 px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={pref[ch.key]}
                            onChange={() => togglePref(statusDef.status, ch.key)}
                            className="h-4 w-4 cursor-pointer rounded border-gray-300 text-[var(--color-brand-600)] focus:ring-[var(--color-brand-500)]"
                            aria-label={`${ch.label} notification for ${statusDef.label}`}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        );
      })}

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Status Preferences'
          )}
        </Button>
        {successMessage && <p className="text-sm font-medium text-green-600">{successMessage}</p>}
      </div>
    </div>
  );
}

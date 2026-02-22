'use client';

import { useEffect, useState, useCallback } from 'react';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface NotificationPreference {
  alert_type: string;
  in_app: boolean;
  push: boolean;
  email: boolean;
  sms: boolean;
}

const ALERT_TYPES = [
  { key: 'geo_fence_breach', label: 'Geo-fence Breach' },
  { key: 'after_hours_movement', label: 'After-hours Movement' },
  { key: 'low_battery', label: 'Low Battery' },
  { key: 'tracker_offline', label: 'Tracker Offline' },
  { key: 'gateway_offline', label: 'Gateway Offline' },
  { key: 'aged_inventory', label: 'Aged Inventory' },
];

const CHANNELS: { key: keyof Pick<NotificationPreference, 'in_app' | 'push' | 'email' | 'sms'>; label: string }[] = [
  { key: 'in_app', label: 'In-App' },
  { key: 'push', label: 'Push' },
  { key: 'email', label: 'Email' },
  { key: 'sms', label: 'SMS' },
];

const DEFAULT_PREFS: NotificationPreference[] = ALERT_TYPES.map((at) => ({
  alert_type: at.key,
  in_app: true,
  push: true,
  email: at.key === 'geo_fence_breach' || at.key === 'after_hours_movement',
  sms: at.key === 'geo_fence_breach',
}));

export default function NotificationsPage() {
  const [preferences, setPreferences] = useState<NotificationPreference[]>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [dirty, setDirty] = useState(false);

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotificationPreferences();
      if (data && Array.isArray(data)) {
        setPreferences(data);
      }
    } catch (err) {
      console.error('Failed to fetch notification preferences:', err);
      // Fall back to defaults already set
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const togglePreference = (
    alertType: string,
    channel: keyof Pick<NotificationPreference, 'in_app' | 'push' | 'email' | 'sms'>
  ) => {
    setPreferences((prev) =>
      prev.map((pref) =>
        pref.alert_type === alertType
          ? { ...pref, [channel]: !pref[channel] }
          : pref
      )
    );
    setDirty(true);
    setSuccessMessage('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMessage('');
    try {
      await updateNotificationPreferences(preferences);
      setSuccessMessage('Preferences saved successfully.');
      setDirty(false);
    } catch (err) {
      console.error('Failed to save notification preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <a
          href="/settings"
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          Settings
        </a>
        <span className="text-[var(--color-text-tertiary)]">/</span>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Notification Preferences
        </h1>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)]">
        Choose which alerts you receive and how they are delivered. These settings
        apply to your account. Per-role defaults are shown as initially checked.
      </p>

      {/* Matrix Table */}
      <Card className="overflow-x-auto p-0">
        {loading ? (
          <div className="animate-pulse p-6">
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 rounded bg-gray-200 dark:bg-gray-700" />
              ))}
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Alert Type
                </th>
                {CHANNELS.map((ch) => (
                  <th
                    key={ch.key}
                    className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]"
                  >
                    {ch.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preferences.map((pref) => {
                const alertLabel =
                  ALERT_TYPES.find((at) => at.key === pref.alert_type)?.label ??
                  pref.alert_type;
                return (
                  <tr
                    key={pref.alert_type}
                    className="border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-secondary)]"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                      {alertLabel}
                    </td>
                    {CHANNELS.map((ch) => (
                      <td key={ch.key} className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={pref[ch.key]}
                          onChange={() =>
                            togglePreference(pref.alert_type, ch.key)
                          }
                          className="h-4 w-4 cursor-pointer rounded border-gray-300 text-[var(--color-brand-600)] focus:ring-[var(--color-brand-500)]"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
        {successMessage && (
          <p className="text-sm font-medium text-green-600">{successMessage}</p>
        )}
      </div>
    </div>
  );
}

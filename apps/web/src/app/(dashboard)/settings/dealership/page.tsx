'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getDealership, updateDealership } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';

const dealershipSchema = z.object({
  name: z.string().min(1, 'Dealership name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required').max(2, 'Use 2-letter state code'),
  zip: z.string().min(5, 'ZIP code must be at least 5 characters'),
  timezone: z.string().min(1, 'Timezone is required'),
});

type DealershipFormData = z.infer<typeof dealershipSchema>;

const US_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
];

export default function DealershipSettingsPage() {
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<DealershipFormData>({
    resolver: zodResolver(dealershipSchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      timezone: 'America/New_York',
    },
  });

  const timezoneValue = watch('timezone');

  useEffect(() => {
    async function loadDealership() {
      setLoadingData(true);
      try {
        const dealership = await getDealership();
        setValue('name', dealership.name);
        setValue('address', dealership.address);
        setValue('city', dealership.city);
        setValue('state', dealership.state);
        setValue('zip', dealership.zip);
        setValue('timezone', dealership.timezone);
      } catch (err) {
        console.error('Failed to load dealership:', err);
        setErrorMessage('Failed to load dealership settings.');
      } finally {
        setLoadingData(false);
      }
    }
    loadDealership();
  }, [setValue]);

  const onSubmit = async (data: DealershipFormData) => {
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');
    try {
      await updateDealership(data);
      setSuccessMessage('Settings saved successfully.');
    } catch (err) {
      console.error('Failed to update dealership:', err);
      setErrorMessage('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Dealership Settings
        </h1>
        <Card className="animate-pulse p-6">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <a
          href="/settings"
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          Settings
        </a>
        <span className="text-[var(--color-text-tertiary)]">/</span>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Dealership Settings
        </h1>
      </div>

      <Card className="max-w-2xl p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="name"
              className="text-sm font-medium text-[var(--color-text-primary)]"
            >
              Dealership Name
            </label>
            <Input id="name" {...register('name')} />
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <label
              htmlFor="address"
              className="text-sm font-medium text-[var(--color-text-primary)]"
            >
              Address
            </label>
            <Input id="address" {...register('address')} />
            {errors.address && (
              <p className="text-xs text-red-600">{errors.address.message}</p>
            )}
          </div>

          {/* City / State / ZIP */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="city"
                className="text-sm font-medium text-[var(--color-text-primary)]"
              >
                City
              </label>
              <Input id="city" {...register('city')} />
              {errors.city && (
                <p className="text-xs text-red-600">{errors.city.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="state"
                className="text-sm font-medium text-[var(--color-text-primary)]"
              >
                State
              </label>
              <Input
                id="state"
                {...register('state')}
                placeholder="TX"
                maxLength={2}
                className="uppercase"
              />
              {errors.state && (
                <p className="text-xs text-red-600">{errors.state.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="zip"
                className="text-sm font-medium text-[var(--color-text-primary)]"
              >
                ZIP Code
              </label>
              <Input id="zip" {...register('zip')} placeholder="75001" />
              {errors.zip && (
                <p className="text-xs text-red-600">{errors.zip.message}</p>
              )}
            </div>
          </div>

          {/* Timezone */}
          <Select
            label="Timezone"
            options={US_TIMEZONES.map((tz) => ({ value: tz, label: tz.replace('_', ' ') }))}
            value={timezoneValue}
            onChange={(e) => setValue('timezone', e.target.value, { shouldDirty: true })}
            error={errors.timezone?.message}
          />

          {/* Logo Upload Placeholder */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">
              Logo
            </label>
            <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <p className="text-sm text-[var(--color-text-tertiary)]">
                Drag and drop or click to upload logo
              </p>
            </div>
          </div>

          {/* Feedback messages */}
          {successMessage && (
            <p className="text-sm font-medium text-green-600">{successMessage}</p>
          )}
          {errorMessage && (
            <p className="text-sm font-medium text-red-600">{errorMessage}</p>
          )}

          {/* Submit */}
          <Button type="submit" disabled={saving || !isDirty}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarChart3, Plus, Play, Trash2 } from 'lucide-react';
import type { ScheduledReport } from '@rv-trax/shared';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';
import {
  getScheduledReports,
  createScheduledReport,
  deleteScheduledReport,
  generateReport,
} from '@/lib/api';
import { formatDate, formatStatus } from '@/lib/utils';

const REPORT_TYPE_OPTIONS = [
  { value: 'inventory_summary', label: 'Inventory Summary' },
  { value: 'movement_report', label: 'Movement Report' },
  { value: 'aging_report', label: 'Aging Report' },
  { value: 'staging_compliance', label: 'Staging Compliance' },
  { value: 'lot_utilization', label: 'Lot Utilization' },
];

const FORMAT_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
];

const SCHEDULE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const FORMAT_BADGE_VARIANT: Record<string, 'info' | 'success' | 'warning' | 'default'> = {
  pdf: 'info',
  csv: 'success',
  json: 'warning',
};

export default function ReportsPage() {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [formType, setFormType] = useState('inventory_summary');
  const [formFormat, setFormFormat] = useState('pdf');
  const [formSchedule, setFormSchedule] = useState('weekly');
  const [formRecipients, setFormRecipients] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      const res = await getScheduledReports();
      setReports(res.data);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const recipients = formRecipients
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);

      await createScheduledReport({
        report_type: formType as ScheduledReport['report_type'],
        format: formFormat as ScheduledReport['format'],
        schedule: formSchedule as ScheduledReport['schedule'],
        recipients,
        is_active: true,
      });

      setCreateOpen(false);
      resetForm();
      await fetchReports();
    } catch {
      // Silently fail
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteScheduledReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // Silently fail
    }
  };

  const handleGenerate = async (id: string) => {
    setGenerating(id);
    try {
      await generateReport(id);
      setSuccessMsg('Report generated successfully');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      // Silently fail
    } finally {
      setGenerating(null);
    }
  };

  const resetForm = () => {
    setFormType('inventory_summary');
    setFormFormat('pdf');
    setFormSchedule('weekly');
    setFormRecipients('');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Scheduled Reports
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Manage automated report generation and delivery
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Report
        </Button>
      </div>

      {/* Success Toast */}
      {successMsg && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMsg}
        </div>
      )}

      {/* Reports Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <BarChart3 className="h-12 w-12 text-[var(--color-text-tertiary)]" />
              <p className="text-sm text-[var(--color-text-secondary)]">
                No scheduled reports yet
              </p>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Create Your First Report
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Report Type
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Format
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Schedule
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Recipients
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Last Run
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr
                      key={report.id}
                      className="border-b border-[var(--color-border)] last:border-0"
                    >
                      <td className="px-6 py-3 font-medium text-[var(--color-text-primary)]">
                        {formatStatus(report.report_type)}
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={FORMAT_BADGE_VARIANT[report.format] ?? 'default'}>
                          {report.format.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 capitalize text-[var(--color-text-secondary)]">
                        {report.schedule}
                      </td>
                      <td className="max-w-[200px] truncate px-6 py-3 text-[var(--color-text-secondary)]">
                        {report.recipients.join(', ')}
                      </td>
                      <td className="px-6 py-3 text-[var(--color-text-secondary)]">
                        {report.last_run_at ? formatDate(report.last_run_at) : 'Never'}
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={report.is_active ? 'success' : 'default'}>
                          {report.is_active ? 'Active' : 'Paused'}
                        </Badge>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            isLoading={generating === report.id}
                            onClick={() => handleGenerate(report.id)}
                          >
                            <Play className="h-3.5 w-3.5" />
                            Generate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(report.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          resetForm();
        }}
        title="Create Scheduled Report"
        description="Configure a new report to be generated automatically."
      >
        <div className="space-y-4">
          <Select
            label="Report Type"
            options={REPORT_TYPE_OPTIONS}
            value={formType}
            onChange={(e) => setFormType(e.target.value)}
          />

          <Select
            label="Format"
            options={FORMAT_OPTIONS}
            value={formFormat}
            onChange={(e) => setFormFormat(e.target.value)}
          />

          <Select
            label="Schedule"
            options={SCHEDULE_OPTIONS}
            value={formSchedule}
            onChange={(e) => setFormSchedule(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">
              Recipients
            </label>
            <input
              type="text"
              value={formRecipients}
              onChange={(e) => setFormRecipients(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Comma-separated email addresses
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button isLoading={submitting} onClick={handleCreate}>
              Create Report
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { inviteUser } from '@/lib/api';
import { UserRole } from '@rv-trax/shared';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const ROLE_OPTIONS: { value: string; label: string; description: string }[] = [
  {
    value: UserRole.MANAGER,
    label: 'Manager',
    description: 'Full access to all features except billing and dealership settings.',
  },
  {
    value: UserRole.SALES,
    label: 'Sales',
    description: 'View inventory, manage units, create work orders.',
  },
  {
    value: UserRole.SERVICE,
    label: 'Service',
    description: 'Manage work orders, PDI checklists, and service records.',
  },
  {
    value: UserRole.PORTER,
    label: 'Porter',
    description: 'View lot map, receive move instructions, scan trackers.',
  },
  {
    value: UserRole.VIEWER,
    label: 'Viewer',
    description: 'Read-only access to inventory and lot status.',
  },
];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function InviteUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: InviteUserDialogProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<string>(UserRole.VIEWER);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const emailValid = isValidEmail(email);
  const canSubmit = emailValid && name.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    setSuccess(false);
    try {
      await inviteUser({
        email: email.trim(),
        name: name.trim(),
        role: role as typeof UserRole[keyof typeof UserRole],
      });
      setSuccess(true);
      setTimeout(() => {
        setEmail('');
        setName('');
        setRole(UserRole.VIEWER);
        setSuccess(false);
        onOpenChange(false);
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error('Failed to invite user:', err);
      setError('Failed to send invitation. The email may already be in use.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setEmail('');
      setName('');
      setRole(UserRole.VIEWER);
      setError('');
      setSuccess(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} title="Invite User" description="Send an invitation to join your dealership on RV Trax.">
      <div className="space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <label
            htmlFor="invite-name"
            className="text-sm font-medium text-[var(--color-text-primary)]"
          >
            Full Name
          </label>
          <Input
            id="invite-name"
            placeholder="Jane Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label
            htmlFor="invite-email"
            className="text-sm font-medium text-[var(--color-text-primary)]"
          >
            Email Address
          </label>
          <Input
            id="invite-email"
            type="email"
            placeholder="jane@dealership.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {email.length > 0 && !emailValid && (
            <p className="text-xs text-red-600">
              Please enter a valid email address.
            </p>
          )}
        </div>

        {/* Role */}
        <Select
          label="Role"
          options={ROLE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <p className="text-xs text-[var(--color-text-tertiary)]">
          {ROLE_OPTIONS.find((r) => r.value === role)?.description}
        </p>

        {/* Feedback */}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">Invitation sent successfully.</p>}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>{submitting ? 'Sending...' : 'Send Invitation'}</Button>
      </div>
    </Dialog>
  );
}

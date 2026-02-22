'use client';

import { useEffect, useState, useCallback } from 'react';
import { getUsers, deactivateUser, resendInvitation } from '@/lib/api';
import type { User } from '@rv-trax/shared';
import { UserRole } from '@rv-trax/shared';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { InviteUserDialog } from './components/InviteUserDialog';
import { formatRelativeTime } from '@/lib/utils';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';

const roleColors: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
  [UserRole.OWNER]: 'success',
  [UserRole.MANAGER]: 'info',
  [UserRole.SALES]: 'default',
  [UserRole.SERVICE]: 'warning',
  [UserRole.PORTER]: 'default',
  [UserRole.VIEWER]: 'default',
};

const columnHelper = createColumnHelper<User>();

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDeactivate = async () => {
    if (!confirmDeactivate) return;
    try {
      await deactivateUser(confirmDeactivate.id);
      setConfirmDeactivate(null);
      fetchUsers();
    } catch (err) {
      console.error('Failed to deactivate user:', err);
    }
  };

  const handleResendInvitation = async (userId: string) => {
    try {
      await resendInvitation(userId);
    } catch (err) {
      console.error('Failed to resend invitation:', err);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: ColumnDef<User, any>[] = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (info) => (
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">
            {info.getValue()}
          </p>
        </div>
      ),
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: (info) => (
        <span className="text-[var(--color-text-secondary)]">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('role', {
      header: 'Role',
      cell: (info) => {
        const role = info.getValue();
        return (
          <StatusBadge
            status={role}
            variant={roleColors[role] ?? 'default'}
          />
        );
      },
    }),
    columnHelper.accessor('last_login_at', {
      header: 'Last Active',
      cell: (info) => {
        const val = info.getValue();
        if (!val)
          return (
            <span className="text-[var(--color-text-tertiary)]">Never</span>
          );
        return (
          <span className="text-sm text-[var(--color-text-secondary)]">
            {formatRelativeTime(val)}
          </span>
        );
      },
    }),
    columnHelper.accessor('is_active', {
      header: 'Status',
      cell: (info) =>
        info.getValue() ? (
          <StatusBadge status="active" variant="success" />
        ) : (
          <StatusBadge status="inactive" variant="default" />
        ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm">
              Edit Role
            </Button>
            {user.is_active ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600"
                onClick={() => setConfirmDeactivate(user)}
              >
                Deactivate
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleResendInvitation(user.id)}
              >
                Resend Invite
              </Button>
            )}
          </div>
        );
      },
    }),
  ];

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
            Users & Roles
          </h1>
        </div>
        <Button onClick={() => setInviteOpen(true)}>Invite User</Button>
      </div>

      {/* User Table */}
      <DataTable columns={columns} data={users} loading={loading} emptyMessage="No users found." />

      {/* Invite Dialog */}
      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSuccess={fetchUsers}
      />

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        open={!!confirmDeactivate}
        title="Deactivate User"
        description={`Are you sure you want to deactivate ${confirmDeactivate?.name}? They will lose access to the dashboard.`}
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={handleDeactivate}
        onCancel={() => setConfirmDeactivate(null)}
      />
    </div>
  );
}

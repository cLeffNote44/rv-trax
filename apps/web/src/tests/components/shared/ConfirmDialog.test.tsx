import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Delete"
        description="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders title and description when open', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete Unit"
        description="This action cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Delete Unit')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('shows default button labels', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        description="Proceed?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('shows custom button labels', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Remove"
        description="Really remove?"
        confirmLabel="Yes, Remove"
        cancelLabel="Never mind"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Yes, Remove' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Never mind' })).toBeInTheDocument();
  });

  it('calls onConfirm when confirm is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        description="Sure?"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        description="Sure?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows "Processing..." when loading', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        description="Sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        loading={true}
      />,
    );
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('disables buttons when loading', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        description="Sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        loading={true}
      />,
    );

    const buttons = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Close dialog');
    for (const btn of buttons) {
      expect(btn).toBeDisabled();
    }
  });

  it('uses destructive variant for confirm button', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        description="Sure?"
        variant="destructive"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    expect(confirmBtn.className).toContain('bg-red');
  });
});

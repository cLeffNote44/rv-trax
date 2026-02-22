import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from '@/components/ui/Dialog';

describe('Dialog', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <Dialog open={false} onClose={vi.fn()}>
        <p>Content</p>
      </Dialog>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders content when open is true', () => {
    render(
      <Dialog open={true} onClose={vi.fn()}>
        <p>Hello world</p>
      </Dialog>,
    );
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders title and description', () => {
    render(
      <Dialog open={true} onClose={vi.fn()} title="My Title" description="My Description">
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('My Description')).toBeInTheDocument();
  });

  it('has correct ARIA attributes', () => {
    render(
      <Dialog open={true} onClose={vi.fn()} title="Test">
        <p>Body</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');
  });

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Dialog open={true} onClose={onClose} title="Closeable">
        <p>Body</p>
      </Dialog>,
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Dialog open={true} onClose={onClose} title="Closeable">
        <p>Body</p>
      </Dialog>,
    );

    const closeBtn = screen.getByLabelText('Close dialog');
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the overlay', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Dialog open={true} onClose={onClose}>
        <p>Body</p>
      </Dialog>,
    );

    // Click the overlay (the outermost div with role="dialog")
    const overlay = screen.getByRole('dialog');
    await user.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('prevents body scroll when open', () => {
    const { unmount } = render(
      <Dialog open={true} onClose={vi.fn()}>
        <p>Body</p>
      </Dialog>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});

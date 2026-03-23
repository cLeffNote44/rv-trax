import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertBanner } from '@/components/ui/AlertBanner';

describe('AlertBanner', () => {
  it('renders error variant with message', () => {
    render(<AlertBanner variant="error" message="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeDefined();
  });

  it('renders success variant with message', () => {
    render(<AlertBanner variant="success" message="Saved successfully" />);
    expect(screen.getByText('Saved successfully')).toBeDefined();
  });

  it('renders warning variant', () => {
    render(<AlertBanner variant="warning" message="Be careful" />);
    expect(screen.getByText('Be careful')).toBeDefined();
  });

  it('renders info variant', () => {
    render(<AlertBanner variant="info" message="FYI" />);
    expect(screen.getByText('FYI')).toBeDefined();
  });

  it('defaults to error variant', () => {
    const { container } = render(<AlertBanner message="Oops" />);
    // Error variant uses red border
    const div = container.firstElementChild!;
    expect(div.className).toContain('border-red-200');
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<AlertBanner message="Failed" onRetry={onRetry} />);

    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders custom retry label', () => {
    render(<AlertBanner message="Failed" onRetry={() => {}} retryLabel="Try Again" />);
    expect(screen.getByText('Try Again')).toBeDefined();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(<AlertBanner message="Notice" onDismiss={onDismiss} />);

    const dismissButton = screen.getByLabelText('Dismiss');
    fireEvent.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<AlertBanner message="Info" />);
    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('does not render dismiss button when onDismiss is not provided', () => {
    render(<AlertBanner message="Info" />);
    expect(screen.queryByLabelText('Dismiss')).toBeNull();
  });

  it('renders children when no message prop is provided', () => {
    render(
      <AlertBanner variant="warning">
        <span>Custom child content</span>
      </AlertBanner>,
    );
    expect(screen.getByText('Custom child content')).toBeDefined();
  });
});

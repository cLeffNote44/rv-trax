import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, StatusBadge } from '@/components/ui/Badge';

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Hello</Badge>);
    expect(screen.getByText('Hello')).toBeDefined();
  });

  it('renders with default variant (has bg-[var(--color-bg-tertiary)])', () => {
    const { container } = render(<Badge>Default</Badge>);
    const span = container.querySelector('span')!;
    expect(span.className).toContain('bg-[var(--color-bg-tertiary)]');
  });

  it('renders with success variant', () => {
    const { container } = render(<Badge variant="success">OK</Badge>);
    const span = container.querySelector('span')!;
    expect(span.className).toContain('bg-green-100');
  });

  it('renders with warning variant', () => {
    const { container } = render(<Badge variant="warning">Warn</Badge>);
    const span = container.querySelector('span')!;
    expect(span.className).toContain('bg-amber-100');
  });

  it('renders with error variant', () => {
    const { container } = render(<Badge variant="error">Err</Badge>);
    const span = container.querySelector('span')!;
    expect(span.className).toContain('bg-red-100');
  });

  it('renders with info variant', () => {
    const { container } = render(<Badge variant="info">Info</Badge>);
    const span = container.querySelector('span')!;
    expect(span.className).toContain('bg-blue-100');
  });

  it('passes additional className', () => {
    const { container } = render(<Badge className="ml-2">Extra</Badge>);
    const span = container.querySelector('span')!;
    expect(span.className).toContain('ml-2');
  });
});

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

describe('StatusBadge', () => {
  it('renders formatted text for "new_arrival"', () => {
    render(<StatusBadge status="new_arrival" />);
    expect(screen.getByText('New Arrival')).toBeDefined();
  });

  it('renders formatted text for "pdi_in_progress"', () => {
    render(<StatusBadge status="pdi_in_progress" />);
    expect(screen.getByText('Pdi In Progress')).toBeDefined();
  });

  it('renders formatted text for "available"', () => {
    render(<StatusBadge status="available" />);
    expect(screen.getByText('Available')).toBeDefined();
  });

  it('renders formatted text for "sold"', () => {
    render(<StatusBadge status="sold" />);
    expect(screen.getByText('Sold')).toBeDefined();
  });

  it('applies status-specific background color class', () => {
    const { container } = render(<StatusBadge status="available" />);
    const span = container.querySelector('span')!;
    expect(span.className).toContain('bg-green-100');
  });
});

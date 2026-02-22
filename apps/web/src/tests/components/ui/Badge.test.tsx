import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies default variant classes', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).toContain('text-xs');
  });

  it('applies success variant', () => {
    render(<Badge variant="success">Online</Badge>);
    const badge = screen.getByText('Online');
    expect(badge.className).toContain('bg-green');
  });

  it('applies warning variant', () => {
    render(<Badge variant="warning">Low Battery</Badge>);
    const badge = screen.getByText('Low Battery');
    expect(badge.className).toContain('bg-amber');
  });

  it('applies error variant', () => {
    render(<Badge variant="error">Critical</Badge>);
    const badge = screen.getByText('Critical');
    expect(badge.className).toContain('bg-red');
  });

  it('applies info variant', () => {
    render(<Badge variant="info">New</Badge>);
    const badge = screen.getByText('New');
    expect(badge.className).toContain('bg-blue');
  });

  it('applies custom className', () => {
    render(<Badge className="ml-2">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge.className).toContain('ml-2');
  });
});

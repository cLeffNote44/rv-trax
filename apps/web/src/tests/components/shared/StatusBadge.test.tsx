import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/shared/StatusBadge';

describe('StatusBadge', () => {
  it('formats status label from snake_case', () => {
    render(<StatusBadge status="new_arrival" />);
    expect(screen.getByText('New Arrival')).toBeInTheDocument();
  });

  it('applies auto-color for available (success)', () => {
    render(<StatusBadge status="available" />);
    const badge = screen.getByText('Available');
    expect(badge.className).toContain('bg-green');
  });

  it('applies auto-color for critical (error)', () => {
    render(<StatusBadge status="critical" />);
    const badge = screen.getByText('Critical');
    expect(badge.className).toContain('bg-red');
  });

  it('applies auto-color for warning', () => {
    render(<StatusBadge status="warning" />);
    const badge = screen.getByText('Warning');
    expect(badge.className).toContain('bg-amber');
  });

  it('applies auto-color for online (success)', () => {
    render(<StatusBadge status="online" />);
    const badge = screen.getByText('Online');
    expect(badge.className).toContain('bg-green');
  });

  it('applies auto-color for offline (error)', () => {
    render(<StatusBadge status="offline" />);
    const badge = screen.getByText('Offline');
    expect(badge.className).toContain('bg-red');
  });

  it('applies auto-color for low_battery (warning)', () => {
    render(<StatusBadge status="low_battery" />);
    expect(screen.getByText('Low Battery')).toBeInTheDocument();
  });

  it('uses explicit variant over auto-color', () => {
    render(<StatusBadge status="custom_status" variant="info" />);
    const badge = screen.getByText('Custom Status');
    expect(badge.className).toContain('bg-blue');
  });

  it('falls back to default for unknown status', () => {
    render(<StatusBadge status="unknown_thing" variant="default" />);
    const badge = screen.getByText('Unknown Thing');
    expect(badge.className).toContain('bg-gray');
  });

  it('renders as inline-flex span', () => {
    render(<StatusBadge status="sold" />);
    const badge = screen.getByText('Sold');
    expect(badge.tagName).toBe('SPAN');
    expect(badge.className).toContain('inline-flex');
  });
});

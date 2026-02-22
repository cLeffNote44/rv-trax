import { describe, it, expect } from 'vitest';
import { cn, formatCurrency, formatDate, formatStatus, getStatusColor, getStatusBgColor } from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    const result = cn('px-2', 'py-4');
    expect(result).toContain('px-2');
    expect(result).toContain('py-4');
  });

  it('resolves Tailwind conflicts', () => {
    const result = cn('px-2', 'px-4');
    expect(result).toBe('px-4');
  });

  it('handles conditional classes', () => {
    const result = cn('base', false && 'hidden', 'visible');
    expect(result).toContain('base');
    expect(result).toContain('visible');
    expect(result).not.toContain('hidden');
  });

  it('handles undefined and null', () => {
    const result = cn('base', undefined, null);
    expect(result).toBe('base');
  });
});

describe('formatCurrency', () => {
  it('formats whole numbers as USD', () => {
    expect(formatCurrency(45000)).toBe('$45,000');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('formats large numbers with commas', () => {
    expect(formatCurrency(1250000)).toBe('$1,250,000');
  });

  it('rounds decimal values', () => {
    const result = formatCurrency(99.99);
    expect(result).toBe('$100');
  });
});

describe('formatDate', () => {
  it('formats a date string', () => {
    const result = formatDate('2025-03-15T12:00:00Z');
    expect(result).toBe('Mar 15, 2025');
  });

  it('formats a Date object', () => {
    const result = formatDate(new Date(2025, 0, 1));
    expect(result).toBe('Jan 1, 2025');
  });
});

describe('formatStatus', () => {
  it('converts snake_case to Title Case', () => {
    expect(formatStatus('new_arrival')).toBe('New Arrival');
  });

  it('handles single word', () => {
    expect(formatStatus('available')).toBe('Available');
  });

  it('handles multiple underscores', () => {
    expect(formatStatus('pdi_in_progress')).toBe('Pdi In Progress');
  });
});

describe('getStatusColor', () => {
  it('returns color for available', () => {
    expect(getStatusColor('available')).toContain('green');
  });

  it('returns color for new_arrival', () => {
    expect(getStatusColor('new_arrival')).toContain('blue');
  });

  it('returns color for hold', () => {
    expect(getStatusColor('hold')).toContain('purple');
  });

  it('returns color for in_service', () => {
    expect(getStatusColor('in_service')).toContain('orange');
  });
});

describe('getStatusBgColor', () => {
  it('returns bg color for available', () => {
    expect(getStatusBgColor('available')).toContain('bg-green');
  });

  it('returns bg color for sold', () => {
    expect(getStatusBgColor('sold')).toContain('bg-emerald');
  });

  it('returns bg color for archived', () => {
    expect(getStatusBgColor('archived')).toContain('bg-gray');
  });
});

import { formatDaysOnLot, formatRelativeTime, formatCurrency, formatVin, formatBatteryPct, formatStockNumber } from '../formatters';

// ---------------------------------------------------------------------------
// formatDaysOnLot
// ---------------------------------------------------------------------------

describe('formatDaysOnLot', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns "Today" for same-day arrival', () => {
    expect(formatDaysOnLot('2025-06-15T08:00:00Z')).toBe('Today');
  });

  it('returns "1 day" for yesterday', () => {
    expect(formatDaysOnLot('2025-06-14T10:00:00Z')).toBe('1 day');
  });

  it('returns plural days', () => {
    expect(formatDaysOnLot('2025-05-01T00:00:00Z')).toBe('45 days');
  });
});

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------

describe('formatRelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns "Just now" for < 60s ago', () => {
    expect(formatRelativeTime('2025-06-15T11:59:30Z')).toBe('Just now');
  });

  it('returns minutes ago', () => {
    expect(formatRelativeTime('2025-06-15T11:55:00Z')).toBe('5 min ago');
  });

  it('returns singular hour', () => {
    expect(formatRelativeTime('2025-06-15T11:00:00Z')).toBe('1 hour ago');
  });

  it('returns plural hours', () => {
    expect(formatRelativeTime('2025-06-15T09:00:00Z')).toBe('3 hours ago');
  });

  it('returns singular day', () => {
    expect(formatRelativeTime('2025-06-14T12:00:00Z')).toBe('1 day ago');
  });

  it('returns plural days', () => {
    expect(formatRelativeTime('2025-06-10T12:00:00Z')).toBe('5 days ago');
  });

  it('returns singular month', () => {
    expect(formatRelativeTime('2025-05-15T12:00:00Z')).toBe('1 month ago');
  });

  it('returns plural months', () => {
    expect(formatRelativeTime('2025-03-15T12:00:00Z')).toBe('3 months ago');
  });
});

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------

describe('formatCurrency', () => {
  it('formats a typical price', () => {
    expect(formatCurrency(45999)).toBe('$45,999');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('formats a large amount', () => {
    expect(formatCurrency(1250000)).toBe('$1,250,000');
  });
});

// ---------------------------------------------------------------------------
// formatVin
// ---------------------------------------------------------------------------

describe('formatVin', () => {
  it('truncates a full 17-char VIN', () => {
    expect(formatVin('1HGBH41JXMN109186')).toBe('...MN109186');
  });

  it('returns short VINs as-is in uppercase', () => {
    expect(formatVin('abc1234')).toBe('ABC1234');
  });

  it('returns exactly 8 chars as-is', () => {
    expect(formatVin('abcd1234')).toBe('ABCD1234');
  });
});

// ---------------------------------------------------------------------------
// formatBatteryPct
// ---------------------------------------------------------------------------

describe('formatBatteryPct', () => {
  it('returns green for > 50%', () => {
    const result = formatBatteryPct(75);
    expect(result.text).toBe('75%');
    expect(result.color).toBe('#22C55E');
  });

  it('returns yellow for 20-50%', () => {
    const result = formatBatteryPct(35);
    expect(result.text).toBe('35%');
    expect(result.color).toBe('#EAB308');
  });

  it('returns red for < 20%', () => {
    const result = formatBatteryPct(10);
    expect(result.text).toBe('10%');
    expect(result.color).toBe('#EF4444');
  });

  it('clamps to 0', () => {
    const result = formatBatteryPct(-5);
    expect(result.text).toBe('0%');
    expect(result.color).toBe('#EF4444');
  });

  it('clamps to 100', () => {
    const result = formatBatteryPct(120);
    expect(result.text).toBe('100%');
    expect(result.color).toBe('#22C55E');
  });

  it('rounds decimal values', () => {
    const result = formatBatteryPct(50.6);
    expect(result.text).toBe('51%');
    expect(result.color).toBe('#22C55E');
  });

  it('returns yellow at exactly 20%', () => {
    const result = formatBatteryPct(20);
    expect(result.text).toBe('20%');
    expect(result.color).toBe('#EAB308');
  });
});

// ---------------------------------------------------------------------------
// formatStockNumber
// ---------------------------------------------------------------------------

describe('formatStockNumber', () => {
  it('uppercases a lowercase stock number', () => {
    expect(formatStockNumber('abc-123')).toBe('ABC-123');
  });

  it('keeps an already uppercase number unchanged', () => {
    expect(formatStockNumber('UNIT-456')).toBe('UNIT-456');
  });
});

'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

const cycle = ['system', 'light', 'dark'] as const;

const icons = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} as const;

const labels = {
  system: 'System theme',
  light: 'Light theme',
  dark: 'Dark theme',
} as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const next = () => {
    const idx = cycle.indexOf(theme);
    setTheme(cycle[(idx + 1) % cycle.length]);
  };

  const Icon = icons[theme];

  return (
    <button
      onClick={next}
      className={cn(
        'relative rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)]',
        className,
      )}
      aria-label={labels[theme]}
      title={labels[theme]}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

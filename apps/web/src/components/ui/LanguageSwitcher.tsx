'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Globe } from 'lucide-react';
import { locales, type Locale, defaultLocale } from '@/i18n/config';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Language metadata
// ---------------------------------------------------------------------------

const LANGUAGE_META: Record<Locale, { flag: string; label: string }> = {
  en: { flag: '\ud83c\uddfa\ud83c\uddf8', label: 'English' },
  es: { flag: '\ud83c\uddea\ud83c\uddf8', label: 'Espa\u00f1ol' },
};

const STORAGE_KEY = 'rv-trax-locale';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LanguageSwitcher({ className }: { className?: string }) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && locales.includes(stored)) {
      setLocale(stored);
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback((next: Locale) => {
    setLocale(next);
    localStorage.setItem(STORAGE_KEY, next);
    setOpen(false);
    // When next-intl is wired up, this is where you'd trigger a locale change
    // e.g. router.replace(pathname, { locale: next });
  }, []);

  const current = LANGUAGE_META[locale];

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm',
          'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
          'hover:bg-[var(--color-bg-secondary)] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        )}
        aria-label="Change language"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Globe className="h-4 w-4" />
        <span>{current.flag}</span>
        <span className="hidden sm:inline">{locale.toUpperCase()}</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Select language"
          className={cn(
            'absolute right-0 z-50 mt-1 min-w-[10rem] overflow-hidden rounded-lg border',
            'border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-lg',
            'animate-in fade-in-0 zoom-in-95',
          )}
        >
          {locales.map((l) => {
            const meta = LANGUAGE_META[l];
            const isActive = l === locale;
            return (
              <li
                key={l}
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(l)}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                  'hover:bg-[var(--color-bg-secondary)]',
                  isActive
                    ? 'font-medium text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)]',
                )}
              >
                <span className="text-base">{meta.flag}</span>
                <span>{meta.label}</span>
                {isActive && (
                  <span className="ml-auto text-blue-500" aria-hidden="true">
                    &#10003;
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

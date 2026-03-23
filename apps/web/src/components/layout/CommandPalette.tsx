'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, Package, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchUnits } from '@/lib/api';
import type { Unit } from '@rv-trax/shared';

// ---------------------------------------------------------------------------
// Page/action definitions for command palette search
// ---------------------------------------------------------------------------

interface PageResult {
  id: string;
  label: string;
  href: import('next').Route;
  group: 'Pages';
}

interface UnitResult {
  id: string;
  label: string;
  sublabel: string;
  href: import('next').Route;
  group: 'Units';
}

interface ActionResult {
  id: string;
  label: string;
  action: () => void;
  group: 'Actions';
}

type SearchResult = PageResult | UnitResult | ActionResult;

const PAGE_RESULTS: PageResult[] = [
  { id: 'p-dashboard', label: 'Dashboard', href: '/dashboard', group: 'Pages' },
  { id: 'p-map', label: 'Lot Map', href: '/map', group: 'Pages' },
  { id: 'p-inventory', label: 'Inventory', href: '/inventory', group: 'Pages' },
  { id: 'p-trackers', label: 'Trackers', href: '/trackers', group: 'Pages' },
  { id: 'p-gateways', label: 'Gateways', href: '/gateways', group: 'Pages' },
  { id: 'p-alerts', label: 'Alerts', href: '/alerts', group: 'Pages' },
  { id: 'p-test-drives', label: 'Test Drives', href: '/test-drives', group: 'Pages' },
  { id: 'p-service', label: 'Service', href: '/service', group: 'Pages' },
  { id: 'p-service-bays', label: 'Service Bays', href: '/service/bays', group: 'Pages' },
  { id: 'p-audits', label: 'Floor Plan Audits', href: '/audits', group: 'Pages' },
  { id: 'p-activity', label: 'Staff Activity', href: '/activity', group: 'Pages' },
  { id: 'p-staging', label: 'Staging', href: '/staging', group: 'Pages' },
  { id: 'p-analytics', label: 'Analytics', href: '/analytics', group: 'Pages' },
  { id: 'p-aging', label: 'Inventory Aging', href: '/analytics/aging', group: 'Pages' },
  { id: 'p-pricing', label: 'Pricing Suggestions', href: '/analytics/pricing', group: 'Pages' },
  { id: 'p-settings', label: 'Settings', href: '/settings', group: 'Pages' },
  { id: 'p-users', label: 'User Management', href: '/settings/users', group: 'Pages' },
  { id: 'p-billing', label: 'Billing', href: '/settings/billing', group: 'Pages' },
  {
    id: 'p-notifications',
    label: 'Notification Settings',
    href: '/settings/notifications',
    group: 'Pages',
  },
  { id: 'p-api-keys', label: 'API Keys', href: '/settings/api-keys', group: 'Pages' },
  { id: 'p-webhooks', label: 'Webhooks', href: '/settings/webhooks', group: 'Pages' },
  { id: 'p-dms', label: 'DMS Integration', href: '/settings/dms', group: 'Pages' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Search when query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setActiveIndex(0);
      return;
    }

    const lower = query.toLowerCase();

    // Filter pages
    const pageMatches = PAGE_RESULTS.filter((p) => p.label.toLowerCase().includes(lower));

    setResults(pageMatches);

    // Debounce unit search
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const units = await searchUnits(query);
        const unitResults: UnitResult[] = units.slice(0, 5).map((u: Unit) => ({
          id: `u-${u.id}`,
          label: `#${u.stock_number}`,
          sublabel: `${u.year} ${u.make} ${u.model}`,
          href: `/inventory/${u.id}` as import('next').Route,
          group: 'Units' as const,
        }));
        setResults((prev) => {
          const nonUnits = prev.filter((r) => !('group' in r && r.group === 'Units'));
          return [...unitResults, ...nonUnits];
        });
      } catch {
        // Silently ignore search errors
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query]);

  const selectResult = useCallback(
    (result: SearchResult) => {
      // Save to recent searches
      setRecentSearches((prev) => {
        const updated = [query, ...prev.filter((s) => s !== query)].slice(0, 5);
        return updated;
      });

      setIsOpen(false);

      if ('action' in result) {
        result.action();
      } else {
        router.push(result.href);
      }
    },
    [query, router],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const result = results[activeIndex];
        if (result) selectResult(result);
      }
    },
    [results, activeIndex, selectResult],
  );

  // Group results
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const group = r.group;
    if (!acc[group]) acc[group] = [];
    acc[group]!.push(r);
    return acc;
  }, {});

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div
        className="fixed inset-x-0 top-[15%] z-[101] mx-auto w-full max-w-lg px-4"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-2xl">
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
            <Search className="h-5 w-5 shrink-0 text-[var(--color-text-tertiary)]" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="command-palette-listbox"
              aria-activedescendant={
                results[activeIndex]
                  ? `command-palette-option-${results[activeIndex].id}`
                  : undefined
              }
              aria-autocomplete="list"
              placeholder="Search units by stock#, pages, actions..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
            />
            <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-tertiary)]">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div
            id="command-palette-listbox"
            role="listbox"
            aria-label="Search results"
            className="max-h-80 overflow-y-auto py-2"
          >
            {results.length === 0 && query.trim() && (
              <p className="px-4 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
                No results found for &ldquo;{query}&rdquo;
              </p>
            )}

            {results.length === 0 && !query.trim() && recentSearches.length > 0 && (
              <div className="px-4 py-2">
                <p className="mb-2 text-xs font-medium uppercase text-[var(--color-text-tertiary)]">
                  Recent Searches
                </p>
                {recentSearches.map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                  >
                    <Search className="h-3.5 w-3.5" />
                    {s}
                  </button>
                ))}
              </div>
            )}

            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="px-4 pb-1 pt-3 text-xs font-medium uppercase text-[var(--color-text-tertiary)]">
                  {group}
                </p>
                {items.map((result) => {
                  const globalIndex = results.indexOf(result);
                  return (
                    <button
                      key={result.id}
                      id={`command-palette-option-${result.id}`}
                      role="option"
                      aria-selected={globalIndex === activeIndex}
                      onClick={() => selectResult(result)}
                      onMouseEnter={() => setActiveIndex(globalIndex)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors',
                        globalIndex === activeIndex
                          ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400'
                          : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]',
                      )}
                    >
                      {result.group === 'Units' ? (
                        <Package className="h-4 w-4 shrink-0 opacity-60" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 opacity-60" />
                      )}
                      <div className="flex-1 text-left">
                        <span>{result.label}</span>
                        {'sublabel' in result && (
                          <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">
                            {result.sublabel}
                          </span>
                        )}
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-4 border-t border-[var(--color-border)] px-4 py-2 text-[10px] text-[var(--color-text-tertiary)]">
            <span>
              <kbd className="rounded border border-[var(--color-border)] px-1 py-0.5 font-mono">
                &uarr;
              </kbd>{' '}
              <kbd className="rounded border border-[var(--color-border)] px-1 py-0.5 font-mono">
                &darr;
              </kbd>{' '}
              navigate
            </span>
            <span>
              <kbd className="rounded border border-[var(--color-border)] px-1 py-0.5 font-mono">
                &crarr;
              </kbd>{' '}
              select
            </span>
            <span>
              <kbd className="rounded border border-[var(--color-border)] px-1 py-0.5 font-mono">
                esc
              </kbd>{' '}
              close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

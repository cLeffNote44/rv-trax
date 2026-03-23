'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  TrendingDown,
  BarChart3,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { getPricingSuggestions, type PricingSuggestion } from '@/lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number | null): string {
  if (value == null) return '\u2014';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function confidenceBadge(confidence: PricingSuggestion['confidence']) {
  const styles: Record<string, string> = {
    high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-gray-50 text-gray-600 border-gray-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${styles[confidence]}`}
    >
      {confidence}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="h-[120px] animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]" />
  );
}

function SkeletonTable() {
  return (
    <div className="h-[480px] animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]" />
  );
}

// ---------------------------------------------------------------------------
// Expandable reasoning row
// ---------------------------------------------------------------------------

function ReasoningToggle({ reasoning }: { reasoning: string[] }) {
  const [open, setOpen] = useState(false);

  if (reasoning.length === 0)
    return <span className="text-[var(--color-text-tertiary)]">\u2014</span>;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-brand-600)] transition-colors hover:text-[var(--color-brand-700)]"
      >
        {reasoning.length} factor{reasoning.length !== 1 ? 's' : ''}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <ul className="mt-1.5 space-y-0.5">
          {reasoning.map((r, i) => (
            <li key={i} className="text-xs text-[var(--color-text-secondary)]">
              &bull; {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-bg-secondary)]">
          {icon}
        </div>
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">{title}</p>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PricingSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<PricingSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPricingSuggestions();
      setSuggestions(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Derived summary stats
  const unitsAnalyzed = suggestions.length;
  const avgDiscount =
    unitsAnalyzed > 0
      ? Math.round((suggestions.reduce((sum, s) => sum + s.discount_pct, 0) / unitsAnalyzed) * 10) /
        10
      : 0;
  const totalRevenueImpact = suggestions.reduce((sum, s) => {
    if (s.current_msrp && s.suggested_price < s.current_msrp) {
      return sum + (s.current_msrp - s.suggested_price);
    }
    return sum;
  }, 0);
  const highConfidenceCount = suggestions.filter((s) => s.confidence === 'high').length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Back link */}
      <Link
        href="/analytics"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Analytics
      </Link>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-bg-secondary)]">
            <DollarSign className="h-5 w-5 text-[var(--color-brand-600)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Pricing Suggestions
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Automated pricing recommendations for aging inventory
            </p>
          </div>
        </div>
        {!loading && !error && (
          <span className="inline-flex items-center rounded-full bg-[var(--color-bg-secondary)] px-3 py-1 text-sm font-medium text-[var(--color-text-primary)]">
            {unitsAnalyzed} unit{unitsAnalyzed !== 1 ? 's' : ''} analyzed
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Failed to load pricing suggestions</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <SummaryCard
              title="Units Analyzed"
              value={unitsAnalyzed}
              icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
            />
            <SummaryCard
              title="Avg Suggested Discount"
              value={`${avgDiscount}%`}
              icon={<TrendingDown className="h-5 w-5 text-amber-600" />}
            />
            <SummaryCard
              title="Total Potential Impact"
              value={formatCurrency(totalRevenueImpact)}
              icon={<DollarSign className="h-5 w-5 text-red-600" />}
            />
            <SummaryCard
              title="High Confidence"
              value={highConfidenceCount}
              icon={<ShieldCheck className="h-5 w-5 text-emerald-600" />}
            />
          </>
        )}
      </div>

      {/* Suggestions table */}
      {loading ? (
        <SkeletonTable />
      ) : suggestions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>All Suggestions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    <th className="whitespace-nowrap px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Stock #
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                      Current MSRP
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                      Suggested Price
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                      Discount %
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                      Days on Lot
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                      Market Avg
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-center font-medium text-[var(--color-text-secondary)]">
                      Confidence
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Reasoning
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s) => (
                    <tr
                      key={s.unit_id}
                      className="border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-bg-secondary)]"
                    >
                      <td className="whitespace-nowrap px-6 py-3 font-medium text-[var(--color-text-primary)]">
                        {s.stock_number}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-right text-[var(--color-text-secondary)]">
                        {formatCurrency(s.current_msrp)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-right font-medium text-emerald-700">
                        {formatCurrency(s.suggested_price)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-right">
                        {s.discount_pct > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
                            -{s.discount_pct}%
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--color-text-tertiary)]">0%</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-right">
                        <span
                          className={`text-sm font-medium ${
                            s.days_on_lot > 90
                              ? 'text-red-600'
                              : s.days_on_lot > 60
                                ? 'text-amber-600'
                                : 'text-[var(--color-text-secondary)]'
                          }`}
                        >
                          {s.days_on_lot}d
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-right text-[var(--color-text-secondary)]">
                        {formatCurrency(s.market_avg)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-center">
                        {confidenceBadge(s.confidence)}
                      </td>
                      <td className="px-6 py-3">
                        <ReasoningToggle reasoning={s.reasoning} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[var(--color-border)] px-6 py-3 text-xs text-[var(--color-text-tertiary)]">
              Showing {suggestions.length} unit{suggestions.length !== 1 ? 's' : ''} with pricing
              suggestions. Units in hold, deposit, sold, or delivered status are excluded.
            </div>
          </CardContent>
        </Card>
      ) : !error ? (
        <Card>
          <CardContent className="py-16 text-center">
            <DollarSign className="mx-auto h-12 w-12 text-[var(--color-text-tertiary)]" />
            <p className="mt-4 text-lg font-medium text-[var(--color-text-primary)]">
              No pricing suggestions
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              No units have been on the lot long enough to warrant pricing adjustments, or all
              eligible units are in a protected status.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

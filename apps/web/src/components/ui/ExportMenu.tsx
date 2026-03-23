'use client';

import { useState, useEffect, useRef } from 'react';
import { Download, FileDown, FileJson, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExportMenuProps {
  onExportCsv?: () => void;
  onExportJson?: () => void;
  onPrint?: () => void;
  label?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExportMenu({ onExportCsv, onExportJson, onPrint, label }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const hasOptions = onExportCsv || onExportJson || onPrint;
  if (!hasOptions) return null;

  const items: { icon: typeof FileDown; label: string; onClick: () => void }[] = [];

  if (onExportCsv) {
    items.push({ icon: FileDown, label: 'Export CSV', onClick: onExportCsv });
  }
  if (onExportJson) {
    items.push({ icon: FileJson, label: 'Export JSON', onClick: onExportJson });
  }
  if (onPrint) {
    items.push({ icon: Printer, label: 'Print', onClick: onPrint });
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={label ?? 'Export options'}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium transition-colors',
          'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)]',
          'hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        )}
      >
        <Download className="h-4 w-4" />
        {label && <span className="hidden sm:inline">{label}</span>}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

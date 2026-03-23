'use client';

import { Dialog } from '@/components/ui/Dialog';
import { SHORTCUTS, type Shortcut } from '@/hooks/useKeyboardShortcuts';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ShortcutKey({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-1.5 font-mono text-xs font-medium text-[var(--color-text-secondary)]">
      {children}
    </kbd>
  );
}

function ShortcutKeys({ keys }: { keys: string[] }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((key, idx) => (
        <span key={idx} className="flex items-center gap-1">
          {idx > 0 && <span className="text-xs text-[var(--color-text-tertiary)]">then</span>}
          <ShortcutKey>{key}</ShortcutKey>
        </span>
      ))}
    </span>
  );
}

function ShortcutGroup({ group, shortcuts }: { group: string; shortcuts: Shortcut[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {group}
      </h3>
      <div className="space-y-2">
        {shortcuts.map((shortcut, idx) => (
          <div key={idx} className="flex items-center justify-between rounded-md px-2 py-1.5">
            <span className="text-sm text-[var(--color-text-primary)]">{shortcut.description}</span>
            <ShortcutKeys keys={shortcut.keys} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
  const groups = SHORTCUTS.reduce<Record<string, Shortcut[]>>((acc, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group]!.push(s);
    return acc;
  }, {});

  return (
    <Dialog open={open} onClose={onClose} title="Keyboard Shortcuts">
      <div className="space-y-5">
        {Object.entries(groups).map(([group, shortcuts]) => (
          <ShortcutGroup key={group} group={group} shortcuts={shortcuts} />
        ))}
      </div>
      <div className="mt-4 border-t border-[var(--color-border)] pt-3">
        <p className="text-center text-xs text-[var(--color-text-tertiary)]">
          Press <ShortcutKey>?</ShortcutKey> anytime to toggle this dialog
        </p>
      </div>
    </Dialog>
  );
}

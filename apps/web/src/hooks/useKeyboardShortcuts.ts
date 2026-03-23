'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Shortcut registry
// ---------------------------------------------------------------------------

export interface Shortcut {
  keys: string[];
  description: string;
  group: 'Navigation' | 'Actions';
}

export const SHORTCUTS: Shortcut[] = [
  // Navigation (g-chord sequences)
  { keys: ['g', 'd'], description: 'Go to Dashboard', group: 'Navigation' },
  { keys: ['g', 'm'], description: 'Go to Map', group: 'Navigation' },
  { keys: ['g', 'i'], description: 'Go to Inventory', group: 'Navigation' },
  { keys: ['g', 'a'], description: 'Go to Alerts', group: 'Navigation' },
  { keys: ['g', 't'], description: 'Go to Trackers', group: 'Navigation' },

  // Actions
  { keys: ['n'], description: 'New unit (go to Inventory)', group: 'Actions' },
  { keys: ['s'], description: 'Open command palette', group: 'Actions' },
  { keys: ['?'], description: 'Show keyboard shortcuts', group: 'Actions' },
];

// ---------------------------------------------------------------------------
// Route map for g-chord navigation
// ---------------------------------------------------------------------------

const G_CHORD_ROUTES: Record<string, string> = {
  d: '/dashboard',
  m: '/map',
  i: '/inventory',
  a: '/alerts',
  t: '/trackers',
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const CHORD_TIMEOUT_MS = 500;

export function useKeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingChordRef = useRef<string | null>(null);
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearChord = useCallback(() => {
    pendingChordRef.current = null;
    if (chordTimerRef.current) {
      clearTimeout(chordTimerRef.current);
      chordTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when typing in form elements
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      // Ignore when modifier keys are held (except Shift for ?)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key;

      // Handle second key of g-chord
      if (pendingChordRef.current === 'g') {
        clearChord();
        const route = G_CHORD_ROUTES[key];
        if (route) {
          e.preventDefault();
          router.push(route as import('next').Route);
        }
        return;
      }

      // Start g-chord
      if (key === 'g') {
        pendingChordRef.current = 'g';
        chordTimerRef.current = setTimeout(clearChord, CHORD_TIMEOUT_MS);
        return;
      }

      // Single-key shortcuts
      switch (key) {
        case 'n':
          e.preventDefault();
          router.push('/inventory' as import('next').Route);
          break;
        case 's':
          e.preventDefault();
          // Simulate Cmd+K to open the command palette
          document.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: true,
              bubbles: true,
            }),
          );
          break;
        case '?':
          e.preventDefault();
          setHelpOpen((prev) => !prev);
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearChord();
    };
  }, [router, clearChord]);

  return { helpOpen, setHelpOpen };
}

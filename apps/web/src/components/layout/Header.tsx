'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Search, ChevronDown, User, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NotificationCenter } from '@/components/layout/NotificationCenter';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HeaderProps {
  onMenuClick: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close user menu on Escape
  useEffect(() => {
    if (!showUserMenu) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showUserMenu]);

  // Open command palette on Cmd+K / Ctrl+K
  const handleSearchClick = () => {
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 lg:px-6">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search bar */}
      <button
        onClick={handleSearchClick}
        aria-label="Search units, pages (Ctrl+K)"
        className="flex flex-1 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-tertiary)] transition-colors hover:border-[var(--color-border-hover)] lg:max-w-md"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search units, pages...</span>
        <span className="sm:hidden">Search...</span>
        <kbd className="ml-auto hidden rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-1.5 py-0.5 text-[10px] font-medium sm:inline">
          {typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent)
            ? '\u2318K'
            : 'Ctrl+K'}
        </kbd>
      </button>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notification center */}
        <NotificationCenter />

        {/* User menu */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setShowUserMenu((prev) => !prev)}
            aria-expanded={showUserMenu}
            aria-haspopup="true"
            aria-label="User menu"
            className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-[var(--color-bg-tertiary)]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {user?.name
                ?.split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) ?? '??'}
            </div>
            <ChevronDown className="hidden h-4 w-4 text-[var(--color-text-tertiary)] sm:block" />
          </button>

          {showUserMenu && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] py-1 shadow-lg"
            >
              <div className="border-b border-[var(--color-border)] px-4 py-3">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{user?.name}</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">{user?.email}</p>
              </div>
              <button
                role="menuitem"
                onClick={() => {
                  setShowUserMenu(false);
                  router.push('/settings');
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
              >
                <User className="h-4 w-4" />
                Profile
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setShowUserMenu(false);
                  router.push('/settings');
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
              <div className="border-t border-[var(--color-border)]">
                <button
                  role="menuitem"
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-[var(--color-bg-secondary)]"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Map,
  Package,
  Radio,
  Bell,
  Wrench,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MapPin,
  X,
  Wifi,
  LayoutList,
  Car,
  Activity,
  ClipboardCheck,
} from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { getUnreadAlertCount } from '@/lib/api';

// ---------------------------------------------------------------------------
// Nav item config
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: import('next').Route;
  icon: React.ElementType;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Lot Map', href: '/map', icon: Map },
  { label: 'Inventory', href: '/inventory', icon: Package },
  { label: 'Trackers', href: '/trackers', icon: Radio },
  { label: 'Gateways', href: '/gateways', icon: Wifi },
  { label: 'Alerts', href: '/alerts', icon: Bell },
  { label: 'Test Drives', href: '/test-drives', icon: Car },
  { label: 'Service', href: '/service', icon: Wrench },
  { label: 'Audits', href: '/audits', icon: ClipboardCheck },
  { label: 'Activity', href: '/activity', icon: Activity },
  { label: 'Staging', href: '/staging', icon: LayoutList },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [alertCount, setAlertCount] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Fetch unread alert count
  useEffect(() => {
    getUnreadAlertCount()
      .then((res) => setAlertCount(res.count))
      .catch(() => {});
  }, []);

  // Merge alert badge into nav items
  const navItems = NAV_ITEMS.map((item) =>
    item.label === 'Alerts' ? { ...item, badge: alertCount } : item,
  );

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[var(--color-bg-sidebar)]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600">
          <MapPin className="h-5 w-5 text-white" />
        </div>
        {!collapsed && <span className="text-lg font-bold text-white">RV Trax</span>}

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="ml-auto text-slate-400 hover:text-white lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onCloseMobile}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white',
                collapsed && 'justify-center px-2',
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </>
              )}
              {collapsed && item.badge !== undefined && item.badge > 0 && (
                <span className="absolute right-1 top-0.5 h-2 w-2 rounded-full bg-red-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden border-t border-white/10 px-3 py-2 lg:block">
        <button
          onClick={onToggleCollapse}
          className="flex w-full items-center justify-center rounded-lg py-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* User section */}
      <div className="relative border-t border-white/10 p-3">
        <button
          onClick={() => setShowUserMenu((prev) => !prev)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/5',
            collapsed && 'justify-center px-2',
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {user?.name
              ?.split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) ?? '??'}
          </div>
          {!collapsed && (
            <div className="flex-1 text-left">
              <p className="truncate font-medium text-white">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{user?.role}</p>
            </div>
          )}
        </button>

        {/* User dropdown */}
        {showUserMenu && (
          <div className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border border-white/10 bg-slate-800 py-1 shadow-lg">
            <button
              onClick={() => {
                setShowUserMenu(false);
                logout();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/5"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden flex-col border-r border-white/5 transition-all duration-300 lg:flex',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onCloseMobile} />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

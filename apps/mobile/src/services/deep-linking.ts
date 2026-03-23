/**
 * Deep linking configuration for RV Trax mobile app.
 *
 * URL scheme: rvtrax://
 * Universal links: https://app.rvtrax.com/
 *
 * Supported paths:
 * - /units/:id         -> Unit detail screen
 * - /alerts/:id        -> Alert detail
 * - /work-orders/:id   -> Work order detail
 * - /map               -> Map screen
 * - /scan              -> Scanner screen
 */

import { LinkingOptions } from '@react-navigation/native';

export const DEEP_LINK_PREFIX = ['rvtrax://', 'https://app.rvtrax.com/'];

export const linking: LinkingOptions<any> = {
  prefixes: DEEP_LINK_PREFIX,
  config: {
    screens: {
      Main: {
        screens: {
          MapTab: {
            path: 'map',
            screens: {
              Map: '',
              UnitDetail: 'units/:id',
            },
          },
          SearchTab: {
            path: 'search',
          },
          ScanTab: {
            path: 'scan',
          },
          TasksTab: {
            path: 'tasks',
            screens: {
              Tasks: '',
              WorkOrderDetail: 'work-orders/:id',
            },
          },
          AccountTab: {
            path: 'account',
          },
        },
      },
      Auth: {
        path: 'auth',
        screens: {
          Login: 'login',
        },
      },
    },
  },
};

/**
 * Handle incoming deep link and extract route info.
 */
export function parseDeepLink(
  url: string,
): { screen: string; params?: Record<string, string> } | null {
  try {
    const parsed = new URL(url.replace('rvtrax://', 'https://app.rvtrax.com/'));
    const path = parsed.pathname;

    // /units/:id
    const unitMatch = path.match(/^\/units\/([a-f0-9-]+)$/);
    if (unitMatch) {
      return { screen: 'UnitDetail', params: { id: unitMatch[1]! } };
    }

    // /work-orders/:id
    const woMatch = path.match(/^\/work-orders\/([a-f0-9-]+)$/);
    if (woMatch) {
      return { screen: 'WorkOrderDetail', params: { id: woMatch[1]! } };
    }

    // /map
    if (path === '/map') return { screen: 'Map' };

    // /scan
    if (path === '/scan') return { screen: 'Scan' };

    return null;
  } catch {
    return null;
  }
}

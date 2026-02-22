import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRole(role: string | undefined): string {
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

const APP_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AccountScreen: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore((s) => s.setNotificationsEnabled);
  const darkMode = useSettingsStore((s) => s.darkMode);
  const setDarkMode = useSettingsStore((s) => s.setDarkMode);
  const mapTypeSatellite = useSettingsStore((s) => s.mapTypeSatellite);
  const setMapTypeSatellite = useSettingsStore((s) => s.setMapTypeSatellite);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  }, [logout]);

  const handleAbout = useCallback(() => {
    Linking.openURL('https://rvtrax.com/about');
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* User Info */}
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'Unknown User'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
        {user?.role && (
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {formatRole(user?.role)}
            </Text>
          </View>
        )}
      </View>

      {/* Dealership */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Dealership</Text>
        <Text style={styles.dealershipName}>
          {user?.dealershipName || 'Your Dealership'}
        </Text>
      </View>

      {/* Settings */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Settings</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Notifications</Text>
            <Text style={styles.settingDesc}>Receive push notifications</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ true: colors.primary, false: colors.gray300 }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.settingDivider} />

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Dark Mode</Text>
            <Text style={styles.settingDesc}>Use dark theme</Text>
          </View>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ true: colors.primary, false: colors.gray300 }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.settingDivider} />

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Satellite Map</Text>
            <Text style={styles.settingDesc}>Default to satellite view</Text>
          </View>
          <Switch
            value={mapTypeSatellite}
            onValueChange={setMapTypeSatellite}
            trackColor={{ true: colors.primary, false: colors.gray300 }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
        activeOpacity={0.8}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* About & Version */}
      <TouchableOpacity style={styles.aboutLink} onPress={handleAbout}>
        <Text style={styles.aboutText}>About RV Trax</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>Version {APP_VERSION}</Text>
    </ScrollView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },

  // Profile
  profileSection: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.white,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray900,
  },
  userEmail: {
    fontSize: 14,
    color: colors.gray500,
    marginTop: 2,
  },
  roleBadge: {
    marginTop: spacing.sm,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },

  // Section
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  dealershipName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
  },

  // Settings
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray800,
  },
  settingDesc: {
    fontSize: 13,
    color: colors.gray500,
    marginTop: 1,
  },
  settingDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 6,
  },

  // Sign Out
  signOutButton: {
    backgroundColor: colors.error,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  signOutText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // About
  aboutLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  aboutText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.gray400,
    marginTop: spacing.sm,
  },
});

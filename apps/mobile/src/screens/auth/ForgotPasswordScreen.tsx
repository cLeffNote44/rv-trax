import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/services/api';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendReset = useCallback(async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await api.post('api/v1/auth/forgot-password', {
        json: { email: email.trim() },
      });
      setSent(true);
    } catch {
      setError('Unable to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [email]);

  if (sent) {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <View style={styles.successIconBox}>
            <Text style={styles.checkMark}>{'\\u2713'}</Text>
          </View>
          <Text style={styles.successTitle}>Check your email</Text>
          <Text style={styles.successMessage}>
            We sent a password reset link to{'\n'}
            <Text style={styles.emailHighlight}>{email.trim()}</Text>
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter the email address associated with your account and we'll send
          you a link to reset your password.
        </Text>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.inputWrapper}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@dealership.com"
            placeholderTextColor={colors.gray400}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            autoFocus
            value={email}
            onChangeText={setEmail}
            editable={!loading}
            onSubmitEditing={handleSendReset}
            returnKeyType="send"
          />
        </View>

        <TouchableOpacity
          style={[styles.sendButton, loading && styles.sendButtonDisabled]}
          onPress={handleSendReset}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.sendText}>Send Reset Link</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backLink}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.backLinkText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: colors.gray500,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  inputWrapper: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.gray900,
    backgroundColor: colors.white,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  backLink: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  backLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  // Success state
  successIconBox: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  checkMark: {
    fontSize: 48,
    color: colors.success,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray900,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  successMessage: {
    fontSize: 15,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  emailHighlight: {
    fontWeight: '600',
    color: colors.gray700,
  },
  backButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

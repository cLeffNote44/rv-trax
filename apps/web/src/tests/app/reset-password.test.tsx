import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock Next.js navigation
const mockPush = vi.fn();
const mockGet = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGet }),
}));

// Mock apiFetch
const mockApiFetch = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  MapPin: (props: any) => <svg data-testid="map-pin-icon" {...props} />,
  Loader2: (props: any) => <svg data-testid="loader-icon" {...props} />,
}));

import ResetPasswordPage from '@/app/(auth)/reset-password/page';

beforeEach(() => {
  mockPush.mockReset();
  mockGet.mockReset();
  mockApiFetch.mockReset();
});

describe('ResetPasswordPage', () => {
  it('shows invalid link message when no token', () => {
    mockGet.mockReturnValue(null);
    render(<ResetPasswordPage />);

    expect(screen.getByText('Invalid Link')).toBeInTheDocument();
    expect(screen.getByText(/request a new reset link/i)).toBeInTheDocument();
  });

  it('renders the reset form when token is present', () => {
    mockGet.mockReturnValue('valid-token-123');
    render(<ResetPasswordPage />);

    expect(screen.getByRole('heading', { name: 'New Password' })).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });

  it('validates minimum password length', async () => {
    mockGet.mockReturnValue('valid-token-123');
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText(/new password/i), 'short');
    await user.type(screen.getByLabelText(/confirm password/i), 'short');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('validates passwords match', async () => {
    mockGet.mockReturnValue('valid-token-123');
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText(/new password/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'different456');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('calls API with token and shows success', async () => {
    mockGet.mockReturnValue('valid-token-123');
    mockApiFetch.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText(/new password/i), 'newpassword123');
    await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/auth/reset-password', {
        method: 'POST',
        body: { token: 'valid-token-123', password: 'newpassword123' },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/password reset successfully/i)).toBeInTheDocument();
    });
  });

  it('displays error on API failure', async () => {
    mockGet.mockReturnValue('expired-token');
    mockApiFetch.mockRejectedValueOnce(new Error('Token expired'));
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText(/new password/i), 'newpassword123');
    await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/token expired/i)).toBeInTheDocument();
    });
  });

  it('has a sign in link', () => {
    mockGet.mockReturnValue('valid-token-123');
    render(<ResetPasswordPage />);
    const link = screen.getByText('Sign in');
    expect(link).toHaveAttribute('href', '/login');
  });
});

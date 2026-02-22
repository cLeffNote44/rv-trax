import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
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

import ForgotPasswordPage from '@/app/(auth)/forgot-password/page';

beforeEach(() => {
  mockApiFetch.mockReset();
});

describe('ForgotPasswordPage', () => {
  it('renders the forgot password form', () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByText('Reset Password')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('validates email before submitting', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });

  it('does not submit with empty email', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });

  it('calls API and shows success message on valid submit', async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValueOnce(undefined);

    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText(/email/i), 'test@dealership.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/auth/forgot-password', {
        method: 'POST',
        body: { email: 'test@dealership.com' },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/password reset link has been sent/i)).toBeInTheDocument();
    });
  });

  it('displays error on API failure', async () => {
    const user = userEvent.setup();
    mockApiFetch.mockRejectedValueOnce(new Error('Server error'));

    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText(/email/i), 'test@dealership.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
  });

  it('has a sign in link', () => {
    render(<ForgotPasswordPage />);
    const link = screen.getByText('Sign in');
    expect(link).toHaveAttribute('href', '/login');
  });
});

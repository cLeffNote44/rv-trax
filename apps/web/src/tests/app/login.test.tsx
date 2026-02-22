import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: vi.fn(() => null),
  }),
}));

// Mock AuthProvider
const mockLogin = vi.fn();
vi.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    logout: vi.fn(),
  }),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  MapPin: (props: any) => <svg data-testid="map-pin-icon" {...props} />,
  Loader2: (props: any) => <svg data-testid="loader-icon" {...props} />,
}));

import LoginPage from '@/app/(auth)/login/page';

beforeEach(() => {
  mockPush.mockClear();
  mockLogin.mockClear();
});

describe('LoginPage', () => {
  it('renders the login form', () => {
    render(<LoginPage />);

    expect(screen.getByText('RV Trax')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your dealership dashboard')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('does not submit with empty fields', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // Validation should prevent login from being called
    await waitFor(() => {
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  it('does not submit with invalid email', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // Zod validation should prevent login from being called
    await waitFor(() => {
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  it('calls login and redirects on success', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce(undefined);

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'test@dealership.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@dealership.com',
        password: 'password123',
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('displays error message on login failure', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(new Error('Invalid email or password'));

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'test@dealership.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });

  it('has a forgot password link', () => {
    render(<LoginPage />);
    const link = screen.getByText('Reset it');
    expect(link).toHaveAttribute('href', '/forgot-password');
  });
});

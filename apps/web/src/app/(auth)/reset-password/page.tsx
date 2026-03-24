'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MapPin } from 'lucide-react';
import { apiFetch } from '@/lib/api';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const resetSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetFormValues = z.infer<typeof resetSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ResetFormValues) => {
    setError(null);

    if (!token) {
      setError('Missing reset token. Please use the link from your email.');
      return;
    }

    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: { token, password: data.password },
      });
      setSuccess(true);
      // Redirect to login after a brief delay
      setTimeout(() => router.push('/login'), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to reset password. The link may have expired.',
      );
    }
  };

  if (!token) {
    return (
      <div className="w-full max-w-md px-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-sm text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-red-600">
            <MapPin className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Invalid Link</h1>
          <p className="text-sm text-slate-400 mb-6">
            This password reset link is invalid or has expired.
          </p>
          <a href="/forgot-password" className="text-blue-400 hover:text-blue-300 text-sm">
            Request a new reset link
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md px-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600">
            <MapPin className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">New Password</h1>
          <p className="mt-1 text-sm text-slate-400">Choose a new password for your account</p>
        </div>

        {success ? (
          <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
            Password reset successfully! Redirecting to login...
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <Input
                label="New Password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                error={errors.password?.message}
                className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-blue-500"
                labelClassName="text-slate-300"
                {...register('password')}
              />

              <Input
                label="Confirm Password"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter your password"
                error={errors.confirmPassword?.message}
                className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-blue-500"
                labelClassName="text-slate-300"
                {...register('confirmPassword')}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isSubmitting}
              >
                Reset Password
              </Button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          Remember your password?{' '}
          <a href="/login" className="text-blue-400 hover:text-blue-300">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

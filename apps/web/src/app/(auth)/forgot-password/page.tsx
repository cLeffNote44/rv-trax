'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiFetch } from '@/lib/api';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const forgotSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotFormValues) => {
    setError(null);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: { email: data.email },
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-md px-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <img src="/icons/icon.svg" alt="RV Trax" className="mx-auto mb-3 h-14 w-14 rounded-xl" />
          <h1 className="text-2xl font-bold">
            <span className="text-[#E8D5B5]">RV</span>
            <span className="text-[#C4943D]"> Trax</span>
          </h1>
          <p className="mt-1 text-sm text-[#B5A48A]">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        {submitted ? (
          <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
            If an account with that email exists, a password reset link has been sent. Check your
            inbox.
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
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="you@dealership.com"
                error={errors.email?.message}
                className="border-white/10 bg-white/5 text-white placeholder:text-[#9a8876] focus:border-[#C4943D]"
                labelClassName="text-[#D4C4A8]"
                {...register('email')}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isSubmitting}
              >
                Send Reset Link
              </Button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-[#9a8876]">
          Remember your password?{' '}
          <a href="/login" className="text-[#D4A456] hover:text-[#E8D5B5]">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

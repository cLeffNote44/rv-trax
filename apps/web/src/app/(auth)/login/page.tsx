'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    try {
      await login(data);
      const redirect = searchParams.get('redirect') ?? '/dashboard';
      // Prevent open redirect attacks — only allow relative paths
      const safeRedirect =
        redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/dashboard';
      router.push(safeRedirect as import('next').Route);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
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
          <p className="mt-1 text-sm text-[#B5A48A]">Sign in to your dealership dashboard</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@dealership.com"
            error={errors.email?.message}
            className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-[#C4943D]"
            labelClassName="text-slate-300"
            {...register('email')}
          />

          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            error={errors.password?.message}
            className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-[#C4943D]"
            labelClassName="text-slate-300"
            {...register('password')}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={isSubmitting}
          >
            Sign In
          </Button>
        </form>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-slate-500">
          Forgot your password?{' '}
          <a href="/forgot-password" className="text-[#D4A456] hover:text-[#E8D5B5]">
            Reset it
          </a>
        </p>
      </div>
    </div>
  );
}

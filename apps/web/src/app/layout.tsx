import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import { AuthProvider } from '@/providers/AuthProvider';
import { PostHogProvider } from '@/components/providers/PostHogProvider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'RV Trax — Real-Time RV Lot Management',
    template: '%s | RV Trax',
  },
  description:
    'Real-time GPS tracking and lot management for RV dealerships. Track inventory, monitor LoRaWAN devices, optimize staging, and streamline operations.',
  keywords: [
    'RV dealership',
    'lot management',
    'GPS tracking',
    'inventory management',
    'LoRaWAN',
    'asset tracking',
    'dealership software',
  ],
  authors: [{ name: 'RV Trax' }],
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'RV Trax',
    title: 'RV Trax — Real-Time RV Lot Management',
    description:
      'Track every unit on your lot in real time. GPS-powered inventory management built for RV dealerships.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RV Trax — Real-Time RV Lot Management',
    description:
      'Track every unit on your lot in real time. GPS-powered inventory management built for RV dealerships.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--color-bg-primary)] font-sans antialiased">
        <AuthProvider>
          <Suspense fallback={null}>
            <PostHogProvider>{children}</PostHogProvider>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}

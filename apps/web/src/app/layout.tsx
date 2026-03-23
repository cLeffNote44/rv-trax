import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import { AuthProvider } from '@/providers/AuthProvider';
import { PostHogProvider } from '@/components/providers/PostHogProvider';
import { ServiceWorkerProvider } from '@/components/providers/ServiceWorkerProvider';
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
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
    other: [
      { rel: 'icon', type: 'image/png', sizes: '192x192', url: '/icons/icon-192.png' },
      { rel: 'icon', type: 'image/png', sizes: '512x512', url: '/icons/icon-512.png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RV Trax',
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
  other: {
    'mobile-web-app-capable': 'yes',
    'theme-color': '#2563eb',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
          (function() {
            var t = localStorage.getItem('rv-trax-theme');
            var d = document.documentElement;
            if (t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
              d.classList.add('dark');
            }
          })();
        `,
          }}
        />
      </head>
      <body className="min-h-screen bg-[var(--color-bg-primary)] font-sans antialiased">
        <AuthProvider>
          <Suspense fallback={null}>
            <PostHogProvider>
              <ServiceWorkerProvider />
              {children}
            </PostHogProvider>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}

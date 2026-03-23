'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Sparkles, MapPin, Radio, Package, Tag, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/hooks/useOnboarding';

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

interface Step {
  icon: React.ElementType;
  title: string;
  description: string;
  linkHref?: string;
  linkLabel?: string;
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: 'Welcome to RV Trax!',
    description:
      'Track every unit on your lot in real-time with LoRaWAN-powered GPS trackers. This quick setup guide will walk you through getting your dealership up and running.',
  },
  {
    icon: MapPin,
    title: 'Create Your Lot',
    description:
      'Define your dealership lot boundaries so RV Trax can map your inventory. Draw your lot perimeter and label key zones like sales, service, and storage areas.',
    linkHref: '/settings/lots',
    linkLabel: 'Go to Lot Settings',
  },
  {
    icon: Radio,
    title: 'Add Gateways',
    description:
      'LoRaWAN gateways receive signals from your trackers and relay position data to the cloud. Place at least one gateway on your lot for coverage.',
    linkHref: '/gateways',
    linkLabel: 'Manage Gateways',
  },
  {
    icon: Package,
    title: 'Import Inventory',
    description:
      'Bring in your current RV inventory from your DMS or a CSV file. Each unit gets a real-time location card once a tracker is assigned.',
    linkHref: '/inventory',
    linkLabel: 'View Inventory',
  },
  {
    icon: Tag,
    title: 'Assign Trackers',
    description:
      "Pair physical tracker devices with your inventory units. Once assigned, you'll see live locations on the lot map and receive movement alerts.",
    linkHref: '/trackers',
    linkLabel: 'Manage Trackers',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OnboardingWizard() {
  const router = useRouter();
  const { isComplete, currentStep, setCurrentStep, complete } = useOnboarding();

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      complete();
    }
  }, [currentStep, setCurrentStep, complete]);

  const handleDismiss = useCallback(() => {
    complete();
  }, [complete]);

  const handleLink = useCallback(
    (href: string) => {
      complete();
      router.push(href as import('next').Route);
    },
    [complete, router],
  );

  if (isComplete) return null;

  const step = STEPS[currentStep]!;
  const Icon = step.icon;
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-2xl">
        {/* Close button */}
        <div className="flex justify-end px-4 pt-4">
          <button
            onClick={handleDismiss}
            className="rounded-lg p-1 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            aria-label="Close onboarding"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center px-8 pb-4 pt-2 text-center">
          {/* Icon */}
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/10">
            <Icon className="h-8 w-8 text-blue-600" />
          </div>

          {/* Step counter */}
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Step {currentStep + 1} of {STEPS.length}
          </p>

          {/* Title */}
          <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
            {step.title}
          </h2>

          {/* Description */}
          <p className="mb-6 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {step.description}
          </p>

          {/* Link to relevant page */}
          {step.linkHref && (
            <button
              onClick={() => handleLink(step.linkHref!)}
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {step.linkLabel}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {/* Action buttons */}
          <div className="flex w-full items-center justify-center gap-3">
            <button
              onClick={handleNext}
              className={cn(
                'inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium transition-colors',
                'bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
              )}
            >
              {isLastStep ? 'Get Started' : 'Next'}
            </button>
            {!isLastStep && (
              <button
                onClick={handleDismiss}
                className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
              >
                Skip
              </button>
            )}
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 border-t border-[var(--color-border)] px-6 py-4">
          {STEPS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              aria-label={`Go to step ${idx + 1}`}
              className={cn(
                'h-2 rounded-full transition-all',
                idx === currentStep
                  ? 'w-6 bg-blue-600'
                  : 'w-2 bg-[var(--color-border)] hover:bg-[var(--color-text-tertiary)]',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

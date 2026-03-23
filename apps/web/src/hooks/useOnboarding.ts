'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'rv-trax-onboarding-complete';

export function useOnboarding() {
  // Default to true to prevent flash of onboarding on load
  const [isComplete, setIsComplete] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const complete = localStorage.getItem(STORAGE_KEY);
    if (!complete) setIsComplete(false);
  }, []);

  const complete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsComplete(true);
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setIsComplete(false);
    setCurrentStep(0);
  }, []);

  return { isComplete, currentStep, setCurrentStep, complete, reset };
}

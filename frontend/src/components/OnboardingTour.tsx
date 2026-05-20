import React, { useState, useEffect, useCallback } from 'react';

interface TourStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector for element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void;
}

interface OnboardingTourProps {
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
  isOpen: boolean;
}

const DEFAULT_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to LabOS v2!',
    content: 'Your comprehensive Laboratory Operations System. Let\'s take a quick tour to get you started.',
    position: 'center',
  },
  {
    id: 'sidebar',
    title: 'Navigation Sidebar',
    content: 'Use the sidebar to navigate between different modules. Categories can be expanded or collapsed.',
    target: '.sidebar',
    position: 'right',
  },
  {
    id: 'search',
    title: 'Global Search',
    content: 'Quickly find samples, equipment, documents, and more. Press Cmd+K (or Ctrl+K) to open search.',
    target: '.global-search-wrapper',
    position: 'bottom',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    content: 'Stay updated with alerts, reminders, and important messages. The badge shows unread count.',
    target: '.notifications-wrapper',
    position: 'bottom',
  },
  {
    id: 'theme',
    title: 'Theme Settings',
    content: 'Switch between Dark, Light, or System theme to match your preference.',
    target: '.sidebar-footer',
    position: 'top',
  },
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    content: 'Your central hub for lab activities, quick stats, pending tasks, and recent events.',
    position: 'center',
  },
  {
    id: 'modules',
    title: 'Lab Modules',
    content: 'Access specialized modules for Samples, Equipment, Experiments, Documents, and more.',
    position: 'center',
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    content: 'You can restart this tour anytime from Settings. Happy experimenting!',
    position: 'center',
  },
];

export function OnboardingTour({ steps = DEFAULT_TOUR_STEPS, onComplete, onSkip, isOpen }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  // Update highlight position when step changes
  useEffect(() => {
    if (step?.target && isOpen) {
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setHighlightRect(rect);
        // Scroll element into view if needed
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setHighlightRect(null);
      }
    } else {
      setHighlightRect(null);
    }
  }, [currentStep, step?.target, isOpen]);

  const handleNext = useCallback(() => {
    if (step.action) {
      step.action();
    }
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [step, isLastStep, onComplete]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  }, [isFirstStep]);

  const handleSkip = useCallback(() => {
    onSkip();
    setCurrentStep(0);
  }, [onSkip]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        handleSkip();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, handleSkip]);

  if (!isOpen) return null;

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!highlightRect || step.position === 'center') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = 16;
    const tooltipWidth = 360;
    const tooltipHeight = 200;

    switch (step.position) {
      case 'top':
        return {
          top: highlightRect.top - tooltipHeight - padding,
          left: highlightRect.left + highlightRect.width / 2 - tooltipWidth / 2,
        };
      case 'bottom':
        return {
          top: highlightRect.bottom + padding,
          left: Math.max(padding, Math.min(
            highlightRect.left + highlightRect.width / 2 - tooltipWidth / 2,
            window.innerWidth - tooltipWidth - padding
          )),
        };
      case 'left':
        return {
          top: highlightRect.top + highlightRect.height / 2 - tooltipHeight / 2,
          left: highlightRect.left - tooltipWidth - padding,
        };
      case 'right':
        return {
          top: highlightRect.top + highlightRect.height / 2 - tooltipHeight / 2,
          left: highlightRect.right + padding,
        };
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          zIndex: 9998,
        }}
        onClick={handleSkip}
      />

      {/* Highlight cutout */}
      {highlightRect && (
        <div
          style={{
            position: 'fixed',
            top: highlightRect.top - 8,
            left: highlightRect.left - 8,
            width: highlightRect.width + 16,
            height: highlightRect.height + 16,
            border: '3px solid var(--accent)',
            borderRadius: 12,
            background: 'transparent',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        style={{
          position: 'fixed',
          ...getTooltipStyle(),
          width: 360,
          background: 'var(--surface)',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          zIndex: 10000,
          overflow: 'hidden',
        }}
      >
        {/* Progress bar */}
        <div style={{ height: 4, background: 'var(--border)' }}>
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'var(--accent)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        <div style={{ padding: 24 }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{
              padding: '4px 10px',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
            }}>
              Step {currentStep + 1} of {steps.length}
            </span>
            <button
              onClick={handleSkip}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 12,
                padding: '4px 8px',
              }}
            >
              Skip Tour
            </button>
          </div>

          {/* Content */}
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>
            {step.title}
          </h3>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 24px', lineHeight: 1.6, fontSize: 14 }}>
            {step.content}
          </p>

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={handlePrev}
              disabled={isFirstStep}
              style={{
                padding: '10px 20px',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: isFirstStep ? 'var(--text-muted)' : 'var(--text)',
                cursor: isFirstStep ? 'not-allowed' : 'pointer',
                opacity: isFirstStep ? 0.5 : 1,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Previous
            </button>

            {/* Step dots */}
            <div style={{ display: 'flex', gap: 6 }}>
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    border: 'none',
                    background: i === currentStep ? 'var(--accent)' : 'var(--border)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              style={{
                padding: '10px 20px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {isLastStep ? 'Get Started' : 'Next'}
            </button>
          </div>

          {/* Keyboard hint */}
          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
            Use arrow keys to navigate | Press Esc to skip
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Hook to manage onboarding tour state
 */
export function useOnboardingTour(storageKey: string = 'labos_onboarding_completed') {
  const [isOpen, setIsOpen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(() => {
    return localStorage.getItem(storageKey) === 'true';
  });

  // Show tour on first visit
  useEffect(() => {
    if (!hasCompleted) {
      // Small delay to let the app render first
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [hasCompleted]);

  const startTour = useCallback(() => {
    setIsOpen(true);
  }, []);

  const completeTour = useCallback(() => {
    setIsOpen(false);
    setHasCompleted(true);
    localStorage.setItem(storageKey, 'true');
  }, [storageKey]);

  const skipTour = useCallback(() => {
    setIsOpen(false);
    setHasCompleted(true);
    localStorage.setItem(storageKey, 'true');
  }, [storageKey]);

  const resetTour = useCallback(() => {
    setHasCompleted(false);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    isOpen,
    hasCompleted,
    startTour,
    completeTour,
    skipTour,
    resetTour,
  };
}

/**
 * Feature Spotlight Component
 * Highlights a specific feature with a callout
 */
interface FeatureSpotlightProps {
  title: string;
  description: string;
  isNew?: boolean;
  onDismiss: () => void;
}

export function FeatureSpotlight({ title, description, isNew, onDismiss }: FeatureSpotlightProps) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--accent), #6366f1)',
      borderRadius: 12,
      padding: 20,
      color: '#fff',
      position: 'relative',
      marginBottom: 16,
    }}>
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          borderRadius: '50%',
          width: 24,
          height: 24,
          cursor: 'pointer',
          color: '#fff',
          fontSize: 14,
        }}
      >
        x
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
        }}>
          *
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h4>
            {isNew && (
              <span style={{
                padding: '2px 8px',
                background: 'rgba(255,255,255,0.3)',
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 600,
              }}>
                NEW
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.9, lineHeight: 1.5 }}>{description}</p>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_TOUR_STEPS };
export default OnboardingTour;

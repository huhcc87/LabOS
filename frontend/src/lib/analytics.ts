/**
 * Lightweight analytics module.
 * Supports PostHog or any analytics provider via environment variables.
 * Falls back to console logging in development.
 */

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, unknown>;
  timestamp?: number;
}

let initialized = false;
let posthog: any = null;

export async function initAnalytics() {
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
  const posthogHost = import.meta.env.VITE_POSTHOG_HOST ?? "https://app.posthog.com";

  if (posthogKey) {
    try {
      const ph = await import("posthog-js");
      posthog = ph.default;
      posthog.init(posthogKey, {
        api_host: posthogHost,
        capture_pageview: true,
        capture_pageleave: true,
        persistence: "localStorage",
        autocapture: false, // manual tracking only for HIPAA-type compliance
      });
      initialized = true;
    } catch {
      console.warn("[Analytics] PostHog failed to load, falling back to console");
    }
  }
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  const payload: AnalyticsEvent = {
    event,
    properties: { ...properties, url: window.location.pathname },
    timestamp: Date.now(),
  };

  if (import.meta.env.DEV) {
    console.log("[Analytics]", payload.event, payload.properties);
  }

  if (initialized && posthog) {
    posthog.capture(event, properties);
  }
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (initialized && posthog) {
    posthog.identify(userId, traits);
  }
}

export function trackPageView(pageName: string) {
  trackEvent("$pageview", { page: pageName });
}

export function resetAnalytics() {
  if (initialized && posthog) {
    posthog.reset();
  }
}

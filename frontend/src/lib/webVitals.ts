import { onCLS, onINP, onLCP, onFCP, onTTFB, type MetricType } from "web-vitals";

function reportMetric(metric: MetricType) {
  // Log to console in dev
  if (import.meta.env.DEV) {
    console.log(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`);
  }

  // Send to analytics endpoint if configured
  const analyticsUrl = import.meta.env.VITE_ANALYTICS_URL;
  if (analyticsUrl) {
    navigator.sendBeacon?.(
      analyticsUrl,
      JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        navigationType: metric.navigationType,
        timestamp: Date.now(),
      })
    );
  }
}

export function initWebVitals() {
  onCLS(reportMetric);
  onINP(reportMetric);
  onLCP(reportMetric);
  onFCP(reportMetric);
  onTTFB(reportMetric);
}

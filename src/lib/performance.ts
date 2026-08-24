type MetricName = "FCP" | "LCP" | "CLS" | "INP" | "TTFB";

const measurements = new Map<MetricName, number>();
let monitoringStarted = false;
let flushRegistered = false;

function recordMetric(metric: MetricName, value: number) {
  if (!Number.isFinite(value)) return;
  measurements.set(metric, Math.round(value * 1000) / 1000);
}

function flushAnalytics() {
  if (measurements.size === 0 || typeof navigator === "undefined") return;

  const metrics = Object.fromEntries(measurements) as Record<MetricName, number>;
  measurements.clear();

  const payload = JSON.stringify({
    metric: "web-vitals",
    value: 0,
    metrics,
    url: window.location.href,
    timestamp: Date.now(),
  });

  // Performance telemetry is strictly best-effort. A navigation must never be
  // delayed or retried merely because the analytics endpoint is unavailable.
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/v1/analytics/performance", payload);
  }
}

function observe(entryTypes: string[], callback: (entries: PerformanceEntry[]) => void) {
  if (typeof PerformanceObserver === "undefined") return;

  try {
    const observer = new PerformanceObserver((list) => callback(list.getEntries()));
    observer.observe({ entryTypes });
  } catch {
    // Some browsers expose PerformanceObserver but do not support every entry
    // type. Unsupported telemetry must remain invisible to the product flow.
  }
}

export function initPerformanceMonitoring() {
  if (monitoringStarted || typeof window === "undefined") return;
  monitoringStarted = true;

  observe(["paint"], (entries) => {
    const firstContentfulPaint = entries.find((entry) => entry.name === "first-contentful-paint");
    if (firstContentfulPaint) recordMetric("FCP", firstContentfulPaint.startTime);
  });

  observe(["largest-contentful-paint"], (entries) => {
    const lastEntry = entries.at(-1);
    if (lastEntry) recordMetric("LCP", lastEntry.startTime);
  });

  let clsValue = 0;
  observe(["layout-shift"], (entries) => {
    for (const entry of entries) {
      const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
      if (!layoutShift.hadRecentInput && typeof layoutShift.value === "number") {
        clsValue += layoutShift.value;
      }
    }
    recordMetric("CLS", clsValue);
  });

  if ("PerformanceEventTiming" in window) {
    observe(["event"], (entries) => {
      const lastEntry = entries.at(-1) as (PerformanceEntry & { duration?: number }) | undefined;
      if (lastEntry?.duration) recordMetric("INP", lastEntry.duration);
    });
  }

  const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (navigationEntry) recordMetric("TTFB", navigationEntry.responseStart);

  if (!flushRegistered) {
    flushRegistered = true;
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushAnalytics();
    });
    window.addEventListener("pagehide", flushAnalytics);
  }
}

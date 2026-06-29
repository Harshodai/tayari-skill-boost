// Web Vitals monitoring
export function initPerformanceMonitoring() {
  // Core Web Vitals
  if ('web-vital' in window) return; // Already loaded
  
  // Measure FCP
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log(`FCP: ${entry.startTime}ms`);
      sendToAnalytics('FCP', entry.startTime);
    }
  }).observe({ entryTypes: ['paint'] });
  
  // Measure LCP
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    console.log(`LCP: ${lastEntry.startTime}ms`);
    sendToAnalytics('LCP', lastEntry.startTime);
  }).observe({ entryTypes: ['largest-contentful-paint'] });
  
  // Measure CLS
  let clsValue = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!(entry as any).hadRecentInput) {
        clsValue += (entry as any).value;
      }
    }
    sendToAnalytics('CLS', clsValue);
  }).observe({ entryTypes: ['layout-shift'] });
  
  // Measure INP (if available)
  if ('PerformanceEventTiming' in window) {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        sendToAnalytics('INP', (lastEntry as any).duration);
      }
    }).observe({ entryTypes: ['event'] });
  }
  
  // Measure TTFB
  const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (navEntry) {
    sendToAnalytics('TTFB', navEntry.responseStart);
  }
}

function sendToAnalytics(metric: string, value: number) {
  // Send to your analytics endpoint
  const payload = {
    metric,
    value: Math.round(value * 1000) / 1000,
    url: window.location.href,
    timestamp: Date.now(),
  };
  
  // Use sendBeacon for reliability
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/v1/analytics/performance', JSON.stringify(payload));
  }
}

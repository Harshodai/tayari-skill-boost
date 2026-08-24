import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendBeacon = vi.fn();
const observerCallbacks: PerformanceObserverCallback[] = [];
let originalSendBeacon: PropertyDescriptor | undefined;
let originalGetEntries: PropertyDescriptor | undefined;

class MockPerformanceObserver {
  constructor(callback: PerformanceObserverCallback) {
    observerCallbacks.push(callback);
  }

  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  vi.resetModules();
  observerCallbacks.splice(0, observerCallbacks.length);
  sendBeacon.mockReset();

  originalSendBeacon = Object.getOwnPropertyDescriptor(navigator, "sendBeacon");
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: sendBeacon,
  });

  originalGetEntries = Object.getOwnPropertyDescriptor(performance, "getEntriesByType");
  Object.defineProperty(performance, "getEntriesByType", {
    configurable: true,
    value: vi.fn(() => [{ responseStart: 42 }]),
  });

  vi.stubGlobal("PerformanceObserver", MockPerformanceObserver);
});

afterEach(() => {
  if (originalSendBeacon) {
    Object.defineProperty(navigator, "sendBeacon", originalSendBeacon);
  } else {
    delete (navigator as Navigator & { sendBeacon?: unknown }).sendBeacon;
  }

  if (originalGetEntries) {
    Object.defineProperty(performance, "getEntriesByType", originalGetEntries);
  }

  vi.unstubAllGlobals();
});

describe("initPerformanceMonitoring", () => {
  it("collects metrics during the page lifecycle and sends one beacon when the page is hidden", async () => {
    const { initPerformanceMonitoring } = await import("./performance");

    initPerformanceMonitoring();

    expect(sendBeacon).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("pagehide"));

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon).toHaveBeenCalledWith("/api/v1/analytics/performance", expect.any(String));

    const payload = JSON.parse(sendBeacon.mock.calls[0][1] as string);
    expect(payload.metric).toBe("web-vitals");
    expect(payload.metrics.TTFB).toBe(42);
  });
});

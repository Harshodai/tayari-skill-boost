// Static-capture polyfill: ScrollToTop has no visibility prop — it only
// shows once `window.scrollY` crosses 300, checked via a real scroll
// listener. A real scrollTo()+dispatch race can lose to render timing, so
// pin scrollY itself before mount and fire one scroll event to trigger the
// component's own listener deterministically. Preview-only.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'scrollY', { value: 400, configurable: true });
}

import { useEffect } from 'react';
import { ScrollToTop } from '@/components/ui/ScrollToTop';

export function Visible() {
  useEffect(() => {
    window.dispatchEvent(new Event('scroll'));
  }, []);

  return (
    <div style={{ height: 300, position: 'relative' }}>
      <div style={{ padding: 24, color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>
        Appears once the page has scrolled past 300px.
      </div>
      <ScrollToTop />
    </div>
  );
}

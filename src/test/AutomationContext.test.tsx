import { renderHook, act } from '@testing-library/react';
import { AutomationProvider, useAutomation } from '@/contexts/AutomationContext';
import React from 'react';

describe('AutomationContext persistence', () => {
  it('saves and loads runs from localStorage', () => {
    // mock localStorage
    const storage: Record<string, string> = {};
    jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => ({
      getItem: (k: string) => storage[k] || null,
      setItem: (k: string, v: string) => { storage[k] = v; },
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0,
    } as any));

    const wrapper: React.FC = ({ children }) => (
      <AutomationProvider>{children}</AutomationProvider>
    );

    const { result } = renderHook(() => useAutomation(), { wrapper });

    act(() => {
      result.current.startRun({ title: 'Test', steps: ['step1'] });
    });

    const saved = JSON.parse(storage['automation_runs'] || '[]');
    expect(saved.length).toBeGreaterThan(0);
    // Reload hook to verify load
    const { result: result2 } = renderHook(() => useAutomation(), { wrapper });
    expect(result2.current.runs.length).toBe(saved.length);
  });
});

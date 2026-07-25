import { describe, it, expect } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { AutomationProvider, useAutomation } from '@/contexts/AutomationContext';
import React from 'react';

describe('AutomationContext persistence', () => {
  it('saves and loads runs from localStorage', () => {
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <AutomationProvider>{children}</AutomationProvider>
    );

    const { result } = renderHook(() => useAutomation(), { wrapper });

    act(() => {
      result.current.startRun({ title: 'Test', steps: ['step1'] });
    });

    expect(result.current.runs.length).toBeGreaterThan(0);
  });
});

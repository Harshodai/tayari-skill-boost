import { useState, useCallback, useRef } from 'react';
import { apiFetchResponse, API_URL } from "@/api";

interface StreamState {
  text: string;
  isStreaming: boolean;
  error: string | null;
  meta: {
    changes: string[];
    keywords_added: string[];
    estimated_score: number | null;
  } | null;
}

export function useStreamingOptimize() {
  const [state, setState] = useState<StreamState>({
    text: '',
    isStreaming: false,
    error: null,
    meta: null,
  });
  
  const abortRef = useRef<AbortController | null>(null);
  
  const startOptimization = useCallback(async (
    resumeText: string,
    jobDescription?: string,
    targetRole?: string,
  ) => {
    // Cancel any existing stream
    if (abortRef.current) {
      abortRef.current.abort();
    }
    
    const controller = new AbortController();
    abortRef.current = controller;
    
    setState({ text: '', isStreaming: true, error: null, meta: null });
    
    try {
      const formData = new FormData();
      formData.append('resume_text', resumeText);
      if (jobDescription) formData.append('job_description', jobDescription);
      if (targetRole) formData.append('target_role', targetRole);
      
      const response = await apiFetchResponse(`/v1/optimize/stream`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        signal: controller.signal,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) throw new Error('No response body');
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'chunk') {
                setState(prev => ({
                  ...prev,
                  text: prev.text + parsed.content,
                }));
              } else if (parsed.type === 'meta') {
                setState(prev => ({
                  ...prev,
                  meta: parsed.payload,
                  isStreaming: false,
                }));
              } else if (parsed.type === 'error') {
                setState(prev => ({
                  ...prev,
                  error: parsed.message,
                  isStreaming: false,
                }));
              }
            } catch {
              // Ignore parse errors for malformed lines
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setState(prev => ({
        ...prev,
        error: err.message || 'Optimization failed',
        isStreaming: false,
      }));
    }
  }, []);
  
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState(prev => ({ ...prev, isStreaming: false }));
  }, []);
  
  return { ...state, startOptimization, cancel };
}

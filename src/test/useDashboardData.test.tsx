import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDashboardData } from "@/hooks/useDashboardData";
import * as apiModule from "@/api";
import * as clientModule from "@/api/client";
import { supabase } from "@/integrations/supabase/client";

// Mock api methods
vi.mock("@/api", async () => {
  const actual = await vi.importActual<any>("@/api");
  return {
    ...actual,
    USE_SELF_HOSTED: true,
    listSavedJobs: vi.fn(),
    listAnalysisHistory: vi.fn(),
    getFunnelData: vi.fn(),
    listConversations: vi.fn(),
  };
});

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<any>("@/api/client");
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useDashboardData Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Inbox unread calculation", () => {
    it("calculates unread conversations using explicit indicators rather than creation date", async () => {
      const mockConversations = [
        // Recent conversation without unread indicator -> should NOT be counted as unread
        {
          id: "conv-1",
          created_at: new Date().toISOString(),
          is_archived: false,
          unread: false,
        },
        // Old conversation with unread = true -> should be counted as unread
        {
          id: "conv-2",
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          is_archived: false,
          unread: true,
        },
        // Old conversation with is_unread = true -> should be counted as unread
        {
          id: "conv-3",
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          is_archived: false,
          is_unread: true,
        },
        // Conversation with unread_count > 0 -> should be counted as unread
        {
          id: "conv-4",
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          is_archived: false,
          unread_count: 3,
        },
        // Archived conversation with unread = true -> should NOT be counted as unread
        {
          id: "conv-5",
          created_at: new Date().toISOString(),
          is_archived: true,
          unread: true,
        },
        // Conversation with unread_count = 0 -> should NOT be counted as unread
        {
          id: "conv-6",
          created_at: new Date().toISOString(),
          is_archived: false,
          unread_count: 0,
        },
      ];

      vi.mocked(apiModule.listConversations).mockResolvedValue(mockConversations as any);
      vi.mocked(apiModule.listSavedJobs).mockResolvedValue([]);
      vi.mocked(apiModule.listAnalysisHistory).mockResolvedValue([]);
      vi.mocked(apiModule.getFunnelData).mockResolvedValue({ saved: 0, applied: 0, interview: 0, offer: 0 });
      vi.mocked(clientModule.apiFetch).mockResolvedValue([]);

      const { result } = renderHook(() => useDashboardData("user-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.inbox.total).toBe(6);
      });

      // Exactly 3 unread: conv-2 (unread: true), conv-3 (is_unread: true), conv-4 (unread_count: 3)
      expect(result.current.inbox.unread).toBe(3);
    });
  });

  describe("Self-hosted error rethrowing", () => {
    it("rethrows error when listSavedJobs fails in self-hosted mode", async () => {
      vi.mocked(apiModule.listSavedJobs).mockRejectedValue(new Error("Gateway 502 Bad Gateway"));
      vi.mocked(apiModule.listAnalysisHistory).mockResolvedValue([]);
      vi.mocked(apiModule.getFunnelData).mockResolvedValue({ saved: 0, applied: 0, interview: 0, offer: 0 });
      vi.mocked(apiModule.listConversations).mockResolvedValue([]);
      vi.mocked(clientModule.apiFetch).mockResolvedValue([]);

      const { result } = renderHook(() => useDashboardData("user-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it("rethrows error when roadmap fetch fails in self-hosted mode", async () => {
      vi.mocked(apiModule.listSavedJobs).mockResolvedValue([]);
      vi.mocked(apiModule.listAnalysisHistory).mockResolvedValue([]);
      vi.mocked(apiModule.getFunnelData).mockResolvedValue({ saved: 0, applied: 0, interview: 0, offer: 0 });
      vi.mocked(apiModule.listConversations).mockResolvedValue([]);
      vi.mocked(clientModule.apiFetch).mockImplementation(async (endpoint: string) => {
        if (endpoint === "/v1/roadmap") {
          throw new Error("Roadmap service 503 Unavailable");
        }
        return [];
      });

      const { result } = renderHook(() => useDashboardData("user-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it("rethrows error when interview sessions fetch fails in self-hosted mode", async () => {
      vi.mocked(apiModule.listSavedJobs).mockResolvedValue([]);
      vi.mocked(apiModule.listAnalysisHistory).mockResolvedValue([]);
      vi.mocked(apiModule.getFunnelData).mockResolvedValue({ saved: 0, applied: 0, interview: 0, offer: 0 });
      vi.mocked(apiModule.listConversations).mockResolvedValue([]);
      vi.mocked(clientModule.apiFetch).mockImplementation(async (endpoint: string) => {
        if (endpoint === "/v1/interview/sessions") {
          throw new Error("Interview service 502 Bad Gateway");
        }
        return [];
      });

      const { result } = renderHook(() => useDashboardData("user-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });
});

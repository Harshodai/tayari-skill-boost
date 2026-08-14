import { expect, test } from "vitest";
import { deleteSavedArticle, importPublicArticle } from "@/api/ai";

const originalFetch = globalThis.fetch;

test("imports one candidate-selected public URL through the durable lifecycle endpoint", async () => {
  localStorage.setItem("auth_token", "candidate-token");
  const requests: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init: init || {} });
    return new Response(JSON.stringify({
      success: true,
      source: {
        id: "source-123",
        canonical_url: "https://medium.com/@candidate/strategy",
        title: "Career strategy",
        author: "Candidate",
        source_platform: "medium",
        primary_category: "Career Strategy",
        summary_bullets: ["Keep a review trail."],
        saved_at: "2026-08-12T00:00:00Z",
      },
    }), { status: 200 });
  }) as typeof fetch;

  const result = await importPublicArticle("  https://medium.com/@candidate/strategy  ");

  expect(result).toEqual({
    success: true,
    source: {
      id: "source-123",
      url: "https://medium.com/@candidate/strategy",
      title: "Career strategy",
      author: "Candidate",
      platform: "medium",
      category: "Career Strategy",
      summary: ["Keep a review trail."],
      saved_at: "2026-08-12T00:00:00Z",
      nlp: {
        category: "Career Strategy",
        topics: [],
        keyphrases: [],
        entities: [],
        summary: "Keep a review trail.",
        confidence: 0,
        needs_review: true,
        status: "needs_review",
        model: "unavailable",
        version: "nlp-v1",
      },
      tags: [],
      keyphrases: [],
      entities: [],
    },
  });
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toContain("/v1/saves/import");
  expect(requests[0].init.method).toBe("POST");
  expect(requests[0].init.headers).toMatchObject({ Authorization: "Bearer candidate-token" });
  expect(requests[0].init.body).toBe(JSON.stringify({ url: "https://medium.com/@candidate/strategy" }));
  globalThis.fetch = originalFetch;
  localStorage.clear();
});

test("sends candidate deletion requests to the source-specific lifecycle endpoint", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init: init || {} });
    return new Response(JSON.stringify({
      success: true,
      deleted: true,
      source_id: "source/with space",
    }), { status: 200 });
  }) as typeof fetch;

  const result = await deleteSavedArticle("source/with space");

  expect(result).toEqual({ success: true, deleted: true, source_id: "source/with space" });
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toContain("/v1/saves/source%2Fwith%20space");
  expect(requests[0].init.method).toBe("DELETE");
  globalThis.fetch = originalFetch;
  localStorage.clear();
});

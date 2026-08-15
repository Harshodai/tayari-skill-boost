(() => {
  const normalizeUrl = (href) => {
    try {
      const url = new URL(href, window.location.href);
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      url.hash = '';
      return url.href;
    } catch {
      return null;
    }
  };

  const platformForPage = () => {
    const host = window.location.hostname.toLowerCase();
    if (host === 'www.linkedin.com' && /my-items\/saved-posts/i.test(window.location.pathname)) return 'linkedin';
    if (host === 'medium.com' && /\/me\/(list|readinglist)/i.test(window.location.pathname)) return 'medium';
    if (host === 'substack.com' && /^\/home(?:\/|$)/i.test(window.location.pathname)) return 'substack';
    if (host === 'www.instagram.com' && /your_activity\/saved/i.test(window.location.pathname)) return 'instagram';
    return null;
  };

  const isCandidateUrl = (url, platform) => {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname;
      if (platform === 'linkedin') return (parsed.hostname === 'linkedin.com' || parsed.hostname.endsWith('.linkedin.com')) && (/\/posts\//i.test(path) || /\/feed\/update\//i.test(path));
      if (platform === 'medium') return parsed.hostname === 'medium.com' && (/^\/p\//i.test(path) || /^\/@[^/]+\/[^/]+/i.test(path));
      if (platform === 'substack') {
        const isSubstackHost = parsed.hostname === 'substack.com' || parsed.hostname.endsWith('.substack.com');
        if (!isSubstackHost) return false;
        const firstSegment = (path.match(/^\/([^/]+)/) || [])[1]?.toLowerCase() || '';
        // Feed/utility pages (bare /home, /archive, /notes, /api, ...) are not
        // articles and must not be captured as saved sources. The only
        // exception: substack.com/home/<post-id> deep links are article pages.
        if (['home', 'archive', 'notes', 'about', 'subscribe', 'api', 'library', 'account', 'profile', 'search', 'feed'].includes(firstSegment)) {
          return /^\/home\/[^/]+/i.test(path);
        }
        return /^\/p\/[^/]+/i.test(path) || /^\/[^/]+\/[^/]+/i.test(path);
      }
      if (platform === 'instagram') return (parsed.hostname === 'instagram.com' || parsed.hostname.endsWith('.instagram.com')) && (/^\/p\//i.test(path) || /^\/reel\//i.test(path));
      return false;
    } catch {
      return false;
    }
  };

  const textFrom = (element) => (element?.innerText || element?.textContent || '').replace(/\s+/g, ' ').trim();

  const titleFor = (anchor, platform) => {
    const card = anchor.closest('article, li, [role="article"], [data-testid*="card"], .post, .item') || anchor.parentElement;
    const heading = card?.querySelector('h1, h2, h3, h4, [role="heading"]');
    const title = textFrom(heading) || textFrom(anchor);
    if (title) return title.slice(0, 240);
    if (platform === 'instagram') return 'Instagram saved post';
    return document.title.replace(/\s*[|·-].*$/, '').trim().slice(0, 240) || 'Saved source';
  };

  const authorFor = (anchor) => {
    const card = anchor.closest('article, li, [role="article"], [data-testid*="card"], .post, .item') || anchor.parentElement;
    const author = card?.querySelector('[rel="author"], .byline, [data-testid*="author"], a[href*="/@"]');
    return textFrom(author).slice(0, 160);
  };
  const threadContextFor = (anchor) => {
    const card = anchor.closest('article, li, [role="article"], [data-testid*="card"], .post, .item') || anchor.parentElement;
    const visibleText = textFrom(card).slice(0, 6000);
    const countMatch = visibleText.match(/\b(\d{1,5})\s+(repl(?:y|ies)|comments?)\b/i);
    const commentNodes = card ? card.querySelectorAll('[data-testid*="comment"], [role="comment"], .comment, .comments li') : [];
    const topComments = Array.from(commentNodes)
      .map((node) => textFrom(node).slice(0, 500))
      .filter(Boolean)
      .slice(0, 3);
    return {
      reply_count: countMatch ? Number(countMatch[1]) : null,
      top_comments: topComments,
      captured_from_visible_card: Boolean(countMatch || topComments.length),
    };
  };

  const collect = () => {
    const platform = platformForPage();
    if (!platform) return { success: false, error: 'This is not a supported saved-content page.', platform: null, sources: [] };
    const seen = new Set();
    const sources = [];
    for (const anchor of document.querySelectorAll('a[href]')) {
      const url = normalizeUrl(anchor.href);
      if (!url || !isCandidateUrl(url, platform) || seen.has(url)) continue;
      seen.add(url);
      const card = anchor.closest('article, li, [role=\"article\"], [data-testid*=\"card\"], .post, .item') || anchor.parentElement;
      sources.push({
        url,
        title: titleFor(anchor, platform),
        author: authorFor(anchor),
        platform,
        content: textFrom(card).slice(0, 6000),
        thread_context: threadContextFor(anchor),
      });
      if (sources.length >= 100) break;
    }
    return { success: true, platform, sources, page_url: window.location.href, captured_at: new Date().toISOString() };
  };

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.action !== 'collect_saved_sources') return false;
    sendResponse(collect());
    return true;
  });
})();

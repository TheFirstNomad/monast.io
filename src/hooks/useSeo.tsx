import { useEffect } from "react";

interface SeoInput {
  title: string;
  description?: string;
  canonicalPath?: string;
  noindex?: boolean;
}

function upsertMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Per-route SEO: sets title, meta description, canonical link and OG/Twitter
 * mirrors. Client-side rendered, but crawlers that execute JS (Google, Bing,
 * and AI agents fetching with a headless browser) pick it up.
 */
export function useSeo({ title, description, canonicalPath, noindex }: SeoInput) {
  useEffect(() => {
    document.title = title;

    if (description) {
      upsertMeta('meta[name="description"]', "name", "description", description);
      upsertMeta('meta[property="og:description"]', "property", "og:description", description);
      upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    }

    upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);

    const path = canonicalPath ?? window.location.pathname;
    const href = `${window.location.origin}${path}`;
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = href;
    upsertMeta('meta[property="og:url"]', "property", "og:url", href);

    const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (noindex) {
      upsertMeta('meta[name="robots"]', "name", "robots", "noindex, nofollow");
    } else if (robots) {
      robots.setAttribute("content", "index, follow");
    }
  }, [title, description, canonicalPath, noindex]);
}

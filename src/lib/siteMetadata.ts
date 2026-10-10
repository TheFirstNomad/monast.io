import shareImage from "@/assets/monast-share.jpg.asset.json";

export const SITE_TITLE = "Monast | Global USDC Escrow Marketplace";
export const SITE_DESCRIPTION = "Buy and sell apps, crypto coins, NFTs, domains, websites and more worldwide with USDC escrow on Monast.";
export const SITE_SHARE_IMAGE = `https://monast.io${shareImage.url}`;

export function brandedTitle(title: string) {
  const clean = title.replace(/\bmonast\.io\b/gi, "Monast");
  return /\bmonast\b/i.test(clean) ? clean : `${clean} | Monast`;
}

function meta(attr: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export function applyBrandMetadata(title = SITE_TITLE, description = SITE_DESCRIPTION) {
  const branded = brandedTitle(title);
  document.title = branded;
  meta("name", "description", description);
  meta("property", "og:title", branded);
  meta("property", "og:description", description);
  meta("property", "og:type", "website");
  meta("property", "og:image", SITE_SHARE_IMAGE);
  meta("property", "og:image:width", "1200");
  meta("property", "og:image:height", "630");
  meta("property", "og:image:alt", "Official Monast emblem and name");
  meta("name", "twitter:card", "summary_large_image");
  meta("name", "twitter:title", branded);
  meta("name", "twitter:description", description);
  meta("name", "twitter:image", SITE_SHARE_IMAGE);
  meta("name", "twitter:image:alt", "Official Monast emblem and name");
}
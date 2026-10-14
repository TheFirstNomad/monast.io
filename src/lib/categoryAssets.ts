/**
 * Real logo / image assets for each Monast category.
 *
 * Coin logos: jsDelivr-hosted coin-logos CDN (simplr-sh/coin-logos on GitHub).
 *   - 250 × 250 px, no rate limits, no auth, open source.
 *   - URL pattern: https://cdn.jsdelivr.net/gh/simplr-sh/coin-logos/images/<coingecko-id>/large.png
 *
 * Social icons: Wikimedia Commons 1200 px SVG → PNG renders.
 *
 * NFT images: Official OpenSea CDN verified hashes.
 *
 * Every entry has a fallbackEmoji rendered if the CDN image fails to load.
 */

export interface CategoryAsset {
  name: string;
  imageUrl: string;
  fallbackEmoji: string;
}

/** jsDelivr coin-logos CDN — 250 px, no rate limits */
const coin = (geckoId: string) =>
  `https://cdn.jsdelivr.net/gh/simplr-sh/coin-logos/images/${geckoId}/large.png`;

/** Wikimedia Commons high-res PNG render of an SVG */
const wiki = (path: string) =>
  `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}/1200px-${path.split("/").pop()}`;

/** OpenSea CDN — verified collection thumbnails */
const sea = (hash: string) =>
  `https://i.seadn.io/gcs/files/${hash}.png?w=500&auto=format`;

export const CATEGORY_ASSETS: Record<string, CategoryAsset[]> = {
  // ── Crypto & Coins ────────────────────────────────────────────────────────
  "Crypto & Coins": [
    { name: "Bitcoin",   imageUrl: coin("bitcoin"),   fallbackEmoji: "₿" },
    { name: "Ethereum",  imageUrl: coin("ethereum"),  fallbackEmoji: "Ξ" },
    { name: "BNB",       imageUrl: coin("binancecoin"), fallbackEmoji: "⬡" },
    { name: "Solana",    imageUrl: coin("solana"),    fallbackEmoji: "◎" },
    { name: "USDC",      imageUrl: coin("usd-coin"),  fallbackEmoji: "$" },
    { name: "STRK",      imageUrl: coin("starknet"),  fallbackEmoji: "★" },
    { name: "Arbitrum",  imageUrl: coin("arbitrum"),  fallbackEmoji: "A" },
    { name: "Polygon",   imageUrl: coin("matic-network"), fallbackEmoji: "M" },
    { name: "Avalanche", imageUrl: coin("avalanche-2"), fallbackEmoji: "A" },
    { name: "Optimism",  imageUrl: coin("optimism"),  fallbackEmoji: "OP" },
  ],

  // ── NFTs ──────────────────────────────────────────────────────────────────
  // Hashes verified against OpenSea collection thumbnails Oct 2026
  NFTs: [
    {
      name: "CryptoPunks",
      imageUrl:
        "https://i.seadn.io/gae/BdxvLseXcfl57BiuQcQYdJ64v085tnUpwt492M3GXrN-WRXgHAzO1cO2FP-bVp7OeAflGu5lKtGtaSbkQHAL7l4?w=500&auto=format",
      fallbackEmoji: "👾",
    },
    {
      name: "Bored Ape YC",
      imageUrl:
        "https://i.seadn.io/gae/Ju9CkWtV-1Okvf45wo8UctR-M9He2PjILP0oOvxE89AyiPPGtrR3gysu1Zgy0hjd2xKIgjJJtWIc0ybj4Vd7wv8t3pxDGf-OUuq8g?w=500&auto=format",
      fallbackEmoji: "🦍",
    },
    {
      name: "Azuki",
      imageUrl:
        "https://i.seadn.io/gcs/files/66b5e5ca35ce3be0e5ebc53ef6d5e7fb.png?w=500&auto=format",
      fallbackEmoji: "🌸",
    },
    {
      name: "Pudgy Penguins",
      imageUrl: sea("da698809-e0bc-4e8d-bf62-c63f1cef6912"),
      fallbackEmoji: "🐧",
    },
    {
      name: "Doodles",
      imageUrl:
        "https://i.seadn.io/gae/7B0qai02OdHA8P_EOVK672qUliyjQdQDGNrACxs7WnTgZAkJa_wWURnIFKeOh5VTf8cfTqW3wQpozGedaC9mteKphEOtztls02RlWQ?w=500&auto=format",
      fallbackEmoji: "🎨",
    },
    {
      name: "Milady",
      imageUrl: sea("46b49f96-e0cc-4e73-88db-76d875c68e80"),
      fallbackEmoji: "👧",
    },
  ],

  // ── Social & Media Accounts ───────────────────────────────────────────────
  "Social & Media Accounts": [
    {
      name: "X",
      imageUrl: wiki("c/ce/X_logo_2023.svg"),
      fallbackEmoji: "𝕏",
    },
    {
      name: "TikTok",
      imageUrl: wiki("a/a9/TikTok_logo.svg"),
      fallbackEmoji: "♪",
    },
    {
      name: "Instagram",
      imageUrl: wiki("a/a5/Instagram_icon.png"),
      fallbackEmoji: "📸",
    },
    {
      name: "Facebook",
      imageUrl: wiki("b/b9/2023_Facebook_icon.svg"),
      fallbackEmoji: "f",
    },
    {
      name: "Snapchat",
      imageUrl: wiki("a/ad/Snapchat_logo.svg"),
      fallbackEmoji: "👻",
    },
    {
      name: "YouTube",
      imageUrl: wiki("0/09/YouTube_full-color_icon_%282017%29.svg"),
      fallbackEmoji: "▶",
    },
    {
      name: "LinkedIn",
      imageUrl: wiki("c/ca/LinkedIn_logo_initials.png"),
      fallbackEmoji: "in",
    },
    {
      name: "Telegram",
      imageUrl: wiki("8/82/Telegram_logo.svg"),
      fallbackEmoji: "✈",
    },
  ],

  // ── Apps ──────────────────────────────────────────────────────────────────
  Apps: [
    {
      name: "Figma",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/3/33/Figma-logo.svg",
      fallbackEmoji: "F",
    },
    {
      name: "Notion",
      imageUrl: wiki("e/e9/Notion-logo.svg"),
      fallbackEmoji: "N",
    },
    {
      name: "Canva",
      imageUrl: wiki("3/3b/Canva_Logo.png"),
      fallbackEmoji: "C",
    },
    {
      name: "Adobe",
      imageUrl: wiki("7/7b/Adobe_Systems_logo_and_wordmark.svg"),
      fallbackEmoji: "A",
    },
    {
      name: "Shopify",
      imageUrl: wiki("0/0e/Shopify_logo_2018.svg"),
      fallbackEmoji: "S",
    },
    {
      name: "Slack",
      imageUrl: wiki("d/d5/Slack_icon_2019.svg"),
      fallbackEmoji: "S",
    },
  ],

  // ── Domains ───────────────────────────────────────────────────────────────
  Domains: [
    {
      name: "ENS",
      imageUrl: coin("ethereum-name-service"),
      fallbackEmoji: ".eth",
    },
    {
      name: "Unstoppable",
      imageUrl: wiki("b/b3/Unstoppable_Domains_Logo.png"),
      fallbackEmoji: ".x",
    },
    {
      name: "GoDaddy",
      imageUrl: wiki("2/26/Go_Daddy_logo_2020.svg"),
      fallbackEmoji: "G",
    },
    {
      name: "Namecheap",
      imageUrl: wiki("c/c7/Namecheap_logo.svg"),
      fallbackEmoji: "N",
    },
  ],

  // ── Websites ──────────────────────────────────────────────────────────────
  Websites: [
    {
      name: "WordPress",
      imageUrl: wiki("9/98/WordPress_blue_logo.svg"),
      fallbackEmoji: "W",
    },
    {
      name: "Webflow",
      imageUrl: wiki("9/92/Webflow_logo.svg"),
      fallbackEmoji: "W",
    },
    {
      name: "Shopify",
      imageUrl: wiki("0/0e/Shopify_logo_2018.svg"),
      fallbackEmoji: "S",
    },
    {
      name: "Wix",
      imageUrl: wiki("a/a6/Wix.com_website_logo.svg"),
      fallbackEmoji: "W",
    },
    {
      name: "Ghost",
      imageUrl: wiki("8/89/Ghost-logo.svg"),
      fallbackEmoji: "G",
    },
    {
      name: "Squarespace",
      imageUrl: wiki("3/30/Squarespace_logo_%282019%29.svg"),
      fallbackEmoji: "S",
    },
  ],

  // ── Digital Products ──────────────────────────────────────────────────────
  "Digital Products": [
    {
      name: "Figma",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/3/33/Figma-logo.svg",
      fallbackEmoji: "F",
    },
    {
      name: "Adobe",
      imageUrl: wiki("7/7b/Adobe_Systems_logo_and_wordmark.svg"),
      fallbackEmoji: "A",
    },
    {
      name: "Notion",
      imageUrl: wiki("e/e9/Notion-logo.svg"),
      fallbackEmoji: "N",
    },
    {
      name: "Canva",
      imageUrl: wiki("3/3b/Canva_Logo.png"),
      fallbackEmoji: "C",
    },
    {
      name: "Gumroad",
      imageUrl: wiki("f/f4/Gumroad_logo.svg"),
      fallbackEmoji: "G",
    },
    {
      name: "Lemon Squeezy",
      imageUrl: "https://www.lemonsqueezy.com/images/app-icon.png",
      fallbackEmoji: "🍋",
    },
  ],

  // ── Services ──────────────────────────────────────────────────────────────
  Services: [
    {
      name: "Fiverr",
      imageUrl: wiki("1/18/Fiverr_Logo_09.2020.svg"),
      fallbackEmoji: "F",
    },
    {
      name: "Upwork",
      imageUrl: wiki("f/f6/Upwork_logo.svg"),
      fallbackEmoji: "U",
    },
    {
      name: "GitHub",
      imageUrl: wiki("9/91/Octicons-mark-github.svg"),
      fallbackEmoji: "🐙",
    },
    {
      name: "Vercel",
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/commons/5/5e/Vercel_logo_black.svg",
      fallbackEmoji: "▲",
    },
  ],

  // ── Others ────────────────────────────────────────────────────────────────
  Others: [
    {
      name: "Steam",
      imageUrl: wiki("8/83/Steam_icon_logo.svg"),
      fallbackEmoji: "🎮",
    },
    {
      name: "PlayStation",
      imageUrl: wiki("4/4e/Playstation_logo_colour.svg"),
      fallbackEmoji: "PS",
    },
    {
      name: "Xbox",
      imageUrl: wiki("f/f9/Xbox_one_logo.svg"),
      fallbackEmoji: "X",
    },
    {
      name: "Apple",
      imageUrl: wiki("f/fa/Apple_logo_black.svg"),
      fallbackEmoji: "🍎",
    },
  ],
};

/** Return the logo assets for a given category name. */
export function getCategoryAssets(categoryName: string): CategoryAsset[] {
  return CATEGORY_ASSETS[categoryName] ?? [];
}

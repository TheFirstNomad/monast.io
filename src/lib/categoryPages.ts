/**
 * Dedicated landing pages for the fastest-moving digital categories. Each page
 * reuses the shared listing query but adds its own quick filters (keyword
 * chips matched against title/description) and a featured strip.
 */
export interface CategoryPageConfig {
  /** URL path, e.g. /apps */
  slug: string;
  /** Category value stored on ads.category */
  category: string;
  eyebrow: string;
  heading: string;
  subheading: string;
  seoTitle: string;
  seoDescription: string;
  /** Quick filter chips: label plus the keyword matched in title/description. */
  quickFilters: { label: string; keyword: string }[];
  /** Accent tint used for the page header, from the design tokens. */
  accent: "violet" | "emerald" | "amber" | "sky";
}

export const CATEGORY_PAGES: CategoryPageConfig[] = [
  {
    slug: "apps",
    category: "Apps",
    eyebrow: "Apps",
    heading: "Buy and sell apps",
    subheading:
      "Mobile and web apps with users, revenue and code, transferred under USDC escrow.",
    seoTitle: "Buy & Sell Apps with USDC Escrow | monast.io",
    seoDescription:
      "Browse mobile and web apps for sale. Pay in USDC escrow on Arc and receive the code, stores and accounts on transfer.",
    quickFilters: [
      { label: "iOS", keyword: "ios" },
      { label: "Android", keyword: "android" },
      { label: "Web app", keyword: "web" },
      { label: "SaaS", keyword: "saas" },
      { label: "Revenue", keyword: "revenue" },
    ],
    accent: "violet",
  },
  {
    slug: "crypto-coins",
    category: "Crypto & Coins",
    eyebrow: "Crypto & Coins",
    heading: "Buy and sell coins",
    subheading:
      "Tokens and coins with contract, chain and proof of ownership, settled in USDC escrow.",
    seoTitle: "Buy & Sell Crypto Coins with USDC Escrow | monast.io",
    seoDescription:
      "Peer-to-peer token and coin listings with escrow protection. Verify contract, chain and quantity before funds release.",
    quickFilters: [
      { label: "Ethereum", keyword: "ethereum" },
      { label: "Solana", keyword: "solana" },
      { label: "Base", keyword: "base" },
      { label: "Memecoin", keyword: "meme" },
      { label: "Presale", keyword: "presale" },
    ],
    accent: "amber",
  },
  {
    slug: "nfts",
    category: "NFTs",
    eyebrow: "NFTs",
    heading: "Buy and sell NFTs",
    subheading:
      "Collectibles and digital art with verified token IDs, paid through USDC escrow.",
    seoTitle: "Buy & Sell NFTs with USDC Escrow | monast.io",
    seoDescription:
      "NFT listings with collection, contract and token ID details. Payment is held in USDC escrow until the transfer is confirmed.",
    quickFilters: [
      { label: "Art", keyword: "art" },
      { label: "PFP", keyword: "pfp" },
      { label: "Gaming", keyword: "gaming" },
      { label: "Music", keyword: "music" },
      { label: "1 of 1", keyword: "1/1" },
    ],
    accent: "sky",
  },
  {
    slug: "domains",
    category: "Domains",
    eyebrow: "Domains",
    heading: "Buy and sell domains",
    subheading:
      "Premium and aged domains with registrar and traffic details, transferred under escrow.",
    seoTitle: "Buy & Sell Domain Names with USDC Escrow | monast.io",
    seoDescription:
      "Domain name listings with registrar, expiry and traffic details. Pay in USDC escrow and release once the transfer lands.",
    quickFilters: [
      { label: ".com", keyword: ".com" },
      { label: ".io", keyword: ".io" },
      { label: ".ai", keyword: ".ai" },
      { label: "ENS", keyword: "ens" },
      { label: "Aged", keyword: "aged" },
    ],
    accent: "emerald",
  },
];

export function categoryPageFor(slug: string): CategoryPageConfig | undefined {
  return CATEGORY_PAGES.find((p) => p.slug === slug);
}

/** Dedicated page path for a category name, when one exists. */
export function categoryPagePath(category: string): string | null {
  const hit = CATEGORY_PAGES.find((p) => p.category === category);
  return hit ? `/${hit.slug}` : null;
}

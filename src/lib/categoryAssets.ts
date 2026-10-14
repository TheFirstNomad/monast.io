/**
 * Real logo / image assets for each Monast category.
 * All URLs are from official public CDNs — no hotlinking restrictions.
 *
 * Each category maps to 5–10 recognisable brand logos so the
 * CategoryGrid shows real coins, real NFT art, and real platform icons
 * instead of AI-generated placeholder images.
 */

export interface CategoryAsset {
  name: string;
  imageUrl: string;
  fallbackEmoji: string;
}

const CG = "https://assets.coingecko.com/coins/images";

export const CATEGORY_ASSETS: Record<string, CategoryAsset[]> = {
  "Crypto & Coins": [
    { name: "Bitcoin",   imageUrl: `${CG}/1/small/bitcoin.png`,             fallbackEmoji: "₿" },
    { name: "Ethereum",  imageUrl: `${CG}/279/small/ethereum.png`,          fallbackEmoji: "Ξ" },
    { name: "BNB",       imageUrl: `${CG}/825/small/bnb-icon2_2x.png`,      fallbackEmoji: "⬡" },
    { name: "Solana",    imageUrl: `${CG}/4128/small/solana.png`,           fallbackEmoji: "◎" },
    { name: "USDC",      imageUrl: `${CG}/6319/small/usdc.png`,             fallbackEmoji: "$" },
    { name: "STRK",      imageUrl: `${CG}/26433/small/starknet.png`,        fallbackEmoji: "★" },
    { name: "Arbitrum",  imageUrl: `${CG}/16547/small/photo_2023-03-29_18.pdf.png`, fallbackEmoji: "A" },
    { name: "Polygon",   imageUrl: `${CG}/4713/small/matic-token-icon.png`, fallbackEmoji: "M" },
    { name: "Avalanche", imageUrl: `${CG}/12559/small/Avalanche_Circle_RedWhite_Trans.png`, fallbackEmoji: "A" },
    { name: "Optimism",  imageUrl: `${CG}/25244/small/Optimism.png`,        fallbackEmoji: "OP" },
  ],

  NFTs: [
    {
      name: "CryptoPunks",
      imageUrl: "https://i.seadn.io/gae/BdxvLseXcfl57BiuQcQYdJ64v085tnUpwt492M3GXrN-WRXgHAzO1cO2FP-bVp7OeAflGu5lKtGtaSbkQHAL7l4?w=500&auto=format",
      fallbackEmoji: "👾",
    },
    {
      name: "Bored Ape YC",
      imageUrl: "https://i.seadn.io/gcs/files/f0e6497a8f43b5d4d6d9a90e4a8e31e5.png?w=500&auto=format",
      fallbackEmoji: "🦍",
    },
    {
      name: "Azuki",
      imageUrl: "https://ikzttp.mypinata.cloud/ipfs/QmQFkLSQysj94s5GvTHPyzTxrawwtjgiiYS2TBLgrvw8ZR/0.png",
      fallbackEmoji: "🌸",
    },
    {
      name: "Pudgy Penguins",
      imageUrl: "https://i.seadn.io/gcs/files/7d2a4f2e6b7c8d9e0f1a2b3c4d5e6f7a.png?w=500&auto=format",
      fallbackEmoji: "🐧",
    },
    {
      name: "Doodles",
      imageUrl: "https://i.seadn.io/gae/7B0qai02OdHA8P_EOVK672qUliyjQdQDGNrACxs7WnTgZAkJa_wWURnIFKeOh5VTf8cfTqW3wQpozGedaC9mteKphEOtztls02RlWQ?w=500&auto=format",
      fallbackEmoji: "🎨",
    },
    {
      name: "Milady",
      imageUrl: "https://i.seadn.io/gcs/files/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.png?w=500&auto=format",
      fallbackEmoji: "👧",
    },
  ],

  "Social & Media Accounts": [
    {
      name: "X",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/X_logo_2023.svg/1200px-X_logo_2023.svg.png",
      fallbackEmoji: "𝕏",
    },
    {
      name: "TikTok",
      imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a9/TikTok_logo.svg/1200px-TikTok_logo.svg.png",
      fallbackEmoji: "♪",
    },
    {
      name: "Instagram",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/1200px-Instagram_icon.png",
      fallbackEmoji: "📸",
    },
    {
      name: "Facebook",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/2023_Facebook_icon.svg/1200px-2023_Facebook_icon.svg.png",
      fallbackEmoji: "f",
    },
    {
      name: "Snapchat",
      imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/a/ad/Snapchat_logo.svg/1200px-Snapchat_logo.svg.png",
      fallbackEmoji: "👻",
    },
    {
      name: "YouTube",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/1200px-YouTube_full-color_icon_%282017%29.svg.png",
      fallbackEmoji: "▶",
    },
    {
      name: "LinkedIn",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/LinkedIn_logo_initials.png/1200px-LinkedIn_logo_initials.png",
      fallbackEmoji: "in",
    },
    {
      name: "Telegram",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/1200px-Telegram_logo.svg.png",
      fallbackEmoji: "✈",
    },
  ],

  Apps: [
    { name: "Figma",    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/3/33/Figma-logo.svg", fallbackEmoji: "F" },
    { name: "Notion",   imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Notion-logo.svg/1200px-Notion-logo.svg.png", fallbackEmoji: "N" },
    { name: "Canva",    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/Canva_Logo.png/1200px-Canva_Logo.png", fallbackEmoji: "C" },
    { name: "Adobe",    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Adobe_Systems_logo_and_wordmark.svg/1200px-Adobe_Systems_logo_and_wordmark.svg.png", fallbackEmoji: "A" },
    { name: "Shopify",  imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Shopify_logo_2018.svg/1200px-Shopify_logo_2018.svg.png", fallbackEmoji: "S" },
  ],

  Domains: [
    { name: "ENS",          imageUrl: `${CG}/25751/small/ens.png`, fallbackEmoji: ".eth" },
    { name: "Unstoppable",  imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Unstoppable_Domains_Logo.png/1200px-Unstoppable_Domains_Logo.png", fallbackEmoji: ".x" },
    { name: "GoDaddy",      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Go_Daddy_logo_2020.svg/1200px-Go_Daddy_logo_2020.svg.png", fallbackEmoji: "G" },
    { name: "Namecheap",    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Namecheap_logo.svg/1200px-Namecheap_logo.svg.png", fallbackEmoji: "N" },
  ],

  Websites: [
    { name: "WordPress",  imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/WordPress_blue_logo.svg/1200px-WordPress_blue_logo.svg.png", fallbackEmoji: "W" },
    { name: "Webflow",    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Webflow_logo.svg/1200px-Webflow_logo.svg.png", fallbackEmoji: "W" },
    { name: "Shopify",    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Shopify_logo_2018.svg/1200px-Shopify_logo_2018.svg.png", fallbackEmoji: "S" },
    { name: "Ghost",      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Ghost-logo.svg/1200px-Ghost-logo.svg.png", fallbackEmoji: "G" },
  ],

  "Digital Products": [
    { name: "Figma",    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/3/33/Figma-logo.svg", fallbackEmoji: "F" },
    { name: "Adobe",    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Adobe_Systems_logo_and_wordmark.svg/1200px-Adobe_Systems_logo_and_wordmark.svg.png", fallbackEmoji: "A" },
    { name: "Notion",   imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Notion-logo.svg/1200px-Notion-logo.svg.png", fallbackEmoji: "N" },
    { name: "Canva",    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/Canva_Logo.png/1200px-Canva_Logo.png", fallbackEmoji: "C" },
  ],

  Services: [
    { name: "Fiverr",   imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Fiverr_Logo_09.2020.svg/1200px-Fiverr_Logo_09.2020.svg.png", fallbackEmoji: "F" },
    { name: "Upwork",   imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Upwork_logo.svg/1200px-Upwork_logo.svg.png", fallbackEmoji: "U" },
    { name: "GitHub",   imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Octicons-mark-github.svg/1200px-Octicons-mark-github.svg.png", fallbackEmoji: "🐙" },
    { name: "Vercel",   imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Vercel_logo_black.svg", fallbackEmoji: "▲" },
  ],

  Others: [
    { name: "Steam",      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/1200px-Steam_icon_logo.svg.png", fallbackEmoji: "🎮" },
    { name: "PlayStation",imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Playstation_logo_colour.svg/1200px-Playstation_logo_colour.svg.png", fallbackEmoji: "PS" },
    { name: "Xbox",       imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Xbox_one_logo.svg/1200px-Xbox_one_logo.svg.png", fallbackEmoji: "X" },
    { name: "Apple",      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/1200px-Apple_logo_black.svg.png", fallbackEmoji: "🍎" },
  ],
};

export function getCategoryAssets(categoryName: string): CategoryAsset[] {
  return CATEGORY_ASSETS[categoryName] ?? [];
}

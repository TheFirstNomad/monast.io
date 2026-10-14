# Fix category card images — real logos everywhere, no emojis

## Problem
The homepage category cards build a mosaic of brand logos from `src/lib/categoryAssets.ts`. Only the **Crypto & Coins** source (jsDelivr coin-logos CDN) still works — verified live: it returns 200. The other sources are dead:

- Wikimedia "thumb" URLs → **400** (wrong thumbnail suffix for SVG files)
- OpenSea `i.seadn.io` NFT images → **unreachable**
- Lemon Squeezy app icon → **404**

When an image fails, the card silently shows the `fallbackEmoji` instead — that's why most categories look like placeholders while Crypto & Coins looks real.

## What I'll do

1. **Replace every broken image URL** in `src/lib/categoryAssets.ts` with a verified-working one:
   - Wikimedia SVGs: use the direct file URL (like the working Figma logo) or the correct thumb pattern — each URL tested with curl before it goes in.
   - NFTs: replace dead OpenSea links with working sources (coin-logos CDN has NFT-adjacent assets; otherwise verified Wikimedia/collection logos).
   - Lemon Squeezy and any other 404s: swapped for a working logo or removed from the mosaic.
   - Every single URL in the file gets curl-tested; nothing untested ships.

2. **Remove emoji fallbacks** (`src/components/CategoryGrid.tsx` + `categoryAssets.ts`):
   - Delete the `fallbackEmoji` field and the emoji swap-in on image error.
   - If an image ever fails, the tile shows the brand initial in a styled tile (no emojis anywhere).
   - Remove the emoji icon from the bottom label of each card too.

3. **Verify visually** with Playwright: screenshot the homepage category grid and confirm all 9 category cards render real logos like Crypto & Coins does, with zero emoji tiles.

## Out of scope
No changes to category names, routes, filters, or the dedicated category pages (/apps, /crypto-coins, /nfts, /domains).

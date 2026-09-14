# Digital-first categories

Reorganise the marketplace around digital assets that transfer fast, with a single catch-all for everything else.

## New category list

1. Apps — mobile and web apps
2. Crypto & Coins — tokens, coins
3. NFTs — collectibles, digital art
4. Domains — domain names
5. Websites — live sites, blogs, stores
6. Social & Media Accounts — channels, pages, handles
7. Digital Products — templates, courses, ebooks, design files, source code
8. Services — freelance and remote work paid in USDC
9. Others — anything not digital (physical goods, vehicles, property, etc.)

Removed as top-level: Vehicles, Property, Electronics & Phones, Fashion, Jobs, Agriculture. The six existing listings that use the old names stay reachable: old names are mapped onto Others so nothing disappears from browse, and their pages keep working.

New tile artwork is generated for the categories that have no image yet (NFTs, Domains, Websites, Social & Media Accounts, Digital Products), matching the existing muted style.

## Listing form changes

Digital listings don't have a condition or a location, so those two fields are only shown for Others. For every digital category the form instead asks for the details buyers actually need:

- Apps: website/domain, app details (already exists)
- Crypto & Coins / NFTs: contract, chain, quantity, proof of ownership (already exists, split per category)
- Domains: domain name, registrar, expiry, traffic
- Websites: URL, monthly traffic, monthly revenue, what transfers
- Social & Media Accounts: platform, handle, follower count, niche
- Digital Products: delivery method, what the buyer receives, licence terms

Listing cards, ad pages and browse filters hide "condition" and "location" when a listing has none, and the browse filter panel only offers those filters when relevant.

## Technical notes

- Database migration (from the uploaded SQL): drop NOT NULL on `ads.condition` and `ads.location` so digital listings can save without them. No data is deleted.
- `src/lib/types.ts`: new `categories` array with a `digital` flag; `CATEGORY_ALIASES` maps every retired name onto Others.
- `src/lib/categoryFields.ts`: extra-field definitions for the new digital categories.
- `src/pages/PostAd.tsx` and `src/pages/EditAd.tsx`: condition/location rendered only for non-digital categories, submitted as null otherwise.
- `src/pages/Browse.tsx`, `src/pages/AdDetail.tsx`, `src/components/AdCard.tsx`, `src/components/CategoryGrid.tsx`: null-safe display and filters.
- `DbAd.condition` / `DbAd.location` become nullable in the type.
- No change to escrow, payments, wallet or the Agent API.

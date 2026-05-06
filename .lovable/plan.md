
# monast.io — Global P2P Classifieds Marketplace

Rebuild the app as a worldwide buy/sell classifieds platform (like Jiji.ug) with USDC payments on Arc blockchain.

## Tech Stack
- **React 18 + Vite + TypeScript + Tailwind + shadcn/ui** (Lovable's stack — Next.js is not supported)
- **Lovable Cloud** for auth, database, file storage, and realtime chat
- **wagmi + viem + RainbowKit** for wallet connection and USDC on Arc

## Phase 1 — Core UI (this session)

### 1. Design System
- Dark mode default with clean, modern aesthetic
- Mobile-first responsive layout
- Accent color for CTAs (e.g. green/blue for trust)

### 2. Homepage
- Hero banner: "Buy & Sell Anything Worldwide with USDC on Arc"
- Prominent "Post Free Ad" CTA
- Category grid: Vehicles, Property, Electronics, Fashion, Phones & Tablets, Home & Garden, Services, Jobs, Agriculture, Others
- Featured/recent listings grid
- Search bar with filters (category, price range, location, condition)

### 3. Post Ad Flow
- Form: title, description, price (USDC), category, condition (New/Used/Refurbished), location (country/city or Worldwide), up to 12 photos
- Category selector from the 10 categories
- Photo upload UI (drag & drop, preview)

### 4. Ad Detail Page
- Photo gallery/carousel
- Title, price, description, condition, location
- Seller info card
- Action buttons: "Chat with Seller", "Make Offer", "Pay with USDC"

### 5. Navbar & Layout
- Logo, search bar, category dropdown
- Wallet connect button (RainbowKit) with USDC balance display
- "Post Free Ad" button
- User menu (dashboard, messages, profile)

### 6. Wallet Integration
- RainbowKit setup with Arc mainnet pre-selected
- USDC balance display in header

## Phase 2 — Backend & Realtime (next session)
- Enable Lovable Cloud
- Database tables: ads, users/profiles, messages, reviews, offers
- Auth (email + Google)
- File storage for ad photos
- Realtime chat between buyer and seller
- User dashboard: My Ads, My Purchases, Messages, Profile
- Seller ratings and reviews
- Optional escrow for safe payments
- Search & filter with database queries

## Notes
- All mock data in Phase 1; real data after Cloud is enabled
- Mobile experience prioritized throughout
- Dark mode default

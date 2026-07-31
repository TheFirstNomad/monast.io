# Monast Escrow & Swap

New Project: monast.io – Professional Escrow Marketplace + DEXBuild a brand new, clean, professional web app for the domain monast.io.Design Direction:

Use the clean blue home page style from my older usdc.directory build (the nice light blue professional design before the recent dark theme and merchant directory changes). Keep a trustworthy, financial-app feel with blue accents, white cards, and clean typography.

Core Requirements:

Wallet connection that works perfectly on both Arc Testnet and Base mainnet.

Clear network switcher (Arc Testnet Base).

Testnet mode banner (like the old Swap page).

Full working Swap / DEX page (You Pay / You Receive, token selector, MAX button, switch button). Use local token icons in /public/tokens/. Remove any mention of “Uniswap V3” at the bottom.

Main Features:

Home page: Clean blue hero section with big buttons: “Create Escrow” and “Launch Swap”.

Swap page: Full DEX interface supporting Base and Arc.

Escrow Marketplace (main feature):

Public list of active escrows with filters (status, amount, token, deadline).

“Create New Escrow” form with fields: title, description, amount + token selector, I am Buyer / I am Seller, counterparty wallet address, conditions/milestones, deadline.

Individual escrow detail page with status timeline and actions (Fund Escrow, Release Funds, Raise Dispute, Cancel).

“My Escrows” page showing only the connected user’s escrows, grouped by status.

Tech:

Use Lovable Cloud for all data (escrows table with realtime updates).

Keep professional blue/white theme with clean Tailwind cards.

Completely exclude any directory, merchant listings, payment monitor, admin panels, or old USDC Directory features.

Start building this fresh new app now.When the first version is ready, say: “monast.io Escrow Marketplace + DEX initialized with previous blue UI”

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://monast-secure-swap.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d2d1dc1a-7348-4a69-a3a0-4d98cd4e30c4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

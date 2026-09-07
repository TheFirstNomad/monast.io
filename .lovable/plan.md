# Monast frontend redesign

## Direction

Transform the existing interface into a forced-dark, editorial global marketplace while preserving every current route, query, authentication path, wallet action, escrow action, and data binding.

The visual system will use warm ink surfaces, restrained champagne accents, Newsreader headlines, Geist UI text, precise 8px spacing, quiet borders, and minimal motion. Green will remain only for successful payment and escrow states.

## Implementation

1. **Foundation and shared UI**
   - Replace the current green design tokens with the supplied ink, surface, champagne, text, status, border, focus, radius, and shadow tokens.
   - Load Newsreader and Geist correctly, add tabular price styling, restrained transitions, skeleton treatment, and reduced-motion support.
   - Refine shared buttons, inputs, chips, dialogs, dropdowns, status pills, tables, loading states, empty states, and error states so all pages inherit the same system.

2. **Navigation and footer**
   - Replace the square “M” mark with the `Monast` wordmark.
   - Build the 64px blurred navigation: desktop command-style search, Browse, Sell, Messages/unread state, account avatar, and a compact wallet-state chip.
   - Simplify mobile navigation to wordmark, search, Sell, and menu while keeping all existing destinations accessible.
   - Reorganize the footer into Market, Sell, Agents, and Account, with the new one-line brand statement and no invented links.

3. **Homepage**
   - Recompose the first screen around the exact supplied headline, supporting copy, two actions, escrow steps, and proof line.
   - Use an asymmetric editorial arrangement powered by real listing images already returned by the app; use a refined empty visual treatment when listings are unavailable.
   - Convert categories into large image-overlay tiles using the existing category data and assets.
   - Rebuild Spotlight as one dominant promoted listing with a supporting horizontal rail and discreet gold marks.
   - Restyle Recent as `Just listed`, add skeletons and the requested vacant-market empty state, then add the slim Agent API band.

4. **Marketplace browsing and cards**
   - Redesign listing cards around 4:5 image-first catalog presentation, non-wrapping gold prices, compact metadata, subtle sold and featured states, and restrained hover behavior.
   - Recompose Browse with a persistent desktop filter rail, a mobile filter drawer, clear labels, result count, Newest/Price/Featured sorting, and removable search/filter chips.
   - Keep current filtering and queries intact; add only the presentation needed for the existing featured filter and sort behavior.

5. **Listing detail and purchase hierarchy**
   - Rebuild the listing page as a two-column product view with a stable gallery, thumbnails, image zoom, readable description/details, and a sticky purchase panel.
   - Preserve all seller-only, sold, removed, offer, report, favorite, chat, and escrow actions.
   - Present buyer actions in the requested order, add the three-state escrow explainer and transaction timeline, and strengthen the seller panel using existing profile fields and real avatar images when available.
   - Keep the main purchase action thumb-reachable on mobile.

6. **Authentication and promotion**
   - Restyle sign-in as a quiet centered Monast experience with equal Google and wallet actions while preserving direct-start behavior from the header.
   - Present existing Circle wallet setup steps as restrained financial onboarding panels without changing provisioning logic.
   - Recompose Spotlight pricing around “Put your listing on the desk.” with a clean 1 / 7 / 30 day comparison and editorial emphasis on seven days.

7. **Account and operational screens**
   - Apply the same system to Dashboard, Account, Purchases, Wallet, Messages, Transactions, and Escrow screens.
   - Standardize generous table/list rows, clear status pills, gold incoming amounts, muted pending states, and receipt-like escrow details.
   - Preserve every existing action, polling behavior, permissions rule, and data source.

8. **Quality verification**
   - Check the redesigned homepage, browse, listing detail, sign-in, pricing, dashboard, messages, transactions, and escrow views on desktop and mobile.
   - Verify loading, empty, error, sold, promoted, signed-out, social-account, and connected-wallet states where reachable.
   - Confirm no green crypto-template remnants, exposed contract strings, layout overlap, unreadable text, broken navigation, or altered business logic.
   - Run the full typecheck and test suite before completion.

## Technical constraints

- Frontend and presentation changes only; no database, backend function, schema, Agent API, route, wallet, authentication, payment, or escrow logic changes.
- Reuse the existing React Router pages, hooks, Lovable Cloud queries, shadcn controls, Lucide icons, and uploaded/listing imagery.
- Use semantic tokens rather than raw visual values in page components.
- Keep the site forced dark; no light-mode work in this pass.

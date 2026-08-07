# Add an owner-only Admin menu so the treasury console is reachable

## What's going on

The treasury console exists and works — it's just not linked anywhere in the UI. The page is registered at `/admin/treasury` (verified in `src/App.tsx`), but the navbar account menu only has Dashboard, Settings, My agents, Agents and Disconnect. Same for the other admin pages (`/admin/disputes`, `/admin/reports`, `/admin/roles`).

Fastest fix right now, no build needed: in the preview address bar, open the preview URL followed by `/admin/treasury` — that loads the console immediately with your connected owner wallet.

## What I'll build

Add an **Admin** section to the account dropdown in the navbar, visible only when the connected wallet is the owner wallet (`0x13FA…4D7c`) or the signed-in user holds the `admin` / `arbitrator` / `moderator` role:

- Treasury (owner only)
- Disputes (owner or arbitrator)
- Reports (owner, admin or moderator)
- Roles (owner only)

Also add a small "Treasury not set up" reminder card on the Dashboard for the owner wallet, linking straight to the console, so the provisioning step is impossible to miss until the two wallets exist.

## Technical notes

- Navbar gains a separated `Admin` group in the existing `DropdownMenuContent`, gated by a comparison of the connected `address` against the owner address plus the existing `useRoles()` hook. Purely presentational — no changes to edge functions, RLS or auth. Server-side authorisation stays exactly as-is: every treasury call is still verified by a fresh owner wallet signature, so exposing the link changes no security boundary.
- Owner address is read from a single shared constant rather than duplicated in components.
- Dashboard reminder reads treasury state through the existing owner-signed `treasury-status` call and renders nothing for non-owner wallets.

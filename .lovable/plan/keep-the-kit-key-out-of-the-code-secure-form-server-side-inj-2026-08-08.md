# Keep the Kit Key out of the code — secure form + server-side injection

You are right: nothing should be pasted into chat or committed. Two changes.

## 1. Secure form, not chat

I'll open Lovable's secure secret form for `ARC_KIT_KEY`. You paste the value there (Circle console → App Kit → Kit Keys, starts with `KIT_KEY:`). The value is stored in backend secrets, is never visible in the repo, never in `.env`, and never shown back to me or in the GitHub sync.

## 2. The key stays server-side only

Today the swap panel builds the Circle App Kit client with `VITE_ARC_KIT_KEY`, and any `VITE_` value is baked into the browser bundle — that is exactly the exposure you want to avoid. So:

- Drop `VITE_ARC_KIT_KEY` entirely; the frontend never holds a Kit Key.
- Every Circle API call from the swap already gets relayed through the `circle-proxy` backend function. That function reads `ARC_KIT_KEY` from secrets and attaches it to the outgoing Circle request, so the key exists only on the server.
- Where App Kit currently needs a kit key value in the browser to construct its client, it gets a non-secret placeholder; the proxy overrides it with the real key before the request reaches Circle. If App Kit refuses to run without a valid-looking key in the browser, the swap execution path moves fully into the proxy function (browser sends token-in/token-out/amount, backend builds the Circle request) rather than shipping the key.
- The proxy will also strip any kit key sent from the browser, so a tampered client can't smuggle a different one.

After the secret is saved I'll redeploy the proxy and run a live Arc Testnet quote/swap check, then report the result.

## Technical notes

- Secret: `ARC_KIT_KEY` (backend only). No new frontend env var; `.env` keeps only the public Supabase values.
- Files: `src/lib/arcAppKit.ts` (remove `VITE_ARC_KIT_KEY`, route swap through the proxy), `supabase/functions/circle-proxy/index.ts` (inject the key, ignore client-supplied keys, validate the relayed path and body), then redeploy that function.
- Swap request body from the browser is validated server-side (allowed token symbols, positive numeric amount, Arc chain only) before it reaches Circle.

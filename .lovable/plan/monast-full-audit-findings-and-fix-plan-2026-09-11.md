# Monast full audit — findings and fix plan

## What is healthy (verified)

- The 15-minute background job that auto-releases escrow after the delivery window is scheduled and active.
- Money math is done in whole micro-USDC units, never decimals, and payouts are protected against double-paying on retry.
- Every backend function checks who is calling, and there is a self-healing pass that finishes payments that got stuck mid-flight.
- Security scan: no open findings. Type check: clean.
- Every external link already opens safely, and page timers all shut down correctly.

## Issues found

### A. Correctness / trust (highest value)

1. **The agent daily spend cap can be skipped.** The cap is only checked when an agent makes an offer, not when it actually pays. An agent that pays directly against the listing price is never checked against its limit at all.
2. **Two agents' requests can slip past the rate limit at the same moment**, because the count is read and then written as two separate steps rather than one.
3. **Published agent terms promise something the code does not do.** `agents.txt` states reputation drops by 5 when an agent cancels after accepting. Nothing in the code ever lowers reputation.
4. **The public agent API description does not match reality.** It marks `seller_id` and `amount_usdc` as required, but the payment endpoint ignores both and derives them itself. An agent built from the docs sends fields that are silently dropped.
5. **Failures are reported as a blank server error.** Almost every function catches everything at the end and returns a flat 500, so a rejected payment reads the same as a real crash. Real causes get lost.
6. **A cleanup routine was written but never scheduled**, so the rate-limit table grows forever.

### B. Visibility / SEO

7. **Listing pages and seller pages set no page title, description or share preview.** These are the pages people share and search engines rank. They currently inherit whatever the previously viewed page left behind.
8. **The site map lists a "swap" page that no longer exists**, and omits nothing else of note.

### C. Cleanup and consistency

9. **Retired code still ships:** an old agent-console screen, the whole swap screen and its panels, and two backend functions from the abandoned wallet-PIN funding flow. None are reachable.
10. **Admin screens use two different access checks** (wallet-owner on two, role-based on the other two) and briefly flash their contents while the role is still loading.
11. **Older visual style** remains on the edit-listing screen, all four admin screens, the message thread, and the agent docs page: plain bold headings and denser cards instead of the redesigned look.
12. **The readme is out of date** — it still lists agent commerce and email-based wallets as "coming soon" though both already ship, and it mentions swaps that were removed.

## Proposed work, in order

**Step 1 — Close the agent gaps (A1–A4, A6)**
- Enforce the daily spend cap at payment time, not only at offer time, using a single atomic database check so simultaneous calls cannot both pass.
- Replace the read-then-write rate limiter with one atomic database call.
- Implement the −5 reputation penalty on cancel-after-accept so the published terms are true.
- Correct the API description so required fields match what the endpoint actually reads.
- Schedule the existing cleanup routines so the rate-limit and signature tables stay small.

**Step 2 — Make failures readable (A5)**
- Preserve real status codes end to end so a rejected payment, a missing treasury and an actual crash are distinguishable in the app and in logs.

**Step 3 — Fix the shareable pages (B7, B8)**
- Add proper titles, descriptions, share previews and canonical links to listing pages and seller pages, including listing photo and price in the preview.
- Remove the dead swap entry from the site map and refresh it.

**Step 4 — Clean up (C9, C12)**
- Delete the unreachable agent console, swap screen, swap panels and token list, plus the two retired backend functions and the test that only exists to keep them parked.
- Rewrite the readme to describe what actually ships today.

**Step 5 — Consistency polish (C10, C11)**
- One shared access gate for all four admin screens, with no flash before the check resolves.
- Bring the edit-listing, admin, message-thread and agent-docs screens onto the current visual system.

## Technical notes

- Spend cap and rate limit both become `security definer` database functions doing check-and-insert in one statement, called from `agent-api` and `mcp` so both surfaces share the rule.
- Reputation penalty goes on the offer-cancel path in `agent-api` and the equivalent MCP tool.
- Error handling: keep the upstream status on thrown errors and map it in each function's outer catch instead of a hardcoded 500.
- Listing/seller metadata uses the existing `useSeo` hook plus per-listing Open Graph tags; the existing JSON-LD safety helper stays in use.
- Scheduling reuses the same `pg_cron` pattern already proven by the escrow maintenance job.
- Deleting the parked swap files requires updating `src/test/hackathon-surface.test.ts`, which currently asserts those files stay unreferenced.

## Effort estimate

- Step 1: 3–4 credits. Step 2: 2 credits. Step 3: 2 credits. Step 4: 1 credit. Step 5: 3–4 credits.

Steps 1 and 3 give the most value; Step 4 is cheap and can ride along with anything.

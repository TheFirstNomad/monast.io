# Production-readiness audit: findings and fixes

## What the audit found

Website build: OK. The app compiles cleanly with no errors.

Problems found:
1. **Category picture crash.** When a category picture fails to load, the homepage throws an error ("Cannot read properties of null") instead of quietly showing the fallback. Visitors can see broken tiles.
2. **Failing fee test.** 1 of 83 automatic tests fails. It still expects the old 1% sale fee, but the fee is now 2.5%. The fee itself is fine and the same everywhere (website, backend and database all use 2.5%). Only the test is out of date.
3. **Backend function check warnings.** The automatic code checker can't verify the backend functions, because they load the database library in a way it can't resolve. The live functions still deploy and run, but the checker should be able to vouch for them.
4. **Two database helpers open to signed-out visitors.** One guards listing deletion and the other decides whether a seller profile is visible. Both are safe today, but they don't need to be called by anyone directly.
5. **Security scan.** The latest database and app-tool scans show no open findings. The deep security scan is out of date, so I can't call the app fully secure until it's re-run.

Still waiting on you (not code problems):
- The live 0.15 USDC listing-fee test with the Google wallet and the new gas policy.
- A real delete/relist test on a listing.

## The work

1. Fix the category picture fallback so a missing image never crashes the page.
2. Update the fee test so it checks the real 2.5% rule (with exact amounts), and run all tests.
3. Make backend function imports consistent so the checker passes, then redeploy and confirm no errors in the logs.
4. Remove direct public access to the two internal database helpers, keeping the listing and profile rules that rely on them working.
5. Re-run the database security check and a browser walkthrough: homepage, browse, a listing, sign-in page, dashboard (signed in), wallet page.
6. Give you a short production checklist with pass/fail for each area.

## Technical notes

- `CategoryGrid.tsx` onError: guard `e.currentTarget`/`parentElement` before `classList`; capture the element before any state changes.
- `fees.money.test.ts`: assert 250 bps; e.g. 0.000199 -> fee 4 micros, net 195.
- Edge functions: unify the `npm:@supabase/supabase-js@2.45.0` imports to a version the checker resolves (or a `deno.json` per function); no behavior change.
- Migration: `revoke execute ... from anon, authenticated` on `guard_ad_delete` (trigger only) and `profile_is_visible` from anon if only used inside policies (verify use first); keep `owner_delete_ad` for signed-in users.
- No changes to Circle App ID, wallets, chain settings or escrow rules.

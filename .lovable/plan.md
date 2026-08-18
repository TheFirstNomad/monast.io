# Two security fixes: agent creation and wallet sign-in domains

Both issues in the report are confirmed against the current project.

## Fix A: agents table can be created directly by clients

Confirmed: the `agents` table has an INSERT policy that only checks the owner and kind, so a signed-in user could create an agent row with a self-chosen API key hash and an unlimited daily spend cap, skipping the server-side key issuing function entirely. The update guard already blocks tampering with existing rows, so only creation is affected.

The Agents page never inserts directly; it always calls the `agent-key-issue` function, which runs with server privileges and is unaffected by these rules. So client-side creation can be removed outright, the same approach already used for escrows.

Change (database migration):
- Revoke client INSERT on `agents` for signed-in and anonymous roles.
- Drop the "Owners insert their agents" policy.

Verify after applying: creating an agent from the Agents page still works and returns a key once; a direct insert attempt from the browser console fails with a permission error.

## Fix B: wallet sign-in accepts any Lovable project's preview host

Confirmed: `siwe-verify` accepts any host matching a wildcard Lovable preview pattern. That means a copycat sign-in page hosted on someone else's Lovable project could collect a signature and relay it here for a valid session.

Change (`supabase/functions/siwe-verify/index.ts`):
- Keep the explicit allowlist (monast.io, www.monast.io, the existing Lovable app host, localhost entries).
- Replace the wildcard patterns with an exact match against this project's own preview hosts, derived from a project-ID value read from a function secret. If the secret is unset, no preview host is accepted.
- Add the project ID as a backend secret so it is not hardcoded in source.

Verify after applying: sign-in from monast.io and this project's preview still works; a SIWE message whose domain is any other Lovable project is rejected with "SIWE domain not allowed".

## Notes

- No frontend changes are needed for either fix.
- Fix A is applied through an approved database migration; Fix B redeploys one backend function.

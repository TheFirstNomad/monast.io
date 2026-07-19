## Goal
Harden the JSON-LD block in `src/pages/AdDetail.tsx` against XSS and lock the behavior with regression tests.

## Changes

### 1. Extract a reusable sanitizer: `src/lib/jsonLdSafe.ts`
A single pure function `serializeJsonLdSafe(value: unknown): string` that:
- Recursively walks the input and drops any non-plain values (functions, symbols, undefined). Only allows: `string | number | boolean | null | plain object | array`.
- Rejects/strips keys starting with `@` unless in an allow-list (`@context`, `@type`, `@id`, `@graph`) to prevent JSON-LD directive smuggling.
- Caps string length (e.g. 5000 chars) and total serialized size (e.g. 100 KB) — truncates strings, throws on total overflow so caller can fall back to omitting the block.
- After `JSON.stringify`, escapes every character that can break out of a `<script>` context or be misparsed by an HTML parser:
  - `<` → `\u003c`, `>` → `\u003e`, `&` → `\u0026`
  - `'` → `\u0027`, `"` stays inside JSON but any lone `"` outside JSON isn't possible post-stringify
  - `/` → `\u002f` (defense against `</script>` variants and HTML comment sequences)
  - U+2028 → `\u2028`, U+2029 → `\u2029` (JS line terminators)
  - `\u0000` stripped
- Returns `""` on failure (caller then skips rendering the script tag).

### 2. Update `src/pages/AdDetail.tsx`
- Import `serializeJsonLdSafe`.
- Replace the inline `.replace(...)` chain with a single call; only render the `<script>` when the returned string is non-empty.
- Keep `dangerouslySetInnerHTML` (required for JSON-LD) but sourced only from the sanitizer.

### 3. Regression tests: `src/lib/jsonLdSafe.test.ts`
Vitest unit tests covering:
- Round-trips a normal Product object unchanged in meaning (parse back with `JSON.parse` after unescaping).
- Escapes `</script>` payload in title/description so the output contains no literal `</script>` substring (case-insensitive) and no literal `<!--`.
- Escapes `<script>`, `<img onerror=...>`, `"><svg onload=...>` payloads — asserts none of `<`, `>` appear literally in output.
- Escapes U+2028 / U+2029.
- Strips function/symbol/undefined values.
- Drops unknown `@`-prefixed keys, keeps allow-listed ones.
- Truncates oversized strings; returns `""` on total-size overflow.
- Idempotent: sanitizing the output's decoded JSON produces the same string.

### 4. Component regression test: `src/pages/AdDetail.jsonld.test.tsx`
Renders a minimal wrapper that calls the same serializer with a malicious ad payload (title/description containing `</script><img src=x onerror=alert(1)>`) and asserts the rendered `<script type="application/ld+json">` innerHTML:
- Contains no literal `</script>` (case-insensitive).
- Contains no literal `<` or `>`.
- Parses back (after reversing the unicode escapes) into an object whose `name` equals the original malicious string (proving semantics preserved while syntax neutralized).

Uses `@testing-library/react`; no Supabase calls — the test imports the serializer directly and the component test renders a minimal `<head>`-less wrapper to avoid routing/auth setup.

## Out of scope
- No changes to other pages, DB, or edge functions.
- No new dependencies (uses existing vitest + RTL).

## Technical notes
- We keep `dangerouslySetInnerHTML` because JSON-LD must be a raw `<script>` body; React can't render it via children without escaping quotes incorrectly for JSON.
- The `/` → `\u002f` escape is the key addition over the current implementation, which is what closes the `</script>` breakout class of bugs.

/**
 * Safe JSON-LD serializer.
 *
 * Serializes an arbitrary value into a string that is safe to embed inside a
 * `<script type="application/ld+json">` block via `dangerouslySetInnerHTML`.
 *
 * Defenses:
 *  - Strips non-plain values (functions, symbols, undefined) recursively.
 *  - Only allows a known set of JSON-LD directive keys (`@context`, `@type`,
 *    `@id`, `@graph`); other `@`-prefixed keys are dropped.
 *  - Caps individual string length and total serialized size to bound abuse.
 *  - Escapes every character that could break out of the script context or be
 *    misparsed by an HTML parser: `<`, `>`, `&`, `'`, `/`, U+2028, U+2029.
 *    NUL bytes are stripped.
 *
 * On any failure (e.g. cycles or size overflow) returns `""`; callers should
 * skip rendering the script element when the return value is empty.
 */

const ALLOWED_AT_KEYS = new Set(["@context", "@type", "@id", "@graph"]);
const MAX_STRING_LEN = 5000;
const MAX_TOTAL_LEN = 100_000;

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function sanitizeString(s: string): string {
  // Strip NUL bytes; truncate to bound.
  const stripped = s.replace(/\u0000/g, "");
  return stripped.length > MAX_STRING_LEN
    ? stripped.slice(0, MAX_STRING_LEN)
    : stripped;
}

function sanitize(value: unknown, seen: WeakSet<object>): Json | undefined {
  if (value === null) return null;
  const t = typeof value;
  if (t === "string") return sanitizeString(value as string);
  if (t === "number") return Number.isFinite(value as number) ? (value as number) : null;
  if (t === "boolean") return value as boolean;
  if (t === "function" || t === "symbol" || t === "undefined") return undefined;
  if (t !== "object") return undefined;

  const obj = value as object;
  if (seen.has(obj)) return undefined;
  seen.add(obj);

  if (Array.isArray(obj)) {
    const out: Json[] = [];
    for (const item of obj) {
      const s = sanitize(item, seen);
      if (s !== undefined) out.push(s);
    }
    return out;
  }

  // Plain object only.
  const proto = Object.getPrototypeOf(obj);
  if (proto !== Object.prototype && proto !== null) return undefined;

  const out: { [k: string]: Json } = {};
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (key.startsWith("@") && !ALLOWED_AT_KEYS.has(key)) continue;
    const s = sanitize((obj as Record<string, unknown>)[key], seen);
    if (s !== undefined) out[key] = s;
  }
  return out;
}

/**
 * Escape a JSON string so it is safe inside an inline HTML `<script>` block.
 * Applied after `JSON.stringify`, so all characters are already inside JSON
 * string literals or JSON syntax — replacing with `\uXXXX` remains valid JSON.
 */
function escapeForScript(json: string): string {
  return json
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\//g, "\\u002f")
    .replace(/'/g, "\\u0027")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function serializeJsonLdSafe(value: unknown): string {
  try {
    const clean = sanitize(value, new WeakSet());
    if (clean === undefined) return "";
    const json = JSON.stringify(clean);
    if (!json) return "";
    const escaped = escapeForScript(json);
    if (escaped.length > MAX_TOTAL_LEN) return "";
    return escaped;
  } catch {
    return "";
  }
}

// Exposed for tests only.
export const __testing = { escapeForScript, sanitize, MAX_STRING_LEN, MAX_TOTAL_LEN };

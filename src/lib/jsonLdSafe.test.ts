import { describe, it, expect } from "vitest";
import { serializeJsonLdSafe, __testing } from "./jsonLdSafe";

function decode(s: string): unknown {
  // The output is JSON with certain chars encoded as \uXXXX escapes. JSON.parse
  // handles \uXXXX inside string literals natively, so we can parse directly.
  return JSON.parse(s);
}

describe("serializeJsonLdSafe", () => {
  it("round-trips a normal Product object", () => {
    const input = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Widget",
      price: 42,
      inStock: true,
      tags: ["a", "b"],
    };
    const out = serializeJsonLdSafe(input);
    expect(decode(out)).toEqual(input);
  });

  it("escapes </script> payloads", () => {
    const payload = "</script><img src=x onerror=alert(1)>";
    const out = serializeJsonLdSafe({ name: payload });
    expect(out.toLowerCase()).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("<!--");
    // Semantics preserved.
    expect((decode(out) as { name: string }).name).toBe(payload);
  });

  it("escapes assorted HTML injection payloads", () => {
    const payloads = [
      "<script>alert(1)</script>",
      "\"><svg onload=alert(1)>",
      "<img onerror=alert(1) src=x>",
      "'; alert(1); //",
    ];
    for (const p of payloads) {
      const out = serializeJsonLdSafe({ v: p });
      expect(out).not.toContain("<");
      expect(out).not.toContain(">");
      expect(out).not.toContain("'");
      expect(out).not.toContain("/");
      expect((decode(out) as { v: string }).v).toBe(p);
    }
  });

  it("escapes U+2028 / U+2029 line terminators", () => {
    const s = "a\u2028b\u2029c";
    const out = serializeJsonLdSafe({ s });
    expect(out).not.toContain("\u2028");
    expect(out).not.toContain("\u2029");
    expect((decode(out) as { s: string }).s).toBe(s);
  });

  it("strips function/symbol/undefined values", () => {
    const input = {
      keep: "yes",
      fn: () => 1,
      sym: Symbol("x"),
      undef: undefined,
      nested: { fn: () => 2, keep: 1 },
    };
    const out = decode(serializeJsonLdSafe(input)) as Record<string, unknown>;
    expect(out).toEqual({ keep: "yes", nested: { keep: 1 } });
  });

  it("drops unknown @-prefixed keys and keeps allow-listed ones", () => {
    const out = decode(
      serializeJsonLdSafe({
        "@context": "https://schema.org",
        "@type": "Product",
        "@evil": "no",
        "@reverse": "no",
        name: "ok",
      }),
    ) as Record<string, unknown>;
    expect(out).toEqual({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "ok",
    });
  });

  it("truncates oversized strings", () => {
    const huge = "a".repeat(__testing.MAX_STRING_LEN + 100);
    const out = decode(serializeJsonLdSafe({ s: huge })) as { s: string };
    expect(out.s.length).toBe(__testing.MAX_STRING_LEN);
  });

  it("returns empty string on total-size overflow", () => {
    const items = Array.from({ length: 100 }, () => "a".repeat(__testing.MAX_STRING_LEN));
    expect(serializeJsonLdSafe({ items })).toBe("");
  });

  it("returns empty string on cycles", () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    // Cycles cause `self` to be dropped, not the whole doc — still safe.
    const out = serializeJsonLdSafe(a);
    expect(out).not.toBe("");
    expect(decode(out)).toEqual({});
  });

  it("is idempotent for a normal payload", () => {
    const input = { "@type": "Product", name: "x", price: 1 };
    const out1 = serializeJsonLdSafe(input);
    const out2 = serializeJsonLdSafe(decode(out1));
    expect(out1).toBe(out2);
  });

  it("strips NUL bytes", () => {
    const out = decode(serializeJsonLdSafe({ s: "a\u0000b" })) as { s: string };
    expect(out.s).toBe("ab");
  });
});

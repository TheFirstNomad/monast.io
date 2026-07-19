import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { serializeJsonLdSafe } from "@/lib/jsonLdSafe";

// Mirrors the JSON-LD block in AdDetail.tsx. Kept as its own tiny component so
// the regression test doesn't need to boot routing/auth/supabase.
function JsonLdBlock({ ad }: { ad: { title: string; description: string; price: number } }) {
  const html = serializeJsonLdSafe({
    "@context": "https://schema.org",
    "@type": "Product",
    name: ad.title,
    description: ad.description,
    offers: { "@type": "Offer", priceCurrency: "USDC", price: ad.price },
  });
  if (!html) return null;
  return (
    <script
      data-testid="jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

describe("AdDetail JSON-LD rendering", () => {
  it("neutralizes malicious title/description without losing semantics", () => {
    const malicious = "</script><img src=x onerror=alert(1)>";
    const { getByTestId } = render(
      <JsonLdBlock ad={{ title: malicious, description: malicious, price: 10 }} />,
    );
    const html = getByTestId("jsonld").innerHTML;

    expect(html.toLowerCase()).not.toContain("</script>");
    expect(html).not.toContain("<");
    expect(html).not.toContain(">");

    const parsed = JSON.parse(html) as { name: string; description: string };
    expect(parsed.name).toBe(malicious);
    expect(parsed.description).toBe(malicious);
  });
});

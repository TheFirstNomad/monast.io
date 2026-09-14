/**
 * Extra listing fields that only make sense for some categories. Values are
 * stored on `ads.attributes` (jsonb) so new categories can be added without a
 * schema change.
 */
export interface ExtraField {
  key: string;
  label: string;
  placeholder: string;
  /** Long-form fields render as a textarea. */
  multiline?: boolean;
  required: boolean;
}

export const CATEGORY_EXTRA_FIELDS: Record<string, ExtraField[]> = {
  Apps: [
    {
      key: "website",
      label: "Website / Domain",
      placeholder: "e.g. monast.io",
      required: true,
    },
    {
      key: "app_details",
      label: "App details",
      placeholder:
        "What does the app do? Platforms (iOS, Android, web), tech stack, users, revenue, what transfers to the buyer…",
      multiline: true,
      required: true,
    },
  ],
  "Crypto & Coins": [
    {
      key: "token_details",
      label: "Token details",
      placeholder: "Contract address, chain, ticker, quantity…",
      multiline: true,
      required: true,
    },
    {
      key: "crypto_details",
      label: "Transfer & proof",
      placeholder:
        "How the tokens will be transferred, lock-ups or vesting, proof of ownership…",
      multiline: true,
      required: true,
    },
  ],
  NFTs: [
    {
      key: "token_details",
      label: "Collection & token ID",
      placeholder: "Collection name, contract address, chain, token ID…",
      multiline: true,
      required: true,
    },
    {
      key: "crypto_details",
      label: "Transfer & proof",
      placeholder:
        "Marketplace links, royalties, how the transfer happens, proof of ownership…",
      multiline: true,
      required: true,
    },
  ],
  Domains: [
    {
      key: "domain_name",
      label: "Domain name",
      placeholder: "e.g. monast.io",
      required: true,
    },
    {
      key: "registrar",
      label: "Registrar",
      placeholder: "e.g. Namecheap, GoDaddy, ENS",
      required: true,
    },
    {
      key: "expiry",
      label: "Renewal / expiry date",
      placeholder: "e.g. March 2027",
      required: false,
    },
    {
      key: "domain_details",
      label: "Traffic & transfer details",
      placeholder:
        "Monthly traffic, backlinks, age, whether the transfer is by push or auth code…",
      multiline: true,
      required: true,
    },
  ],
  Websites: [
    {
      key: "website",
      label: "Website URL",
      placeholder: "e.g. https://example.com",
      required: true,
    },
    {
      key: "monthly_traffic",
      label: "Monthly visitors",
      placeholder: "e.g. 12,000",
      required: false,
    },
    {
      key: "monthly_revenue",
      label: "Monthly revenue (USDC)",
      placeholder: "e.g. 400",
      required: false,
    },
    {
      key: "website_details",
      label: "What transfers to the buyer",
      placeholder:
        "Domain, codebase, hosting, content, email list, analytics access, revenue proof…",
      multiline: true,
      required: true,
    },
  ],
  "Social & Media Accounts": [
    {
      key: "platform",
      label: "Platform",
      placeholder: "e.g. X, Instagram, TikTok, YouTube, Telegram",
      required: true,
    },
    {
      key: "handle",
      label: "Handle / channel",
      placeholder: "e.g. @monast",
      required: true,
    },
    {
      key: "followers",
      label: "Followers / subscribers",
      placeholder: "e.g. 48,000",
      required: true,
    },
    {
      key: "account_details",
      label: "Niche & transfer details",
      placeholder:
        "Audience niche, engagement, monetisation, how login and ownership transfer…",
      multiline: true,
      required: true,
    },
  ],
  "Digital Products": [
    {
      key: "delivery_method",
      label: "Delivery method",
      placeholder: "e.g. download link, GitHub invite, Figma file, email",
      required: true,
    },
    {
      key: "product_details",
      label: "What the buyer receives",
      placeholder:
        "File formats, what's included, licence terms, updates or support…",
      multiline: true,
      required: true,
    },
  ],
  Services: [
    {
      key: "delivery_time",
      label: "Delivery time",
      placeholder: "e.g. 5 days",
      required: true,
    },
    {
      key: "service_details",
      label: "Scope of work",
      placeholder:
        "What's included, revisions, what you need from the buyer, how work is delivered…",
      multiline: true,
      required: true,
    },
  ],
};

export function extraFieldsFor(category: string): ExtraField[] {
  return CATEGORY_EXTRA_FIELDS[category] ?? [];
}

/** Human-readable label for a stored attribute key, for display on ad pages. */
export function attributeLabel(key: string): string {
  for (const fields of Object.values(CATEGORY_EXTRA_FIELDS)) {
    const hit = fields.find((f) => f.key === key);
    if (hit) return hit.label;
  }
  return key.replace(/_/g, " ");
}

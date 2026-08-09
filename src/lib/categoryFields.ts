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
  "Crypto & NFTs": [
    {
      key: "token_details",
      label: "Token / NFT details",
      placeholder: "Contract address (if any), chain, token ID, quantity…",
      multiline: true,
      required: true,
    },
    {
      key: "crypto_details",
      label: "Additional details",
      placeholder:
        "What exactly is being sold, how it will be transferred, lock-ups or vesting, proof of ownership…",
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

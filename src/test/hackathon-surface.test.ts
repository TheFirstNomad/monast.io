import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Live paths: self-custody wallet sign-in and email + Circle wallet sign-in,
// both leading to listing -> escrow. Swap and the Arc App Kit stay parked on
// disk and must not be reachable from any live screen.
const read = (p: string) => readFileSync(p, "utf8");

const LIVE_FILES = [
  "src/App.tsx",
  "src/components/Navbar.tsx",
  "src/components/Layout.tsx",
  "src/components/SignInChoice.tsx",
  "src/components/EscrowButton.tsx",
  "src/pages/Auth.tsx",
  "src/pages/EscrowDetail.tsx",
];

const PARKED = ["SwapPanel", "SwapDialog", "pages/Swap", "arcAppKit"];

describe("parked features stay unreachable", () => {
  it("no live file imports a parked component", () => {
    for (const file of LIVE_FILES) {
      const src = read(file);
      for (const name of PARKED) {
        expect(src.includes(name), `${file} still references ${name}`).toBe(false);
      }
    }
  });

  it("has no /swap route or link", () => {
    for (const file of LIVE_FILES) {
      expect(read(file).includes("/swap"), `${file} still links to /swap`).toBe(false);
    }
  });

  it("sign-in offers both wallet and Google paths", () => {
    const src = read("src/components/SignInChoice.tsx");
    expect(src.includes('signInWithOAuth("google"')).toBe(true);
    expect(src.includes("connect()")).toBe(true);
  });

  it("email sign-in provisions a Circle wallet", () => {
    const src = read("src/pages/Auth.tsx");
    expect(src.includes("circle-provision-wallet")).toBe(true);
    expect(src.includes("WalletSetupDialog")).toBe(true);
  });
});


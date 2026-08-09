import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// The hackathon build ships one path: self-custody wallet -> listing -> escrow.
// Swap, email sign-in and Circle user-controlled wallets are parked on disk but
// must not be reachable from any live screen.
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

const PARKED = ["SwapPanel", "SwapDialog", "pages/Swap", "WalletSetupDialog", "CircleFundButton", "arcAppKit"];

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

  it("sign-in offers no email/OTP path", () => {
    const src = read("src/components/SignInChoice.tsx");
    expect(src.includes("signInWithOtp")).toBe(false);
    expect(src.includes("verifyOtp")).toBe(false);
  });
});

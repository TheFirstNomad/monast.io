// Guards the sender-binding invariant: every money endpoint that verifies an
// on-chain payment MUST look up the caller's own profiles.wallet_address and
// pass it as `expectedFrom`, so a stranger's transaction hash can't be replayed.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const FUNCTIONS = [
  { name: "escrow-confirm-funded", callerVar: "buyerId" },
  { name: "ad-listing-fee", callerVar: "userId" },
  { name: "promote-checkout", callerVar: "userId" },
];

function readFn(name: string) {
  return readFileSync(
    path.resolve(__dirname, `../../supabase/functions/${name}/index.ts`),
    "utf8",
  );
}

/** Strip line + block comments so doc text can't satisfy a check. */
function stripComments(src: string) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Extract each verifyUsdcTransfer({...}) argument object. */
function verifyCalls(src: string): string[] {
  const out: string[] = [];
  const marker = "verifyUsdcTransfer(";
  let i = src.indexOf(marker);
  while (i !== -1) {
    let depth = 0;
    let j = i + marker.length;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === "(" || c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ")") {
        if (depth === 0) break;
        depth--;
      }
    }
    out.push(src.slice(i + marker.length, j));
    i = src.indexOf(marker, j);
  }
  return out;
}

describe("on-chain sender binding", () => {
  for (const { name, callerVar } of FUNCTIONS) {
    describe(name, () => {
      const src = stripComments(readFn(name));

      it("looks up the caller's wallet_address from profiles", () => {
        expect(src).toMatch(/\.from\(\s*["']profiles["']\s*\)/);
        expect(src).toMatch(/\.select\(\s*["'][^"']*wallet_address[^"']*["']\s*\)/);
        // Scoped to the authenticated caller, never a client-supplied id.
        expect(src).toMatch(
          new RegExp(`\\.eq\\(\\s*["']id["']\\s*,\\s*${callerVar}\\s*\\)`),
        );
      });

      it("passes that wallet as expectedFrom on every verifyUsdcTransfer call", () => {
        const calls = verifyCalls(src);
        expect(calls.length).toBeGreaterThan(0);
        for (const args of calls) {
          expect(args).toMatch(/expectedFrom\s*:/);
          // The value must come from the profile row, not from request input.
          expect(args).toMatch(/expectedFrom\s*:\s*\w*[Pp]rofile\w*(\?)?\.wallet_address/);
          expect(args).not.toMatch(/expectedFrom\s*:\s*(body|req|params)/);
        }
      });

      it("never sources expectedFrom from the request body", () => {
        expect(src).not.toMatch(/expectedFrom\s*:\s*[^,\n]*body/);
      });
    });
  }
});

import { describe, it, expect } from "vitest";
import { splitSale, toBaseUnits, fromBaseUnits, formatUsdc } from "@/lib/fees";

describe("integer USDC math", () => {
  it("parses decimals exactly", () => {
    expect(toBaseUnits(0.1) + toBaseUnits(0.2)).toBe(300000n);
    expect(toBaseUnits("1.000001")).toBe(1000001n);
    expect(toBaseUnits(10)).toBe(10000000n);
  });

  it("formats without float artifacts", () => {
    expect(formatUsdc(300000n)).toBe("0.3");
    expect(formatUsdc(1000001n)).toBe("1.000001");
    expect(formatUsdc(10000000n)).toBe("10");
  });

  it("splits a sale so fee + net always equals gross exactly", () => {
    for (const amt of ["0.1", "0.3", "1", "10", "33.333333", "0.15", "999999.999999"]) {
      const s = splitSale(amt);
      expect(s.feeMicros + s.sellerNetMicros).toBe(s.grossMicros);
      expect(s.feeMicros >= 0n).toBe(true);
    }
  });

  it("never rounds the fee up against the seller", () => {
    const s = splitSale("0.000199"); // 2.5% = 4.975 micros -> truncates to 4
    expect(s.feeMicros).toBe(4n);
    expect(s.sellerNetMicros).toBe(195n);
  });

  it("charges a 2.5% sale fee", () => {
    const s = splitSale("100");
    expect(s.feeMicros).toBe(2_500_000n);
    expect(s.sellerNetMicros).toBe(97_500_000n);
  });

  it("round-trips through numbers", () => {
    expect(fromBaseUnits(toBaseUnits(123.456789))).toBe(123.456789);
  });

  it("rejects garbage amounts", () => {
    expect(() => toBaseUnits("abc")).toThrow();
  });
});

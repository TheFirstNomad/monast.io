import { describe, expect, it } from "vitest";
import { getFunctionErrorMessage } from "./functionErrors";

describe("getFunctionErrorMessage", () => {
  it("reads a JSON error from FunctionsHttpError.context", async () => {
    const error = {
      message: "Edge Function returned a non-2xx status code",
      context: new Response(JSON.stringify({ error: "Circle rejected the token id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    };

    await expect(getFunctionErrorMessage(error, "Payment failed")).resolves.toBe(
      "Circle rejected the token id",
    );
  });

  it("reads a plain-text response", async () => {
    const error = {
      message: "Edge Function returned a non-2xx status code",
      context: new Response("Service temporarily unavailable", { status: 503 }),
    };

    await expect(getFunctionErrorMessage(error, "Payment failed")).resolves.toBe(
      "Service temporarily unavailable",
    );
  });

  it("falls back to the SDK message", async () => {
    await expect(
      getFunctionErrorMessage({ message: "Network request failed" }, "Payment failed"),
    ).resolves.toBe("Network request failed");
  });
});
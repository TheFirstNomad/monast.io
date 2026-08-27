type FunctionErrorLike = {
  message?: string;
  context?: unknown;
};

function messageFromBody(body: unknown): string | null {
  if (typeof body === "string") return body.trim() || null;
  if (!body || typeof body !== "object") return null;

  const record = body as Record<string, unknown>;
  for (const key of ["error", "message", "detail"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Reads the response body attached to a FunctionsHttpError. */
export async function getFunctionErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  const functionError = error as FunctionErrorLike | null;
  const context = functionError?.context;

  if (context instanceof Response) {
    try {
      const text = await context.clone().text();
      if (text.trim()) {
        try {
          const parsed = JSON.parse(text) as unknown;
          const bodyMessage = messageFromBody(parsed);
          if (bodyMessage) return bodyMessage;
        } catch {
          return text.trim();
        }
      }
    } catch {
      // Fall through to the SDK message when the response body is unavailable.
    }
  } else {
    const contextMessage = messageFromBody(context);
    if (contextMessage) return contextMessage;
  }

  return functionError?.message || fallback;
}
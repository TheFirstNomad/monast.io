const CIRCLE_BASE = "https://api.circle.com/v1/w3s";
const CIRCLE_API_KEY = Deno.env.get("CIRCLE_API_KEY")!;

export async function circle(path: string, init: RequestInit = {}) {
  const res = await fetch(`${CIRCLE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CIRCLE_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 155509: the Circle Gas Station policy for this network is not set up yet.
    if ((data as { code?: number })?.code === 155509) {
      console.error(`Circle ${path} 155509: gas station policy missing`);
      const err = new Error(
        "Payments from Monast wallets are paused for a moment while the site owner finishes setup. Please try again later.",
      ) as Error & { upstreamStatus?: number };
      err.upstreamStatus = 503;
      throw err;
    }
    // Only provider codes and endpoint paths are safe to log, never payloads.
    console.error(`Circle ${path} ${res.status} code ${data?.code ?? "unknown"}`);
    throw new Error(`Circle ${path} ${res.status} code ${data?.code ?? "unknown"}`);
  }
  return data;
}

const TOKEN_SAFETY_MS = 5 * 60 * 1000;

/**
 * Wallets created through the in-app onboarding step (circle-provision-wallet)
 * have no social refresh session, so a userToken is minted directly from the
 * stored Circle userId. Without this path those buyers finish onboarding and
 * then cannot pay at all.
 */
async function mintUserSession(admin: any, userId: string) {
  const { data: profile } = await admin
    .from("profiles")
    .select("circle_user_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.circle_user_id) {
    throw new Error("Finish setting up your wallet before paying.");
  }
  const res = await circle("/users/token", {
    method: "POST",
    body: JSON.stringify({ userId: profile.circle_user_id }),
  });
  const userToken: string | undefined = res?.data?.userToken;
  const encryptionKey: string = res?.data?.encryptionKey ?? "";
  if (!userToken) throw new Error("Circle did not return a wallet session");
  return { userToken, encryptionKey };
}

export async function getFreshUserSession(admin: any, userId: string, forceRefresh = false) {
  const { data: session } = await admin
    .from("circle_sessions")
    .select("refresh_token, user_token, device_id, user_token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  // Circle rejects a partial refresh with a bare 403 "userToken is invalid",
  // so never call it without all three pieces of the session. A user without a
  // social session still has a Circle userId we can mint a token for.
  if (!session?.refresh_token || !session?.user_token || !session?.device_id) {
    return await mintUserSession(admin, userId);
  }

  if (!forceRefresh && session.user_token_expires_at) {
    const expiresAt = new Date(session.user_token_expires_at).getTime();
    if (Number.isFinite(expiresAt) && expiresAt - Date.now() > TOKEN_SAFETY_MS) {
      return { userToken: session.user_token as string, encryptionKey: "" };
    }
  }

  const refreshed = await circle("/users/token/refresh", {
    method: "POST",
    headers: { "X-User-Token": session.user_token },
    body: JSON.stringify({
      refreshToken: session.refresh_token,
      deviceId: session.device_id,
      idempotencyKey: crypto.randomUUID(),
    }),
  });
  const data = refreshed?.data ?? {};
  if (!data.userToken) throw new Error("Circle did not return a wallet session");

  await admin
    .from("circle_sessions")
    .update({
      user_token: data.userToken,
      refresh_token: data.refreshToken ?? session.refresh_token,
      // Circle userTokens are valid for 60 minutes.
      user_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return {
    userToken: data.userToken as string,
    encryptionKey: (data.encryptionKey ?? data.deviceEncryptionKey ?? "") as string,
  };
}


// Client-side Circle Web SDK singleton.
// The SDK is initialized with the public APP_ID and later receives the
// userToken + encryptionKey minted by Circle (social login) or by the
// circle-provision-wallet edge function. All PIN entry happens inside the
// SDK's UI overlay - the app never sees the PIN, keeping wallets non-custodial.
import { W3SSdk, SocialLoginProvider } from "@circle-fin/w3s-pw-web-sdk";
import type { LoginCompleteCallback } from "@circle-fin/w3s-pw-web-sdk/dist/src/types";
import { supabase } from "@/integrations/supabase/client";
import { CIRCLE_APP_ID, GOOGLE_CLIENT_ID, googleRedirectUri } from "./config";

let sdk: W3SSdk | null = null;

export function getCircleSdk(): W3SSdk {
  if (!sdk) {
    sdk = new W3SSdk({
      appSettings: { appId: CIRCLE_APP_ID },
    });
  }
  return sdk;
}

export interface CircleChallengeInput {
  userToken: string;
  encryptionKey: string;
  challengeId: string;
}

// Runs a Circle challenge (PIN setup / wallet initialize / sign transaction).
// Resolves on user success, rejects on error or user cancellation.
export function runCircleChallenge(input: CircleChallengeInput): Promise<void> {
  const s = getCircleSdk();
  s.setAuthentication({
    userToken: input.userToken,
    encryptionKey: input.encryptionKey,
  });

  return new Promise((resolve, reject) => {
    s.execute(input.challengeId, (error, result) => {
      if (error) {
        reject(new Error(error.message || "Circle challenge failed"));
        return;
      }
      if (result?.type) {
        resolve();
        return;
      }
      reject(new Error("Circle challenge returned no result"));
    });
  });
}

/**
 * Prepares the singleton for Circle's native Google Social Login and registers
 * the callback that fires when the browser returns from Google's consent
 * screen. Must be called before `startGoogleSocialLogin()` and also on page
 * load so the redirect back from Google can be picked up.
 */
export async function initGoogleSocialLogin(
  onLoginComplete: LoginCompleteCallback,
): Promise<void> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      "Google sign-in is not configured yet (missing VITE_GOOGLE_CLIENT_ID).",
    );
  }

  const s = getCircleSdk();
  const deviceId = await s.getDeviceId();

  const { data, error } = await supabase.functions.invoke("circle-social", {
    body: { action: "deviceToken", deviceId },
  });
  if (error) throw new Error(error.message);
  if (!data || data.error) throw new Error(data?.error ?? "Could not reach Circle");

  s.updateConfigs(
    {
      appSettings: { appId: CIRCLE_APP_ID },
      loginConfigs: {
        google: {
          clientId: GOOGLE_CLIENT_ID,
          redirectUri: googleRedirectUri(),
          selectAccountPrompt: true,
        },
        deviceToken: data.deviceToken,
        deviceEncryptionKey: data.deviceEncryptionKey,
      },
    },
    onLoginComplete,
  );
}

/** Sends the user to Google via Circle. Resolves once the redirect starts. */
export async function startGoogleSocialLogin(): Promise<void> {
  await getCircleSdk().performLogin(SocialLoginProvider.GOOGLE);
}

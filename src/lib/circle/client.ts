// Client-side Circle Web SDK singleton.
// The SDK is initialized with the public APP_ID and later receives the
// userToken + encryptionKey minted by Circle (social login) or by the
// circle-provision-wallet edge function. Wallet initialization happens inside
// the SDK's UI overlay - Social Login wallets have no PIN step; the app never
// sees any wallet secret either way, keeping wallets non-custodial.
import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import {
  SocialLoginProvider,
  type LoginCompleteCallback,
} from "@circle-fin/w3s-pw-web-sdk/dist/src/types";
import { supabase } from "@/integrations/supabase/client";
import { CIRCLE_APP_ID, GOOGLE_CLIENT_ID, googleRedirectUri } from "./config";

let sdk: W3SSdk | null = null;

const PENDING_DEVICE_KEY = "monast.circleGoogleDevice";
// Circle device tokens live for 10 minutes. Anything older than this is
// discarded so a slow trip through Google's consent screen re-mints instead of
// stalling the login with an expired token.
const PENDING_DEVICE_TTL_MS = 8 * 60 * 1000;

interface PendingDevice {
  deviceToken: string;
  deviceEncryptionKey: string;
  mintedAt: number;
}

function readPendingDevice(): PendingDevice | null {
  const raw = sessionStorage.getItem(PENDING_DEVICE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingDevice>;
    if (
      !parsed.deviceToken ||
      !parsed.deviceEncryptionKey ||
      !parsed.mintedAt ||
      Date.now() - parsed.mintedAt > PENDING_DEVICE_TTL_MS
    ) {
      sessionStorage.removeItem(PENDING_DEVICE_KEY);
      return null;
    }
    return parsed as PendingDevice;
  } catch {
    sessionStorage.removeItem(PENDING_DEVICE_KEY);
    return null;
  }
}

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

// Runs a Circle challenge (wallet initialize / sign transaction).
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
  // If a login is already in flight (we're returning from Google's
  // redirect), reuse the exact device token pair used before the redirect.
  // Circle's own docs warn that calling getDeviceId() again mid-login
  // opens a fresh invisible modal and interrupts the pending login - so
  // we must NOT re-derive the device id/token here in that case.
  const pending = readPendingDevice();
  let deviceToken: string;
  let deviceEncryptionKey: string;

  if (pending) {
    ({ deviceToken, deviceEncryptionKey } = pending);
  } else {
    const deviceId = await s.getDeviceId();

    const { data, error } = await supabase.functions.invoke("circle-social", {
      body: { action: "deviceToken", deviceId },
    });
    if (error) throw new Error(error.message);
    if (!data || data.error) throw new Error(data?.error ?? "Could not reach Circle");

    deviceToken = data.deviceToken;
    deviceEncryptionKey = data.deviceEncryptionKey;
  }

  s.updateConfigs(
    {
      appSettings: { appId: CIRCLE_APP_ID },
      loginConfigs: {
        google: {
          clientId: GOOGLE_CLIENT_ID,
          redirectUri: googleRedirectUri(),
          selectAccountPrompt: true,
        },
        deviceToken,
        deviceEncryptionKey,
      },
    },
    (error, result) => {
      // Login finished (success or failure) - the pending pair is no
      // longer needed regardless of outcome.
      sessionStorage.removeItem(PENDING_DEVICE_KEY);
      onLoginComplete(error, result);
    },
  );

  if (!pending) {
    sessionStorage.setItem(
      PENDING_DEVICE_KEY,
      JSON.stringify({ deviceToken, deviceEncryptionKey, mintedAt: Date.now() }),
    );
  }
}

/** Sends the user to Google via Circle. Resolves once the redirect starts. */
export async function startGoogleSocialLogin(): Promise<void> {
  await getCircleSdk().performLogin(SocialLoginProvider.GOOGLE);
}

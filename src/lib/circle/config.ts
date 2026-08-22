// Circle Web3 Services - public client identifiers.
// The APP_ID is a public value (analogous to a Supabase anon key). The secret
// CIRCLE_API_KEY lives only in edge functions.
export const CIRCLE_APP_ID = "a8b80470-0e58-5523-83e8-5f78de4b8fcb";

// Google Web Client ID used by Circle's native Social Login.
// Public value. The very same client ID must also be pasted into
// Circle Console -> Wallets -> User Controlled -> Configurator -> Social Logins
// -> Google, and the app origin + `/auth` must be listed as an authorized
// JavaScript origin / redirect URI on the Google credential.
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "") as string;

// Where Google sends the user back after consent.
export const googleRedirectUri = () => `${window.location.origin}/auth`;

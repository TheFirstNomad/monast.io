/**
 * Self-custody sessions are minted by SIWE with a synthetic email on this
 * domain. Anything else (Google / email sign-in) is a hosted-wallet session
 * that must survive wallet connects, tab reloads and refreshes until the user
 * explicitly signs out.
 */
export const SELF_CUSTODY_EMAIL_DOMAIN = "@wallet.monast.io";

export const isSelfCustodyEmail = (email?: string | null) =>
  Boolean(email && email.toLowerCase().endsWith(SELF_CUSTODY_EMAIL_DOMAIN));

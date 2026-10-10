import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { applyBrandMetadata, SITE_TITLE } from "@/lib/siteMetadata";

const PAGE_NAMES: Record<string, string> = {
  auth: "Sign in", messages: "Messages", transactions: "Transactions",
  account: "Account", settings: "Profile settings", dashboard: "Seller dashboard",
  favorites: "Saved items", purchases: "Purchases", wallet: "Wallet",
  "post-ad": "Sell an item", "edit-ad": "Edit listing", publish: "Publish listing",
  promote: "Promote listing", buy: "Checkout", escrow: "Escrow",
  browse: "Browse the marketplace", apps: "Buy and sell apps",
  "crypto-coins": "Buy and sell crypto coins", nfts: "Buy and sell NFTs",
  domains: "Buy and sell domains", agents: "Agent API", "agent-docs": "Agent API",
  pricing: "Spotlight", pro: "Pro sellers", reputation: "Seller reputation",
  "escrow-api": "Escrow API", "agent-billing": "Agent billing",
  analytics: "Seller analytics", disputes: "Dispute history", "bulk-import": "Bulk import",
  "for-freelancers": "For freelancers", "for-crypto-traders": "For crypto traders",
  "for-domain-sellers": "For domain sellers", seller: "Seller profile", ad: "Marketplace listing",
  admin: "Administration",
};

export const GlobalSeo = () => {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const section = pathname.split("/")[1];
    const name = PAGE_NAMES[section];
    applyBrandMetadata(pathname === "/" ? SITE_TITLE : `${name ?? "Page not found"} | Monast`);
  }, [pathname]);
  return null;
};
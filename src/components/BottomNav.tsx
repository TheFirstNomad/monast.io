import { Link, useLocation } from "react-router-dom";
import { Home, Search, Plus, MessageCircle, User } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { useAuth } from "@/hooks/useAuth";

/**
 * BottomNav — mobile-only bottom navigation bar.
 * Visible only on screens smaller than `md` (768 px).
 * Adds `pb-16` bottom padding to the body so content is never hidden behind it.
 *
 * Five primary actions: Home, Browse, Sell, Messages, Account.
 * Additive — no existing component is modified.
 */

const NAV_ITEMS = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/browse", label: "Browse", Icon: Search },
  { to: "/post-ad", label: "Sell", Icon: Plus, accent: true },
  { to: "/messages", label: "Messages", Icon: MessageCircle, requiresAuth: true },
  { to: "/dashboard", label: "Account", Icon: User, requiresAuth: true },
];

export const BottomNav = () => {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <>
      {/* Spacer so page content is never hidden behind the bar */}
      <div className="h-16 md:hidden" aria-hidden="true" />

      <nav
        className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-background/95 backdrop-blur-md border-t border-border"
        aria-label="Mobile navigation"
      >
        <ul className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
          {NAV_ITEMS.map(({ to, label, Icon, accent, requiresAuth }) => {
            // Hide auth-required items from signed-out users with a sign-in link
            const href = requiresAuth && !user ? "/auth" : to;
            const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));

            return (
              <li key={to} className="flex-1">
                <Link
                  to={href}
                  className={`flex flex-col items-center justify-center gap-0.5 h-full w-full rounded-lg transition-colors ${
                    accent
                      ? "text-background bg-primary hover:bg-primary/90 mx-1 rounded-xl"
                      : active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className={accent ? "w-5 h-5" : "w-5 h-5"} />
                  <span className={`text-[10px] font-medium leading-none ${accent ? "text-background" : ""}`}>
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
};

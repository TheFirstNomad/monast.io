import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { RehydrationBanner } from "@/components/RehydrationBanner";

const FOOTER_LINKS: { heading: string; links: { to: string; label: string }[] }[] = [
  {
    heading: "Market",
    links: [
      { to: "/browse", label: "Browse listings" },


      { to: "/post-ad", label: "Post a free ad" },
      { to: "/favorites", label: "Saved items" },
    ],
  },
  {
    heading: "Sell",
    links: [
      { to: "/dashboard", label: "Seller dashboard" },
      { to: "/pricing", label: "Featured pricing" },
      { to: "/settings", label: "Profile settings" },
    ],
  },
  {
    heading: "Agents",
    links: [
      { to: "/agent-docs", label: "API documentation" },
      { to: "/agents", label: "Agent access" },
    ],
  },
  {
    heading: "Account",
    links: [
      { to: "/account", label: "Orders & sales" },
      { to: "/messages", label: "Messages" },
      { to: "/transactions", label: "Transactions" },
    ],
  },
];

export const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen flex flex-col bg-background">
    <RehydrationBanner />
    <Navbar />
    <main className="flex-1">{children}</main>
    <footer className="border-t border-border py-14 px-4 mt-16 bg-secondary/35">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-x-8 gap-y-10 mb-12">
          <div className="col-span-2">
            <Link to="/" className="font-display text-2xl text-foreground">Monast</Link>
            <p className="text-sm text-muted-foreground max-w-xs mt-3 leading-relaxed">
              The global desk for anything, settled in USDC.
            </p>
          </div>
          {FOOTER_LINKS.map((group) => (
            <nav key={group.heading} aria-label={group.heading}>
              <h2 className="text-xs font-semibold text-foreground mb-3">
                {group.heading}
              </h2>
              <ul className="space-y-2">
                {group.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-border pt-6 text-sm text-muted-foreground">
          © 2026 Monast. Global commerce, settled in USDC.
        </div>
      </div>
    </footer>
  </div>
);

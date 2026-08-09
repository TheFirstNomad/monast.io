import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { RehydrationBanner } from "@/components/RehydrationBanner";

const FOOTER_LINKS: { heading: string; links: { to: string; label: string }[] }[] = [
  {
    heading: "Marketplace",
    links: [
      { to: "/browse", label: "Browse listings" },


      { to: "/post-ad", label: "Post a free ad" },
      { to: "/favorites", label: "Saved items" },
    ],
  },
  {
    heading: "Sellers",
    links: [
      { to: "/dashboard", label: "Seller dashboard" },
      { to: "/pricing", label: "Featured pricing" },
      { to: "/settings", label: "Profile settings" },
    ],
  },
  {
    heading: "Activity",
    links: [
      { to: "/transactions", label: "Transactions" },
      { to: "/messages", label: "Messages" },
    ],
  },
];

export const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen flex flex-col bg-background">
    <RehydrationBanner />
    <Navbar />
    <main className="flex-1">{children}</main>
    <footer className="border-t border-border py-10 px-4 mt-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">M</span>
              </div>
              <span className="font-bold text-foreground">monast.io</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Agentic escrow marketplace. Buy and sell anything worldwide, settled in USDC.
            </p>
          </div>
          {FOOTER_LINKS.map((group) => (
            <nav key={group.heading} aria-label={group.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground mb-3">
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
        <div className="border-t border-border pt-6 text-center text-sm text-muted-foreground">
          © 2026 monast.io&nbsp; Buy &amp; Sell Anything with USDC on Arc
        </div>
      </div>
    </footer>
  </div>
);

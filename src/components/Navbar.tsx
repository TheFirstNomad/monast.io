import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, Plus, Menu, X, Wallet, User } from "lucide-react";
import { useState } from "react";

export const Navbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [connected, setConnected] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">M</span>
            </div>
            <span className="text-lg font-bold text-foreground hidden sm:block">monast.io</span>
          </Link>

          {/* Search - desktop */}
          <div className="hidden md:flex flex-1 max-w-xl mx-6">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search for anything..."
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Right actions */}
          <div className="hidden md:flex items-center gap-2">
            {connected ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-1.5 rounded-lg bg-secondary">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">1,250.00 USDC</span>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setConnected(true)} className="gap-2">
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </Button>
            )}
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" className="rounded-lg">
                <User className="w-5 h-5" />
              </Button>
            </Link>
            <Link to="/post-ad">
              <Button size="sm" className="gap-2 font-semibold">
                <Plus className="w-4 h-4" />
                Post Free Ad
              </Button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <div className="flex md:hidden items-center gap-2">
            <Link to="/post-ad">
              <Button size="sm" className="gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Post Ad
              </Button>
            </Link>
            <button onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card px-4 py-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search for anything..."
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            {[
              { to: "/", label: "Home" },
              { to: "/browse", label: "Browse" },
              { to: "/dashboard", label: "Dashboard" },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  location.pathname === link.to ? "bg-accent text-foreground" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConnected(!connected)}
            className="w-full gap-2"
          >
            <Wallet className="w-4 h-4" />
            {connected ? "1,250.00 USDC" : "Connect Wallet"}
          </Button>
        </div>
      )}
    </nav>
  );
};

import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Plus, Menu, X, Wallet, User, MessageCircle, Receipt, LogOut, LayoutDashboard, Bot, Heart } from "lucide-react";
import { useState } from "react";
import { NotificationsBell } from "@/components/NotificationsBell";

import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { address, connect, connecting, disconnect } = useWallet();
  const { user } = useAuth();
  const { count: favCount } = useFavorites();

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/browse?q=${encodeURIComponent(q)}` : "/browse");
    setMobileOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">M</span>
            </div>
            <span className="text-lg font-bold text-foreground hidden sm:block">monast.io</span>
          </Link>

          <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-xl mx-6">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for anything..."
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </form>

          <div className="hidden md:flex items-center gap-2">
            <Link to="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground px-2">
              Pricing
            </Link>
            {address ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent transition-colors">
                    <Wallet className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground">{short}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <User className="w-4 h-4 mr-2" /> Profile settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/dashboard/agents")}>
                    <Bot className="w-4 h-4 mr-2" /> Agents
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/agents")}>
                    <Bot className="w-4 h-4 mr-2" /> Agent API docs
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={disconnect}>
                    <LogOut className="w-4 h-4 mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" size="sm" onClick={connect} disabled={connecting} className="gap-2">
                <Wallet className="w-4 h-4" />
                {connecting ? "Signing in..." : "Connect Wallet"}
              </Button>
            )}
            {user && (
              <>
                <NotificationsBell />
                <Link to="/favorites">
                  <Button variant="ghost" size="icon" className="rounded-lg relative">
                    <Heart className="w-5 h-5" />
                    {favCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {favCount > 99 ? "99+" : favCount}
                      </span>
                    )}
                  </Button>
                </Link>
                <Link to="/messages">
                  <Button variant="ghost" size="icon" className="rounded-lg">
                    <MessageCircle className="w-5 h-5" />
                  </Button>
                </Link>
                <Link to="/transactions">
                  <Button variant="ghost" size="icon" className="rounded-lg">
                    <Receipt className="w-5 h-5" />
                  </Button>
                </Link>
              </>
            )}


            <Link to={user ? "/dashboard" : "/auth"}>
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

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card px-4 py-4 space-y-3">
          <form onSubmit={submitSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for anything..."
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </form>
          <div className="flex flex-col gap-1">
            {[
              { to: "/", label: "Home" },
              { to: "/browse", label: "Browse" },
              { to: "/pricing", label: "Pricing" },
              { to: "/favorites", label: "Saved items" },
              { to: "/messages", label: "Messages" },

              { to: "/transactions", label: "Transactions" },
              { to: "/settings", label: "Profile settings" },
              { to: user ? "/dashboard" : "/auth", label: user ? "Dashboard" : "Sign in" },
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
          {address ? (
            <Button variant="outline" size="sm" onClick={disconnect} className="w-full gap-2">
              <LogOut className="w-4 h-4" />
              Sign out ({short})
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={connect} disabled={connecting} className="w-full gap-2">
              <Wallet className="w-4 h-4" />
              {connecting ? "Signing in..." : "Connect Wallet"}
            </Button>
          )}
        </div>
      )}
    </nav>
  );
};

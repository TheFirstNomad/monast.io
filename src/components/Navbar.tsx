import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  Menu,
  X,
  Wallet,
  User,
  MessageCircle,
  Receipt,
  LogOut,
  LayoutDashboard,
  Heart,
  Banknote,
  Gavel,
  Flag,
  ShieldCheck,
  ChevronDown,

  Mail,
  Tag,
  Store,
  ShoppingBag,
} from "lucide-react";
import { useState } from "react";
import { NotificationsBell } from "@/components/NotificationsBell";


import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import { useRoles } from "@/hooks/useRoles";
import { isOwnerWallet } from "@/lib/owner";

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { address, connect, connecting, disconnect } = useWallet();
  const { user, signOut } = useAuth();
  const { count: favCount } = useFavorites();
  const { isArbitrator, isModerator, has } = useRoles();

  const isOwner = isOwnerWallet(address);
  const showAdmin = isOwner || isModerator;
  const adminLinks = [
    ...(isOwner ? [{ to: "/admin/treasury", label: "Treasury", Icon: Banknote }] : []),
    ...(isOwner || isArbitrator ? [{ to: "/admin/disputes", label: "Disputes", Icon: Gavel }] : []),
    ...(isOwner || isModerator || has("admin") ? [{ to: "/admin/reports", label: "Reports", Icon: Flag }] : []),
    ...(isOwner ? [{ to: "/admin/roles", label: "Roles", Icon: ShieldCheck }] : []),
  ];

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
  const signedIn = Boolean(address || user);
  // A session with no connected address is a monast (Google) wallet account -
  // it must never be shown a "Connect" prompt.
  const socialSignedIn = Boolean(user && !address);
  const handle = user?.email ? user.email.split("@")[0] : "Account";
  const accountLabel = address ? short : socialSignedIn ? handle : "Sign in";
  const handleSignOut = address ? disconnect : signOut;


  const accountLinks = [
    { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { to: "/account", label: "My account", Icon: ShoppingBag },
    { to: "/wallet", label: "Wallet", Icon: Wallet },
    { to: "/purchases", label: "My purchases", Icon: ShoppingBag },

    { to: "/settings", label: "Profile settings", Icon: User },
    { to: "/favorites", label: "Saved items", Icon: Heart },
    { to: "/messages", label: "Messages", Icon: MessageCircle },
    { to: "/transactions", label: "Transactions", Icon: Receipt },
  ];

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
            <span className="text-lg font-bold text-foreground hidden sm:block">MONAST</span>
          </Link>

          <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-xl mx-6">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                aria-label="Search listings"
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



            {user && <NotificationsBell />}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label={signedIn ? "Account menu" : "Sign in menu"}
                  className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent transition-colors"
                >
                  {socialSignedIn ? (
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
                      {handle.charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <Wallet className={`w-4 h-4 ${address ? "text-primary" : "text-emerald-500"}`} />
                  )}
                  <span className="font-medium text-foreground max-w-[10rem] truncate">{accountLabel}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {signedIn ? (
                  <>
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      {address ? "Connected wallet" : "Signed in as"}
                      <div className="text-sm font-semibold text-foreground truncate">
                        {address ? short : user?.email ?? handle}
                      </div>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Account</DropdownMenuLabel>
                    {accountLinks.map(({ to, label, Icon }) => (
                      <DropdownMenuItem key={to} onClick={() => navigate(to)}>
                        <Icon className="w-4 h-4 mr-2" /> {label}
                        {to === "/favorites" && favCount > 0 && (
                          <span className="ml-auto text-xs font-bold text-primary">{favCount > 99 ? "99+" : favCount}</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                    {showAdmin && adminLinks.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Admin</DropdownMenuLabel>
                        {adminLinks.map(({ to, label, Icon }) => (
                          <DropdownMenuItem key={to} onClick={() => navigate(to)}>
                            <Icon className="w-4 h-4 mr-2" /> {label}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="w-4 h-4 mr-2" /> Sign out
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Sign in</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => navigate("/auth?method=google")}>
                      <Mail className="w-4 h-4 mr-2" /> Continue with Google
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/auth?method=wallet")} disabled={connecting}>
                      <Wallet className="w-4 h-4 mr-2" />
                      {connecting ? "Signing in…" : "Connect wallet"}
                    </DropdownMenuItem>


                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Explore</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => navigate("/browse")}>
                      <Store className="w-4 h-4 mr-2" /> Browse listings
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => navigate("/pricing")}>
                      <Tag className="w-4 h-4 mr-2" /> Pricing
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Link to="/post-ad">
              <Button size="sm" className="gap-2 font-semibold">
                <Plus className="w-4 h-4" />
                Post an Ad
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
            <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card px-4 py-4 space-y-4">
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

          {[
            {
              group: "Marketplace",
              links: [
                { to: "/", label: "Home" },
                { to: "/browse", label: "Browse" },
                
                { to: "/pricing", label: "Pricing" },
              ],
            },
            ...(signedIn
              ? [
                  { group: "Account", links: accountLinks.map((l) => ({ to: l.to, label: l.label })) },
                ]
              : []),

            ...(showAdmin && adminLinks.length > 0
              ? [{ group: "Admin", links: adminLinks.map((l) => ({ to: l.to, label: l.label })) }]
              : []),
          ].map(({ group, links }) => (
            <div key={group} className="space-y-1">
              <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </div>
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                    location.pathname === link.to ? "bg-accent text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}

          {signedIn ? (
            <Button variant="outline" size="sm" onClick={handleSignOut} className="w-full gap-2">
              <LogOut className="w-4 h-4" />
              {address ? `Sign out (${short})` : `Sign out (${handle})`}
            </Button>
          ) : (
            <div className="space-y-2">
              <Button
                size="sm"
                onClick={() => {
                  setMobileOpen(false);
                  navigate("/auth?method=google");
                }}
                className="w-full gap-2"
              >
                <Mail className="w-4 h-4" />
                Continue with Google
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={connecting}
                onClick={() => {
                  setMobileOpen(false);
                  navigate("/auth?method=wallet");
                }}
                className="w-full gap-2"
              >
                <Wallet className="w-4 h-4" />
                {connecting ? "Signing in..." : "Connect wallet"}
              </Button>

            </div>
          )}

        </div>
      )}
    </nav>
  );
};

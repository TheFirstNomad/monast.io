import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { mockAds } from "@/lib/mockData";
import { Link } from "react-router-dom";
import { Plus, Package, ShoppingBag, MessageCircle, User, Settings } from "lucide-react";

const Dashboard = () => {
  const myAds = mockAds.slice(0, 3);

  const tabs = [
    { icon: Package, label: "My Ads", count: 3 },
    { icon: ShoppingBag, label: "Purchases", count: 1 },
    { icon: MessageCircle, label: "Messages", count: 5 },
    { icon: User, label: "Profile", count: 0 },
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* User header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold text-lg">U</span>
            </div>
            <div>
              <div className="font-semibold text-foreground">My Dashboard</div>
              <div className="text-sm text-muted-foreground">0x1a2B...eF12</div>
            </div>
          </div>
          <Link to="/post-ad">
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Post Ad
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {tabs.map((t) => (
            <button
              key={t.label}
              className="bg-card border border-border rounded-xl p-4 text-center hover:border-primary/50 transition-colors"
            >
              <t.icon className="w-5 h-5 text-primary mx-auto mb-1" />
              <div className="text-xs font-medium text-foreground">{t.label}</div>
              {t.count > 0 && (
                <div className="text-lg font-bold text-foreground">{t.count}</div>
              )}
            </button>
          ))}
        </div>

        {/* My Ads */}
        <h2 className="text-lg font-bold text-foreground mb-4">My Ads</h2>
        <div className="space-y-3">
          {myAds.map((ad) => (
            <Link
              key={ad.id}
              to={`/ad/${ad.id}`}
              className="flex items-center gap-4 bg-card border border-border rounded-xl p-3 hover:border-primary/50 transition-colors"
            >
              <img
                src={ad.images[0]}
                alt={ad.title}
                className="w-16 h-16 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{ad.title}</div>
                <div className="text-primary font-bold text-sm">{ad.price.toLocaleString()} USDC</div>
                <div className="text-xs text-muted-foreground">{ad.location}</div>
              </div>
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Active</span>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;

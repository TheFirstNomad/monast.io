import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MOCK_ESCROWS, EscrowStatus } from "@/lib/escrowTypes";
import { Plus, Search, Filter } from "lucide-react";

const statusColors: Record<EscrowStatus, string> = {
  open: "bg-accent text-accent-foreground",
  funded: "bg-primary/10 text-primary",
  released: "bg-success/10 text-success",
  disputed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const EscrowMarketplace = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EscrowStatus | "all">("all");

  const filtered = MOCK_ESCROWS.filter((e) => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Escrow Marketplace</h1>
            <p className="text-sm text-muted-foreground mt-1">Browse and create secure escrow agreements</p>
          </div>
          <Button asChild>
            <Link to="/escrows/create">
              <Plus className="w-4 h-4 mr-2" />
              Create Escrow
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search escrows..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(["all", "open", "funded", "released", "disputed", "cancelled"] as const).map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(s)}
                className="capitalize text-xs"
              >
                {s}
              </Button>
            ))}
          </div>
        </div>

        {/* Escrow List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              No escrows found matching your filters.
            </div>
          ) : (
            filtered.map((escrow) => (
              <Link
                key={escrow.id}
                to={`/escrows/${escrow.id}`}
                className="block bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{escrow.title}</h3>
                      <Badge className={`${statusColors[escrow.status]} capitalize text-xs`}>
                        {escrow.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{escrow.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Deadline: {escrow.deadline}</span>
                      <span>Created: {escrow.created_at}</span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-lg font-bold text-foreground">
                      {escrow.amount} {escrow.token}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">{escrow.role}</div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default EscrowMarketplace;

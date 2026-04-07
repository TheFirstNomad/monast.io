import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/hooks/useWallet";
import { MOCK_ESCROWS, EscrowStatus } from "@/lib/escrowTypes";
import { Plus, Wallet } from "lucide-react";

const statusColors: Record<EscrowStatus, string> = {
  open: "bg-accent text-accent-foreground",
  funded: "bg-primary/10 text-primary",
  released: "bg-success/10 text-success",
  disputed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const MyEscrows = () => {
  const { isConnected, connect } = useWallet();

  if (!isConnected) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Connect Your Wallet</h1>
          <p className="text-sm text-muted-foreground mb-6">Connect your wallet to view your escrows</p>
          <Button onClick={connect}>Connect Wallet</Button>
        </div>
      </Layout>
    );
  }

  const grouped = {
    active: MOCK_ESCROWS.filter((e) => ["open", "funded"].includes(e.status)),
    completed: MOCK_ESCROWS.filter((e) => e.status === "released"),
    other: MOCK_ESCROWS.filter((e) => ["disputed", "cancelled"].includes(e.status)),
  };

  const renderGroup = (title: string, escrows: typeof MOCK_ESCROWS) => {
    if (escrows.length === 0) return null;
    return (
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-3">{title}</h2>
        <div className="space-y-3">
          {escrows.map((escrow) => (
            <Link
              key={escrow.id}
              to={`/escrows/${escrow.id}`}
              className="block bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{escrow.title}</span>
                    <Badge className={`${statusColors[escrow.status]} capitalize text-xs`}>{escrow.status}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">Deadline: {escrow.deadline}</span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-foreground">{escrow.amount} {escrow.token}</div>
                  <div className="text-xs text-muted-foreground capitalize">{escrow.role}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-foreground">My Escrows</h1>
          <Button asChild size="sm">
            <Link to="/escrows/create">
              <Plus className="w-4 h-4 mr-2" />
              New Escrow
            </Link>
          </Button>
        </div>
        {renderGroup("Active", grouped.active)}
        {renderGroup("Completed", grouped.completed)}
        {renderGroup("Disputed / Cancelled", grouped.other)}
      </div>
    </Layout>
  );
};

export default MyEscrows;

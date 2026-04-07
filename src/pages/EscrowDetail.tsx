import { useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MOCK_ESCROWS, EscrowStatus } from "@/lib/escrowTypes";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "sonner";
import { CheckCircle2, Clock, AlertTriangle, XCircle, DollarSign } from "lucide-react";

const statusColors: Record<EscrowStatus, string> = {
  open: "bg-accent text-accent-foreground",
  funded: "bg-primary/10 text-primary",
  released: "bg-success/10 text-success",
  disputed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const timelineSteps = [
  { status: "open", label: "Created", icon: Clock },
  { status: "funded", label: "Funded", icon: DollarSign },
  { status: "released", label: "Released", icon: CheckCircle2 },
];

const EscrowDetail = () => {
  const { id } = useParams();
  const { isConnected, connect } = useWallet();
  const escrow = MOCK_ESCROWS.find((e) => e.id === id);

  if (!escrow) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center text-muted-foreground">
          Escrow not found.
        </div>
      </Layout>
    );
  }

  const statusIndex = timelineSteps.findIndex((s) => s.status === escrow.status);

  const action = (label: string) => {
    if (!isConnected) { connect(); return; }
    toast.success(`${label} action triggered`);
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{escrow.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">{escrow.description}</p>
            </div>
            <Badge className={`${statusColors[escrow.status]} capitalize text-sm`}>
              {escrow.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Amount</span>
              <div className="font-semibold text-foreground">{escrow.amount} {escrow.token}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Role</span>
              <div className="font-semibold text-foreground capitalize">{escrow.role}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Creator</span>
              <div className="font-mono text-xs text-foreground">{escrow.creator}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Counterparty</span>
              <div className="font-mono text-xs text-foreground">{escrow.counterparty}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Deadline</span>
              <div className="font-semibold text-foreground">{escrow.deadline}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Created</span>
              <div className="font-semibold text-foreground">{escrow.created_at}</div>
            </div>
          </div>

          {escrow.conditions && (
            <div className="mt-4 pt-4 border-t border-border">
              <span className="text-sm text-muted-foreground">Conditions</span>
              <p className="text-sm text-foreground mt-1">{escrow.conditions}</p>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Status Timeline</h2>
          <div className="flex items-center justify-between">
            {timelineSteps.map((step, i) => {
              const active = i <= statusIndex && escrow.status !== "cancelled" && escrow.status !== "disputed";
              return (
                <div key={step.status} className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <step.icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs mt-2 ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {step.label}
                  </span>
                  {i < timelineSteps.length - 1 && (
                    <div className={`absolute h-0.5 w-16 ${active ? "bg-primary" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => action("Fund Escrow")} disabled={escrow.status !== "open"}>
              <DollarSign className="w-4 h-4 mr-2" />
              Fund Escrow
            </Button>
            <Button onClick={() => action("Release Funds")} variant="outline" disabled={escrow.status !== "funded"}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Release Funds
            </Button>
            <Button onClick={() => action("Raise Dispute")} variant="outline" disabled={escrow.status !== "funded"}>
              <AlertTriangle className="w-4 h-4 mr-2" />
              Raise Dispute
            </Button>
            <Button onClick={() => action("Cancel")} variant="outline" disabled={escrow.status !== "open"}>
              <XCircle className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default EscrowDetail;

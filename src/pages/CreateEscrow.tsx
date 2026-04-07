import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "sonner";

const TOKENS = ["USDC", "USDT", "ETH", "DAI", "WBTC"];

const CreateEscrow = () => {
  const { isConnected, connect } = useWallet();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    amount: "",
    token: "USDC",
    role: "buyer" as "buyer" | "seller",
    counterparty: "",
    conditions: "",
    deadline: "",
  });

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      connect();
      return;
    }
    toast.success("Escrow created successfully!");
    navigate("/escrows");
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-foreground mb-2">Create New Escrow</h1>
        <p className="text-sm text-muted-foreground mb-8">Set up a secure escrow agreement with your counterparty</p>

        <form onSubmit={submit} className="space-y-6 bg-card border border-border rounded-2xl p-6">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input placeholder="e.g. Website Development" value={form.title} onChange={(e) => update("title", e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea placeholder="Describe the agreement..." value={form.description} onChange={(e) => update("description", e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" placeholder="0.00" value={form.amount} onChange={(e) => update("amount", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Token</Label>
              <select
                value={form.token}
                onChange={(e) => update("token", e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {TOKENS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>I am the...</Label>
            <div className="flex gap-2">
              {(["buyer", "seller"] as const).map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant={form.role === r ? "default" : "outline"}
                  onClick={() => update("role", r)}
                  className="flex-1 capitalize"
                >
                  {r}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Counterparty Wallet Address</Label>
            <Input placeholder="0x..." value={form.counterparty} onChange={(e) => update("counterparty", e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Conditions / Milestones</Label>
            <Textarea placeholder="List the conditions that must be met..." value={form.conditions} onChange={(e) => update("conditions", e.target.value)} rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Deadline</Label>
            <Input type="date" value={form.deadline} onChange={(e) => update("deadline", e.target.value)} required />
          </div>

          <Button type="submit" className="w-full py-6 text-base font-semibold">
            {isConnected ? "Create Escrow" : "Connect Wallet to Create"}
          </Button>
        </form>
      </div>
    </Layout>
  );
};

export default CreateEscrow;

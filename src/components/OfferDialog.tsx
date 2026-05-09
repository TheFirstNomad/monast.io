import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  adId: string;
  listPrice: number;
}

export const OfferDialog = ({ open, onOpenChange, adId, listPrice }: Props) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState(String(listPrice));
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user) { toast.error("Sign in to make an offer"); return; }
    const n = Number(amount);
    if (!n || n <= 0) { toast.error("Enter valid amount"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("offers").insert({ ad_id: adId, buyer_id: user.id, amount_usdc: n });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else { toast.success("Offer sent"); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Make an Offer</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">Listed at {listPrice.toLocaleString()} USDC</div>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Your offer in USDC" />
          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? "Sending..." : "Send Offer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

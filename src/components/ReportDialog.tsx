import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Flag, Loader2 } from "lucide-react";

export type ReportTarget = "ad" | "profile" | "escrow";

const REASONS: Record<ReportTarget, string[]> = {
  ad: ["Scam or fraud", "Prohibited item", "Counterfeit", "Wrong category", "Spam", "Offensive content"],
  profile: ["Scam or fraud", "Impersonation", "Harassment", "Spam"],
  escrow: ["Item not received", "Item not as described", "Counterparty unresponsive", "Suspected fraud"],
};

interface Props {
  targetType: ReportTarget;
  targetId: string;
  className?: string;
  variant?: "ghost" | "outline";
  label?: string;
}

/** Lets any signed-in user flag a listing, profile or escrow for moderation. */
export const ReportDialog = ({
  targetType,
  targetId,
  className,
  variant = "ghost",
  label = "Report",
}: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[targetType][0]);
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return toast.error("Sign in to report");
    setSaving(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details.trim() ? details.trim().slice(0, 2000) : null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Report submitted. Our moderators will review it.");
    setDetails("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm" className={className}>
          <Flag className="h-4 w-4 mr-1.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this {targetType}</DialogTitle>
          <DialogDescription>
            Reports are reviewed by moderators. Abuse of reporting may cost you access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS[targetType].map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Details (optional)</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Anything that helps us review this faster"
              rows={4}
              maxLength={2000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !user}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

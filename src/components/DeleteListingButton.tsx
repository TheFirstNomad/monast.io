import { useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

/** Storage path inside the ad-photos bucket for a public photo URL. */
function photoPath(url: string): string | null {
  const marker = "/ad-photos/";
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

/**
 * Permanently deletes one of the owner's listings. The server refuses while an
 * escrow is in progress, and archives (instead of erasing) listings that have
 * trade history so buyers keep their purchase records.
 */
export const DeleteListingButton = ({
  adId,
  images,
  openEscrowId,
  size = "default",
  onDeleted,
}: {
  adId: string;
  images?: string[] | null;
  openEscrowId?: string | null;
  size?: "default" | "sm";
  onDeleted: () => void;
}) => {
  const [busy, setBusy] = useState(false);
  const full = size === "default";

  if (openEscrowId) {
    return (
      <Link to={`/escrow/${openEscrowId}`} className={full ? "block" : ""} title="Escrow in progress">
        <Button
          type="button"
          size={size}
          variant="outline"
          disabled={!full}
          className={full ? "w-full gap-2 py-5" : "gap-1"}
        >
          <LockKeyhole className="w-3.5 h-3.5" />
          {full ? "Escrow in progress - can't delete" : "Locked"}
        </Button>
      </Link>
    );
  }

  const remove = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("owner_delete_ad", { _ad_id: adId });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data === "deleted") {
      const paths = (images ?? []).map(photoPath).filter((p): p is string => !!p);
      if (paths.length) await supabase.storage.from("ad-photos").remove(paths).catch(() => null);
      toast.success("Listing deleted");
    } else {
      toast.success("Listing deleted. Its escrow records are kept for both sides.");
    }
    onDeleted();
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size={size}
          variant="outline"
          disabled={busy}
          className={
            (full ? "w-full gap-2 py-5 " : "gap-1 ") +
            "border-destructive/40 text-destructive hover:bg-destructive/5"
          }
        >
          <Trash2 className="w-3.5 h-3.5" />
          {busy ? "Deleting..." : "Delete"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
          <AlertDialogDescription>
            This can't be undone. The listing, its photos, offers and chats about it are removed for good.
            Any listing fee already paid is not refunded.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            onClick={remove}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SwapPanel } from "@/components/SwapPanel";

export const SwapDialog = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Swap on Arc</DialogTitle>
        </DialogHeader>
        <SwapPanel compact />
      </DialogContent>
    </Dialog>
  );
};

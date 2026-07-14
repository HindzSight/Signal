import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { Share } from "@/lib/types";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function StopShareDialog({
  share,
  onOpenChange,
}: {
  share: Share | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [stopping, setStopping] = useState(false);

  async function confirm() {
    if (!share) return;
    setStopping(true);
    try {
      await api.stopShare(share.id);
      toast.success("Channel closed", {
        description: "The public link is dead. Downloads were cut off.",
      });
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setStopping(false);
    }
  }

  return (
    <Dialog open={!!share} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="grid size-11 place-items-center rounded-full border border-destructive/30 bg-destructive/12 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <DialogTitle>Close this channel?</DialogTitle>
          <DialogDescription>
            The link for <span className="font-mono text-foreground/90">{share?.name}</span>{" "}
            stops working immediately and any active downloads are interrupted. This
            can't be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Keep sharing</Button>
          </DialogClose>
          <Button variant="destructive" onClick={confirm} disabled={stopping}>
            {stopping && <Loader2 className="size-4 animate-spin" />}
            {stopping ? "Closing…" : "Close channel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

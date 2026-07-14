import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Copy, Check, Square, FolderOpen, Clock, Radio } from "lucide-react";
import type { Share } from "@/lib/types";
import { formatExpiry } from "@/lib/format";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransferMeter } from "./TransferMeter";

export function ShareCard({
  share,
  onRequestStop,
}: {
  share: Share;
  onRequestStop: (share: Share) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const pending = !share.url;
  const activeTransfers = share.transfers.filter((t) => t.status === "active").length;

  async function copyCredentials() {
    setCopying(true);
    try {
      const { url, passcode } = await api.credentials(share.id);
      await navigator.clipboard.writeText(`${url}\nPasscode: ${passcode}`);
      setCopied(true);
      toast.success("Channel link + passcode copied", {
        description: "Send the passcode separately for best security.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setCopying(false);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
    >
      <Card className="overflow-hidden p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
              <FolderOpen className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-[17px] font-semibold" title={share.name}>
                {share.name}
              </h3>
              <div className="mt-1 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <Clock className="size-3" />
                <span>expires in {formatExpiry(share.expiresAt)}</span>
              </div>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onRequestStop(share)}
            className="shrink-0"
          >
            <Square className="size-3 fill-current" />
            Stop
          </Button>
        </div>

        {/* Link readout */}
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background/50 p-1.5 pl-3">
          {pending ? (
            <span className="flex items-center gap-2 py-1.5 font-mono text-xs text-muted-foreground">
              <Radio className="size-3.5 animate-pulse text-primary" />
              establishing secure channel…
            </span>
          ) : (
            <code className="flex-1 truncate py-1.5 font-mono text-xs text-foreground/85">
              {share.url}
            </code>
          )}
          <Button
            variant={copied ? "default" : "signal"}
            size="sm"
            disabled={pending || copying}
            onClick={copyCredentials}
            className="shrink-0"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>

        {/* Telemetry */}
        <div className="mt-4 border-t border-border/70 pt-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold tracking-[0.14em] text-muted-foreground">
              DOWNLOAD TELEMETRY
            </span>
            <Badge variant={activeTransfers ? "signal" : "muted"}>
              {activeTransfers > 0 && (
                <span className="pulse-dot inline-block size-1.5 rounded-full bg-current" />
              )}
              {share.transfers.length} transfer{share.transfers.length === 1 ? "" : "s"}
            </Badge>
          </div>

          {share.transfers.length ? (
            <div className="flex flex-col gap-2">
              <AnimatePresence mode="popLayout">
                {share.transfers.map((transfer) => (
                  <TransferMeter key={transfer.id} transfer={transfer} />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border bg-background/30 px-4 py-5 text-sm text-muted-foreground">
              <Radio className="size-4 opacity-60" />
              Standing by — no downloads yet on the recipient's side.
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

import { motion } from "motion/react";
import { BeaconMark } from "./BeaconMark";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CONNECTION_LABEL = {
  connecting: "linking…",
  live: "transmitter online",
  reconnecting: "reconnecting…",
} as const;

export function Header({
  connection,
  cloudflared,
}: {
  connection: "connecting" | "live" | "reconnecting";
  cloudflared: boolean | null;
}) {
  const online = connection === "live";

  return (
    <motion.header
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 130, damping: 18 }}
      className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center"
    >
      <div className="flex items-center gap-4">
        <BeaconMark className="size-12" />
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
            Local Secure Transfer
          </p>
          <h1 className="mt-0.5 text-3xl font-bold leading-none sm:text-[34px]">
            Signal
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Beam a folder straight from this machine - no uploads, no middle-man.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={online ? "online" : "muted"}>
          <span
            className={cn(
              "inline-block size-2 rounded-full",
              online ? "bg-online pulse-dot" : "bg-muted-foreground"
            )}
          />
          {CONNECTION_LABEL[connection]}
        </Badge>
        <Badge variant={cloudflared === false ? "muted" : "default"}>
          <span
            className={cn(
              "inline-block size-2 rounded-full",
              cloudflared === false ? "bg-destructive" : "bg-online"
            )}
          />
          cloudflared {cloudflared === false ? "missing" : "ready"}
        </Badge>
      </div>
    </motion.header>
  );
}

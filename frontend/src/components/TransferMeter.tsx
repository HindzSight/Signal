import { motion } from "motion/react";
import { CheckCircle2, XCircle, ArrowDownToLine } from "lucide-react";
import type { Transfer } from "@/lib/types";
import { formatBytes } from "@/lib/format";
import { AnimatedBytes } from "./AnimatedNumber";
import { cn } from "@/lib/utils";

const META = {
  active: { label: "RECEIVING", Icon: ArrowDownToLine, tone: "text-primary" },
  completed: { label: "DELIVERED", Icon: CheckCircle2, tone: "text-online" },
  cancelled: { label: "DROPPED", Icon: XCircle, tone: "text-muted-foreground" },
} as const;

export function TransferMeter({ transfer }: { transfer: Transfer }) {
  const meta = META[transfer.status];
  const active = transfer.status === "active";
  const { Icon } = meta;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border/70 bg-background/40 px-3.5 py-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon className={cn("size-4 shrink-0", meta.tone)} />
          <span className="truncate font-mono text-[13px] text-foreground/90">
            {transfer.file}
          </span>
        </div>
        <span
          className={cn(
            "shrink-0 font-mono text-[10px] font-semibold tracking-[0.14em]",
            meta.tone
          )}
        >
          {meta.label}
        </span>
      </div>

      {/* Signal meter */}
      <div className="mt-2.5 flex items-center gap-3">
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
          <motion.div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full",
              active ? "meter-sweep" : ""
            )}
            style={{
              background:
                transfer.status === "cancelled"
                  ? "var(--muted-foreground)"
                  : transfer.status === "completed"
                    ? "var(--online)"
                    : "linear-gradient(90deg, var(--signal), var(--signal-glow))",
            }}
            initial={false}
            animate={{ width: `${transfer.percent}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
          />
        </div>
        <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-foreground/80">
          {transfer.percent}%
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span className="tabular-nums">
          <AnimatedBytes value={transfer.bytesSent} format={formatBytes} />
          <span className="opacity-50"> / {formatBytes(transfer.size)}</span>
        </span>
        <span className="tabular-nums">
          {active ? `${formatBytes(transfer.speed)}/s` : "-"}
        </span>
      </div>
    </motion.div>
  );
}

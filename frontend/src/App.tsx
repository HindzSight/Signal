import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, Radar } from "lucide-react";
import { api } from "@/lib/api";
import { useShares } from "@/hooks/useShares";
import type { Share } from "@/lib/types";
import { Header } from "@/components/Header";
import { CreateSharePanel } from "@/components/CreateSharePanel";
import { ShareCard } from "@/components/ShareCard";
import { StopShareDialog } from "@/components/StopShareDialog";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  const { shares, connection } = useShares();
  const [cloudflared, setCloudflared] = useState<boolean | null>(null);
  const [stopTarget, setStopTarget] = useState<Share | null>(null);

  useEffect(() => {
    api
      .health()
      .then((h) => setCloudflared(h.cloudflared))
      .catch(() => setCloudflared(null));
  }, []);

  return (
    <div className="grain relative min-h-screen">
      <div className="grid-field" />
      <div className="beacon-glow" />

      <main className="relative z-[2] mx-auto flex max-w-4xl flex-col gap-8 px-5 py-14 sm:px-8 sm:py-20">
        <Header connection={connection} cloudflared={cloudflared} />

        <AnimatePresence>
          {cloudflared === false && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                <span className="font-semibold">cloudflared isn't installed.</span>{" "}
                Install it from{" "}
                <a
                  className="underline underline-offset-2"
                  href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Cloudflare downloads
                </a>
                , then restart the dashboard.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <CreateSharePanel />

        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold">Active channels</h2>
              <p className="text-sm text-muted-foreground">
                Live links and download telemetry from the far side.
              </p>
            </div>
            <Badge variant={shares.length ? "signal" : "muted"}>
              {shares.length} open
            </Badge>
          </div>

          {shares.length ? (
            <div className="flex flex-col gap-4">
              <AnimatePresence mode="popLayout">
                {shares.map((share) => (
                  <ShareCard
                    key={share.id}
                    share={share}
                    onRequestStop={setStopTarget}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid place-items-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center"
            >
              <div className="grid size-12 place-items-center rounded-full border border-border bg-background/60 text-muted-foreground">
                <Radar className="size-5" />
              </div>
              <div>
                <p className="font-display text-lg font-semibold">No open channels</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Open a secure channel above to start beaming files across the globe.
                </p>
              </div>
            </motion.div>
          )}
        </section>

        <footer className="pt-2 text-center font-mono text-[11px] tracking-wide text-muted-foreground/70">
          SIGNAL · files stream directly from this machine over Cloudflare Quick Tunnels
        </footer>
      </main>

      <StopShareDialog share={stopTarget} onOpenChange={(o) => !o && setStopTarget(null)} />
      <Toaster />
    </div>
  );
}

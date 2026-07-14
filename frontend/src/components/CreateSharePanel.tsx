import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { FolderSearch, Loader2, Send, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EXPIRY_OPTIONS = [
  { value: "24", label: "24 hours" },
  { value: "1", label: "1 hour" },
  { value: "6", label: "6 hours" },
  { value: "72", label: "3 days" },
  { value: "168", label: "7 days" },
];

export function CreateSharePanel() {
  const [folder, setFolder] = useState("");
  const [hours, setHours] = useState("24");
  const [browsing, setBrowsing] = useState(false);
  const [creating, setCreating] = useState(false);

  async function browse() {
    setBrowsing(true);
    try {
      const { folderPath } = await api.selectFolder();
      if (folderPath) setFolder(folderPath);
      else toast.info("No folder selected.");
    } catch (error) {
      toast.error("Folder picker unavailable", {
        description: (error as Error).message + " — you can also paste a path.",
      });
    } finally {
      setBrowsing(false);
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!folder.trim()) {
      toast.error("Choose a folder to transmit first.");
      return;
    }
    setCreating(true);
    try {
      const result = await api.createShare(folder.trim(), Number(hours));
      await navigator.clipboard.writeText(
        `${result.share.url}\nPasscode: ${result.passcode}`
      );
      toast.success("Secure channel open", {
        description: "Link + passcode copied. Send the passcode separately.",
      });
      setFolder("");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, type: "spring", stiffness: 140, damping: 20 }}
    >
      <Card className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold">New transmission</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Point at a folder and we open a temporary, passcode-locked Cloudflare
              channel.
            </p>
          </div>
          <Badge variant="signal" className="hidden sm:flex">
            <ShieldCheck className="size-3" />
            end-to-recipient
          </Badge>
        </div>

        <form onSubmit={create} className="mt-6 flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-[1fr_190px]">
            <label className="flex flex-col gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Folder
              </span>
              <div className="flex gap-2">
                <Input
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  placeholder="C:\Users\you\Photos"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="default"
                  onClick={browse}
                  disabled={browsing}
                  className="shrink-0"
                >
                  {browsing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FolderSearch className="size-4" />
                  )}
                  Browse
                </Button>
              </div>
            </label>

            <label className="flex flex-col gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Auto-close
              </span>
              <Select value={hours} onValueChange={setHours}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="flex flex-col items-start justify-between gap-4 border-t border-border/70 pt-5 sm:flex-row sm:items-center">
            <p className="text-sm text-muted-foreground">
              Files never leave this computer. Close the channel anytime.
            </p>
            <Button
              type="submit"
              variant="signal"
              size="lg"
              disabled={creating}
              className="w-full sm:w-auto"
            >
              {creating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {creating ? "Opening channel…" : "Open secure channel"}
            </Button>
          </div>
        </form>
      </Card>
    </motion.div>
  );
}

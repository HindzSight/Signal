import { useEffect, useRef, useState } from "react";
import type { Share } from "@/lib/types";

type Connection = "connecting" | "live" | "reconnecting";

/**
 * Live view of every active share. The backend pushes a full snapshot over an
 * SSE stream on any change (new share, download progress, stop). We mirror that
 * snapshot into state so the whole dashboard reacts in real time.
 */
export function useShares() {
  const [shares, setShares] = useState<Share[]>([]);
  const [connection, setConnection] = useState<Connection>("connecting");
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/events");
    sourceRef.current = source;

    source.onmessage = (event) => {
      try {
        setShares(JSON.parse(event.data) as Share[]);
        setConnection("live");
      } catch {
        /* ignore malformed frame */
      }
    };
    source.onopen = () => setConnection("live");
    source.onerror = () => setConnection("reconnecting");

    return () => source.close();
  }, []);

  return { shares, connection };
}

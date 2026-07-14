import { cn } from "@/lib/utils";

/**
 * The SIGNAL beacon: a core that emits three broadcast arcs, each fading and
 * expanding on a stagger - a folder transmitting across the ocean.
 */
export function BeaconMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-grid place-items-center", className)}>
      <svg viewBox="0 0 48 48" className="size-full" aria-hidden>
        <defs>
          <radialGradient id="beacon-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--signal-glow)" />
            <stop offset="100%" stopColor="var(--signal)" />
          </radialGradient>
        </defs>
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx="24"
            cy="24"
            r={9 + i * 6.5}
            fill="none"
            stroke="var(--signal)"
            strokeWidth="1.75"
            strokeLinecap="round"
            style={{
              opacity: 0,
              transformOrigin: "center",
              animation: `beacon-emit 2.6s ${i * 0.45}s cubic-bezier(0.2,0.6,0.3,1) infinite`,
            }}
          />
        ))}
        <circle cx="24" cy="24" r="5.5" fill="url(#beacon-core)" />
      </svg>
      <style>{`
        @keyframes beacon-emit {
          0%   { opacity: 0; transform: scale(0.5); }
          35%  { opacity: 0.9; }
          100% { opacity: 0; transform: scale(1.15); }
        }
      `}</style>
    </span>
  );
}

import { useEffect, useRef, useState } from "react";

/** Eases a number toward its target with requestAnimationFrame - a telemetry ticker. */
export function useAnimatedNumber(target: number, duration = 500) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    startRef.current = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const value = from + (target - from) * eased;
      setDisplay(value);
      fromRef.current = value;
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return display;
}

export function AnimatedBytes({
  value,
  format,
}: {
  value: number;
  format: (n: number) => string;
}) {
  const animated = useAnimatedNumber(value);
  return <>{format(animated)}</>;
}

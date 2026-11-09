"use client";

import { useEffect, useRef } from "react";

/**
 * Thin bar showing how far the reader is through `targetId`. Writes to a ref
 * inside requestAnimationFrame so scrolling never triggers React re-renders.
 */
export function ReadingProgress({ targetId }: { targetId: string }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = document.getElementById(targetId);
    const bar = barRef.current;
    if (!target || !bar) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = target.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const progress = total <= 0 ? (rect.top <= 0 ? 1 : 0) : Math.min(1, Math.max(0, -rect.top / total));
      bar.style.transform = `scaleX(${progress})`;
      bar.parentElement?.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [targetId]);

  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      className="fixed inset-x-0 top-0 z-50 h-0.5"
    >
      <div ref={barRef} className="h-full origin-left scale-x-0 bg-brand" />
    </div>
  );
}

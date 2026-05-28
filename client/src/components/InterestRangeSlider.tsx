import { useCallback, useEffect, useRef, useState } from "react";

interface InterestRangeSliderProps {
  lower: number;
  upper: number;
  min: number;
  max: number;
  onLowerChange: (value: number) => void;
  onUpperChange: (value: number) => void;
}

const formatLabel = (lower: number, upper: number, min: number, max: number) =>
  lower === min && upper === max ? "All" : `${lower}/${max} - ${upper}/${max}`;

export const InterestRangeSlider = ({
  lower,
  upper,
  min,
  max,
  onLowerChange,
  onUpperChange,
}: InterestRangeSliderProps) => {
  const [activeHandle, setActiveHandle] = useState<"lower" | "upper" | null>(
    null,
  );
  const trackRef = useRef<HTMLDivElement | null>(null);

  const setValueFromClientX = useCallback(
    (clientX: number, handle: "lower" | "upper") => {
      const track = trackRef.current;
      if (!track) {
        return;
      }

      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const nextValue = min + Math.round(ratio * (max - min));

      if (handle === "lower") {
        onLowerChange(Math.min(nextValue, upper));
      } else {
        onUpperChange(Math.max(nextValue, lower));
      }
    },
    [lower, upper, min, max, onLowerChange, onUpperChange],
  );

  useEffect(() => {
    if (!activeHandle) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      setValueFromClientX(event.clientX, activeHandle);
    };

    const handlePointerUp = () => {
      setActiveHandle(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activeHandle, setValueFromClientX]);

  return (
    <label className="grid gap-2">
      <span className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-deco-muted">
        <span>Interest</span>
        <span className="text-xs tracking-[0.12em] text-primary-gold">
          {formatLabel(lower, upper, min, max)}
        </span>
      </span>
      <div className="deco-frame h-10 border-border-gold-muted bg-deco-surface px-3 py-2">
        <div
          ref={trackRef}
          className="relative h-6 select-none"
          onPointerDown={(event) => {
            const rect = trackRef.current?.getBoundingClientRect();
            if (!rect) {
              return;
            }

            const ratio = Math.min(
              1,
              Math.max(0, (event.clientX - rect.left) / rect.width),
            );
            const nextValue = min + Math.round(ratio * (max - min));
            const nextHandle =
              Math.abs(nextValue - lower) <= Math.abs(nextValue - upper)
                ? "lower"
                : "upper";

            setActiveHandle(nextHandle);
            setValueFromClientX(event.clientX, nextHandle);
          }}
        >
          <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-deco-card" />
          <div
            className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-primary-gold"
            style={{
              left: `${((lower - min) / (max - min)) * 100}%`,
              right: `${((max - upper) / (max - min)) * 100}%`,
            }}
          />
          <button
            aria-label="Interest lower limit"
            className={`absolute top-1/2 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-deco-bg bg-primary-gold shadow-sm transition-transform ${
              activeHandle === "lower" ? "scale-110" : ""
            }`}
            onPointerDown={(event) => {
              event.stopPropagation();
              setActiveHandle("lower");
            }}
            style={{
              left: `${((lower - min) / (max - min)) * 100}%`,
            }}
            type="button"
          />
          <button
            aria-label="Interest upper limit"
            className={`absolute top-1/2 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-deco-bg bg-primary-gold shadow-sm transition-transform ${
              activeHandle === "upper" ? "scale-110" : ""
            }`}
            onPointerDown={(event) => {
              event.stopPropagation();
              setActiveHandle("upper");
            }}
            style={{
              left: `${((upper - min) / (max - min)) * 100}%`,
            }}
            type="button"
          />
        </div>
      </div>
    </label>
  );
};

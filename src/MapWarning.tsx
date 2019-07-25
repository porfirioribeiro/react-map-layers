import React, { useCallback, useState, useRef } from "react";

import styles from "./MapWarning.module.css";

interface MapWarningProps {
  showWarning?: any;
  warningType?: any;
  twoFingerDragWarning?: string;
  metaWheelZoomWarning?: string;
}

const isMac =
  window.navigator &&
  window.navigator.platform.toUpperCase().indexOf("MAC") >= 0;

type WarningType = "wheel" | "fingers" | false;

export function MapWarning({
  warningType,
  twoFingerDragWarning = "Use two fingers to move the map",
  metaWheelZoomWarning = "Use META+wheel to zoom!"
}: MapWarningProps) {
  const [warning, setWarning] = useState<WarningType>(false);
  const tref = useRef<number>();
  console.log("render, info");

  const meta = typeof window !== "undefined" && isMac ? "⌘" : "⊞";
  const warningText =
    warningType === "fingers" ? twoFingerDragWarning : metaWheelZoomWarning;

  const ref = useCallback((el: HTMLDivElement) => {
    function showWarning(warningType: WarningType) {
      setWarning(warningType);
      if (tref.current) window.clearTimeout(tref.current);
      tref.current = window.setTimeout(setWarning, 300, false);
    }
    function wheel(e: WheelEvent) {
      if (!e.ctrlKey) {
        showWarning("wheel");
      }
    }
    let touched: boolean;
    function touch(this: HTMLDivElement, ev: TouchEvent) {
      if (ev.touches.length === 1) {
        ev.stopImmediatePropagation();
        if (ev.type === "touchstart") touched = true;
        if (ev.type === "touchmove" && touched) showWarning("fingers");
      }
      if (ev.type === "touchend") setWarning((touched = false));
    }
    el.addEventListener("touchstart", touch, { passive: false });
    el.addEventListener("touchmove", touch, { passive: false });
    el.addEventListener("touchend", touch, { passive: false });
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      if (tref.current) window.clearTimeout(tref.current);
      el.removeEventListener("wheel", wheel);
    };
  }, []);

  return (
    <div
      className={styles.root}
      style={{ opacity: warning ? 100 : 0 }}
      ref={ref}
    >
      {warningText.replace("META", meta)}
    </div>
  );
}

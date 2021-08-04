import React from "react";

import styles from "./MapWarning.module.css";

interface MapWarningProps {
  showWarning: any;
  warningType: any;
  twoFingerDragWarning: string;
  metaWheelZoomWarning: string;
}

export function MapWarning({
  showWarning,
  warningType,
  twoFingerDragWarning,
  metaWheelZoomWarning
}: MapWarningProps) {
  const meta =
    typeof window !== "undefined" &&
    window.navigator &&
    window.navigator.platform.toUpperCase().indexOf("MAC") >= 0
      ? "⌘"
      : "⊞";
  const warningText =
    warningType === "fingers" ? twoFingerDragWarning : metaWheelZoomWarning;
  return (
    <div className={styles.root} style={{ opacity: showWarning ? 100 : 0 }}>
      {warningText.replace("META", meta)}
    </div>
  );
}

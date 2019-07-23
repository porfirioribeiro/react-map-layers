import React from "react";
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
  const style = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    pointerEvents: "none",
    opacity: showWarning ? 100 : 0,
    transition: "opacity 300ms",
    background: "rgba(0,0,0,0.5)",
    color: "#fff",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: 22,
    fontFamily: '"Arial", sans-serif',
    textAlign: "center",
    zIndex: 1
  };
  const meta =
    typeof window !== "undefined" &&
    window.navigator &&
    window.navigator.platform.toUpperCase().indexOf("MAC") >= 0
      ? "⌘"
      : "⊞";
  const warningText =
    warningType === "fingers" ? twoFingerDragWarning : metaWheelZoomWarning;
  return <div style={style}>{warningText.replace("META", meta)}</div>;
}

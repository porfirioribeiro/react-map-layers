import React, { useContext } from "react";
import { MapContext } from "./context";
import { TPoint } from "./types";

interface MarkerProps {
  anchor: TPoint;
}

export function Marker(p: MarkerProps) {
  const map = useContext(MapContext);

  const [left, top] = map.latLngToPixel(p.anchor);

  function handleDragStart(e: React.DragEvent<HTMLImageElement>) {
    console.log(e.type, e.pageX, e.movementX, e.screenX);
    // e.preventDefault();
    e.currentTarget.style.opacity = ".5";
    e.dataTransfer.setDragImage(new Image(), 200, 0);
    e.dataTransfer.setData("text", "marker");
  }

  return top > -10 && left > -10 ? (
    <img
      alt=""
      title="Marker"
      src="https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2.png"
      onDragStart={handleDragStart}
      // onDrag={handleDragStart}
      // onDragEnd={handleDragStart}
      className="pigeon-drag-block"
      style={{
        position: "absolute",
        left,
        top,
        transform: "translate(-50%, -100%)",
        cursor: "pointer"
      }}
    />
  ) : null;
}

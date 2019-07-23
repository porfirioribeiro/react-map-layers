import React, { useContext } from "react";
import { MapContext } from "./context";
import { TPoint } from "./types";

interface PolygonProps {
  coords: TPoint[];
}

export function Polygon({ coords }: PolygonProps) {
  const map = useContext(MapContext);

  const d = coords
    .map((ll, i) => `${i ? "L" : "M"} ${map.latLngToPixel(ll).join()}`)
    .join(" ");

  return (
    <path
      d={d}
      fill="blue"
      fillOpacity="0.5"
      stroke="blue"
      strokeWidth="2"
      onClick={() => console.log("click")}
    />
  );
}

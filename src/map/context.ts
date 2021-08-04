import React from "react";
import { TLatLng } from "./types";
export interface MapState {
  width: number;
  height: number;
  center: TLatLng;
  zoom: number;
}

export const MapContext = React.createContext({} as MapState);

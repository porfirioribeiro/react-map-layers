import { MapState } from "./context";

export type TPoint = [number, number];
export type TLatLng = [number, number];
export type TMinMax = [number, number, number, number];

export type MapStateUpdater = (state: Partial<MapState>) => void;
export type MapDeltaUpdater = (dp: TPoint, dz: number) => void;

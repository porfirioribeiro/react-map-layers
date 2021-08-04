import { TPoint, TLatLng } from "../types";

export function project(latlng: TLatLng, zoom: number): TPoint {
  const projectedPoint = SphericalMercator.project(latlng);
  const scale = SphericalMercator.scale(zoom);
  return SphericalMercator.transform(projectedPoint, scale);
}

export function unproject(point: TPoint, zoom: number): TLatLng {
  const scale = SphericalMercator.scale(zoom);
  const untransformedPoint = SphericalMercator.untransform(point, scale);
  return SphericalMercator.unproject(untransformedPoint);
}

function getPixelOrigin(
  center: TLatLng,
  zoom: number,
  width: number,
  height: number
): TPoint {
  const point = project(center, zoom);
  return [point[0] - width / 2, point[1] - height / 2];
}

// @method latLngToPoint(point: Point): LatLng
// Given a pixel coordinate relative to the [origin pixel](#map-getpixelorigin),
// returns the corresponding geographical coordinate (for the current zoom level).
export function pointToLatLng(
  point: TPoint,
  center: TLatLng,
  zoom: number,
  width: number,
  height: number
): TLatLng {
  const origin = getPixelOrigin(center, zoom, width, height);
  return unproject([origin[0] + point[0], origin[1] + point[1]], zoom);
}

// @method pointToLatLng(latlng: LatLng): Point
// Given a geographical coordinate, returns the corresponding pixel coordinate
// relative to the [origin pixel](#map-getpixelorigin).
export function latLngToPoint(
  latlng: TLatLng,
  center: TLatLng,
  zoom: number,
  width: number,
  height: number
): TPoint {
  const origin = getPixelOrigin(center, zoom, width, height);
  var projectedPoint = project(latlng, zoom);
  return [projectedPoint[0] - origin[0], projectedPoint[1] - origin[1]];
}

export const SphericalMercator = {
  R: 6378137,
  MAX_LATITUDE: 85.0511287798,

  project(latlng: TLatLng): TPoint {
    const d = Math.PI / 180,
      max = this.MAX_LATITUDE,
      lat = Math.max(Math.min(max, latlng[0]), -max),
      sin = Math.sin(lat * d);

    return [
      this.R * latlng[1] * d,
      (this.R * Math.log((1 + sin) / (1 - sin))) / 2
    ];
  },

  unproject(point: TPoint): TLatLng {
    const d = 180 / Math.PI;

    return [
      (2 * Math.atan(Math.exp(point[1] / this.R)) - Math.PI / 2) * d,
      (point[0] * d) / this.R
    ];
  },

  // bounds: (function () {
  // 	const d = earthRadius * Math.PI;
  // 	return new Bounds([-d, -d], [d, d]);
  // })()

  scale(zoom: number): number {
    return 256 * Math.pow(2, zoom);
  },
  transform(point: TPoint, scale: number = 1): TPoint {
    const s = 0.5 / (Math.PI * SphericalMercator.R);
    return [scale * (s * point[0] + 0.5), scale * (-s * point[1] + 0.5)];
  },
  untransform(point: TPoint, scale: number = 1): TPoint {
    const s = 0.5 / (Math.PI * SphericalMercator.R);
    return [(point[0] / scale - 0.5) / s, (point[1] / scale - 0.5) / -s];
  }
};

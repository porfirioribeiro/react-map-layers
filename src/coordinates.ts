// https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
export const lng2tile = (lon: number, zoom: number) =>
  ((lon + 180) / 360) * Math.pow(2, zoom);
export const lat2tile = (lat: number, zoom: number) =>
  ((1 -
    Math.log(
      Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
    ) /
      Math.PI) /
    2) *
  Math.pow(2, zoom);

export function tile2lng(x: number, z: number) {
  return (x / Math.pow(2, z)) * 360 - 180;
}

export function tile2lat(y: number, z: number) {
  var n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

// minLat, maxLat, minLng, maxLng
export const absoluteMinMax = [
  tile2lat(Math.pow(2, 10), 10),
  tile2lat(0, 10),
  tile2lng(0, 10),
  tile2lng(Math.pow(2, 10), 10)
];

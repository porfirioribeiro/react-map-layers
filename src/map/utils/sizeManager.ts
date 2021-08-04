import { MapStateUpdater } from "../types";

//delete
export function sizeManager(updater: MapStateUpdater) {
  return new ResizeObserver(entries => {
    const { width, height } = entries[0].contentRect;
    updater({ width, height });
  });
}

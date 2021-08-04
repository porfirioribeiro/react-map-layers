import { MapStateUpdater, TPoint, MapDeltaUpdater } from "../types";

export type EventManager = ReturnType<typeof eventManager>;

const PA = { passive: false };
const ANIMATION_TIME = 300;
const DIAGONAL_THROW_TIME = 1500;
const SCROLL_PIXELS_FOR_ZOOM_LEVEL = 150;
const MIN_DRAG_FOR_THROW = 40;
const CLICK_TOLERANCE = 2;
const DEBOUNCE_DELAY = 60;
const PINCH_RELEASE_THROW_DELAY = 300;

export function eventManager(
  update: MapStateUpdater,
  updateDelta: MapDeltaUpdater
) {
  let container: HTMLDivElement;
  let width: number = 0;
  let height: number = 0;
  let currentPoint: TPoint | undefined;
  let toZoomDelta = 0;

  const ro = new ResizeObserver(handleResize);

  function init(c: HTMLDivElement) {
    container = c;
    ro.observe(c);
    window.addEventListener("touchstart", dragStart, PA);
    window.addEventListener("touchend", dragEnd, PA);
    window.addEventListener("touchmove", drag, PA);

    window.addEventListener("mousedown", dragStart, false);
    window.addEventListener("mouseup", dragEnd, false);
    window.addEventListener("mousemove", drag, false);

    container.addEventListener("wheel", handleWheel, PA);
    container.addEventListener("dblclick", handleDblClick);
  }

  function dispose() {
    ro.disconnect();
    window.removeEventListener("touchstart", dragStart);
    window.removeEventListener("touchend", dragEnd);
    window.removeEventListener("touchmove", drag);

    window.removeEventListener("mousedown", dragStart);
    window.removeEventListener("mouseup", dragEnd);
    window.removeEventListener("mousemove", drag);

    container.removeEventListener("wheel", handleWheel);
    container.removeEventListener("dblclick", handleDblClick);
  }

  function mouseCoords(e: MouseEvent | TouchEvent): TPoint {
    const rect = container.getBoundingClientRect();
    const p = "touches" in e ? e.touches[0] : e;

    return [p.clientX - rect.left, p.clientY - rect.top];
  }

  function handleResize(entries: ResizeObserverEntry[]) {
    const cr = entries[0].contentRect;
    width = cr.width;
    height = cr.height;
    update({ width, height });
  }

  function dragStart(e: MouseEvent | TouchEvent) {
    if (container.contains(e.target as HTMLElement)) {
      const point = mouseCoords(e);
      trackMouse(point);
      currentPoint = point;
      // console.log("start", point);
    }
  }

  function drag(e: MouseEvent | TouchEvent) {
    if (currentPoint) {
      e.preventDefault();
      const point = mouseCoords(e);
      trackMouse(point);

      const deltaPoint: TPoint = [
        point[0] - currentPoint[0],
        point[1] - currentPoint[1]
      ];

      console.log("drag", deltaPoint, point, currentPoint);
      updateDelta(deltaPoint, 0);
      currentPoint = point;
    }
  }
  function dragEnd(e: MouseEvent | TouchEvent) {
    if (currentPoint) {
      // const point = mouseCoords(e);
      // console.log("end", point);
      currentPoint = undefined;
    }
  }

  function handleWheel(e: WheelEvent) {
    requestZoom(mouseCoords(e), e.deltaY > 0 ? -1 : 1);
  }

  function handleDblClick(e: MouseEvent) {
    requestZoom(mouseCoords(e), 2);
  }

  let _zraf = 0;
  function doZoom() {
    cancelAnimationFrame(_zraf);

    const delta = toZoomDelta > 0 ? 0.2 : -0.2;
    toZoomDelta -= delta;
    updateDelta([0, 0], delta);
    console.log(toZoomDelta);
    
    if (toZoomDelta !== 0) _zraf = requestAnimationFrame(doZoom);
  }

  function requestZoom(point: TPoint, delta: number) {
    console.log("requestzoom", delta);
    toZoomDelta = delta;

    doZoom();

    // updateDelta([0, 0], delta);
  }

  function trackMouse(point: [number, number]) {}

  return {
    init,
    dispose
  };
}

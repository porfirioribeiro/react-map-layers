import { TPoint } from "./types";

export type DragManager = ReturnType<typeof dragManager>;

type MUpdater = (center: TPoint, zoom: number) => void;

const PA = { passive: false };

export function dragManager(update: MUpdater) {
  let container!: HTMLDivElement;
  let active = false;
  let currentX: number;
  let currentY: number;

  function init(c: HTMLDivElement) {
    container = c;
    window.addEventListener("touchstart", dragStart, PA);
    window.addEventListener("touchend", dragEnd, PA);
    window.addEventListener("touchmove", drag, PA);

    window.addEventListener("mousedown", dragStart, false);
    window.addEventListener("mouseup", dragEnd, false);
    window.addEventListener("mousemove", drag, false);

    container.addEventListener("wheel", handleWheel, PA);
  }

  function dispose() {
    window.removeEventListener("touchstart", dragStart);
    window.removeEventListener("touchend", dragEnd);
    window.removeEventListener("touchmove", drag);

    window.removeEventListener("mousedown", dragStart);
    window.removeEventListener("mouseup", dragEnd);
    window.removeEventListener("mousemove", drag);

    container.removeEventListener("wheel", handleWheel);
  }

  function mouseCoords(e: MouseEvent | TouchEvent): [number, number] {
    const rect = container.getBoundingClientRect();
    const p = "touches" in e ? e.touches[0] : e;

    return [p.clientX - rect.left, p.clientY - rect.top];
  }

  function dragStart(e: MouseEvent | TouchEvent) {
    if (container.contains(e.target as HTMLElement)) {
      active = true;
      const point = mouseCoords(e);
      trackMouse(point);
      // console.log("start", point);
    }
  }

  function drag(e: MouseEvent | TouchEvent) {
    if (active) {
      e.preventDefault();
      const point = mouseCoords(e);
      trackMouse(point);

      // console.log("drag", point);

      setTranslate(currentX, currentY, container);
    }
  }
  function dragEnd(e: MouseEvent | TouchEvent) {
    if (active) {
      // const point = mouseCoords(e);
      // console.log("end", point);

      active = false;
    }
  }

  function handleWheel(e: WheelEvent) {
    console.log("wheee");
  }

  function trackMouse(point: [number, number]) {}

  function setTranslate(xPos: number, yPos: number, el: HTMLDivElement) {
    // console.log(xPos, yPos);
  }

  return {
    init,
    dispose
  };
}

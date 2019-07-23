import { RefObject } from "react";

interface DragManagerOptions {
  // containerRef
}

export interface DragManager {}

export function DragManager(ref: RefObject<HTMLDivElement>) {
  let active = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  window.addEventListener("touchstart", dragStart, { passive: false });
  window.addEventListener("touchend", dragEnd, { passive: false });
  window.addEventListener("touchmove", drag, { passive: false });

  window.addEventListener("mousedown", dragStart, false);
  window.addEventListener("mouseup", dragEnd, false);
  window.addEventListener("mousemove", drag, false);

  function dispose() {
    window.removeEventListener("touchstart", dragStart);
    window.removeEventListener("touchend", dragEnd);
    window.removeEventListener("touchmove", drag);

    window.removeEventListener("mousedown", dragStart);
    window.removeEventListener("mouseup", dragEnd);
    window.removeEventListener("mousemove", drag);
  }

  function mouseCoords(e: MouseEvent | TouchEvent): [number, number] {
    const rect = ref.current.getBoundingClientRect();
    const p = "touches" in e ? e.touches[0] : e;

    return [p.clientX - rect.left, p.clientY - rect.top];
  }

  function dragStart(e: MouseEvent | TouchEvent) {
    if (ref.current.contains(e.target as HTMLElement)) {
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

      setTranslate(currentX, currentY, ref.current);
    }
  }
  function dragEnd(e) {
    if (active) {
      const point = mouseCoords(e);
      // console.log("end", point);

      active = false;
    }
  }

  function trackMouse(point: [number, number]) {}

  function setTranslate(xPos, yPos, el) {
    // console.log(xPos, yPos);
  }

  return {
    dispose
  };
}

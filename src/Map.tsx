import React, { Component, CSSProperties } from "react";
import { MapContext } from "./context";
import { MapWarning } from "./MapWarning";
import { dragManager, DragManager } from "./dragManager";

import { parentPosition, parentHasClass, debounce } from "./utils";
import { TPoint, TMinMax } from "./types";

const ANIMATION_TIME = 300;
const DIAGONAL_THROW_TIME = 1500;
const SCROLL_PIXELS_FOR_ZOOM_LEVEL = 150;
const MIN_DRAG_FOR_THROW = 40;
const CLICK_TOLERANCE = 2;
const DEBOUNCE_DELAY = 60;
const PINCH_RELEASE_THROW_DELAY = 300;
const WARNING_DISPLAY_TIMEOUT = 300;

const NOOP = () => {};

type MapURL = (x: number, y: number, z: number, dpr?: number) => string;

function wikimedia(x: number, y: number, z: number, dpr?: number) {
  const retina =
    typeof dpr !== "undefined"
      ? dpr >= 2
      : typeof window !== "undefined" && window.devicePixelRatio >= 2;
  return `https://maps.wikimedia.org/osm-intl/${z}/${x}/${y}${
    retina ? "@2x" : ""
  }.png`;
}

// https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
const lng2tile = (lon: number, zoom: number) =>
  ((lon + 180) / 360) * Math.pow(2, zoom);
const lat2tile = (lat: number, zoom: number) =>
  ((1 -
    Math.log(
      Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
    ) /
      Math.PI) /
    2) *
  Math.pow(2, zoom);

function tile2lng(x: number, z: number) {
  return (x / Math.pow(2, z)) * 360 - 180;
}

function tile2lat(y: number, z: number) {
  var n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function getMousePixel(dom: HTMLElement, event: MouseEvent | Touch): TPoint {
  const parent = parentPosition(dom);
  return [event.clientX - parent.x, event.clientY - parent.y];
}

function easeOutQuad(t: number) {
  return t * (2 - t);
}

// minLat, maxLat, minLng, maxLng
const absoluteMinMax = [
  tile2lat(Math.pow(2, 10), 10),
  tile2lat(0, 10),
  tile2lng(0, 10),
  tile2lng(Math.pow(2, 10), 10)
];

function srcSet(dprs: number[], url: MapURL, x: number, y: number, z: number) {
  if (!dprs || dprs.length === 0) return "";

  return dprs
    .map((dpr) => url(x, y, z, dpr) + (dpr === 1 ? "" : ` ${dpr}x`))
    .join(", ");
}

interface MapProps {
  center?: TPoint;
  defaultCenter?: TPoint;

  boxClassname?: string;

  zoom?: number;
  defaultZoom?: number;

  width?: number;
  defaultWidth?: number;

  height?: number;
  defaultHeight?: number;

  provider?: (x: number, y: number, z: number, dpr?:number) => string;
  dprs: number[];
  children?: React.ReactNode;

  animate?: boolean;
  animateMaxScreens: number;

  minZoom: number;
  maxZoom: number;

  metaWheelZoom?: boolean;
  metaWheelZoomWarning: string;
  twoFingerDrag?: boolean;
  twoFingerDragWarning: string;

  zoomSnap?: boolean;
  mouseEvents?: boolean;
  touchEvents?: boolean;

  onClick?: (a: any) => void;
  onBoundsChanged?: (a: any) => void;
  onAnimationStart?: () => void;
  onAnimationStop?: () => void;

  // will be set to "edge" from v0.12 onward, defaulted to "center" before
  limitBounds?: "center" | "edge";
}

export interface MapState {
  zoom: number;
  center: TPoint;
  width: number;
  height: number;
  zoomDelta: number;
  pixelDelta: null | any;
  oldTiles: any[];
  showWarning: boolean;
  warningType: null | any;
  dragManager: DragManager;
  latLngToPixel(latLng: TPoint, center?: TPoint, zoom?: number): TPoint;
  pixelToLatLng(latLng: TPoint, center?: TPoint, zoom?: number): TPoint;
}

const wae = window.addEventListener;
const wre = window.removeEventListener;
export default class Map extends Component<MapProps, MapState> {
  static defaultProps = {
    animate: true,
    metaWheelZoom: false,
    metaWheelZoomWarning: "Use META+wheel to zoom!",
    twoFingerDrag: false,
    twoFingerDragWarning: "Use two fingers to move the map",
    zoomSnap: true,
    mouseEvents: true,
    touchEvents: true,
    animateMaxScreens: 5,
    minZoom: 1,
    maxZoom: 18,
    limitBounds: "center",
    dprs: []
  };

  syncToProps = debounce(
    (center = this.state.center, zoom = this.state.zoom) => {
      const { onBoundsChanged } = this.props;

      if (onBoundsChanged) {
        const bounds = this.getBounds(center, zoom);

        onBoundsChanged({ center, zoom, bounds, initial: !this._boundsSynced });

        this._boundsSynced = true;
      }
    },
    DEBOUNCE_DELAY
  );

  _dragStart!: TPoint;
  _mouseDown = false;
  _moveEvents: { timestamp: number; coords: TPoint }[] = [];
  _touchStartPixel: TPoint[] | null = null;

  _isAnimating = false;
  _animationStart!: number;
  _animationEnd!: number;
  _centerTarget!: TPoint;
  _zoomTarget!: number;

  // When users are using uncontrolled components we have to keep this
  // so we can know if we should call onBoundsChanged
  _lastZoom =
    (this.props.defaultZoom ? this.props.defaultZoom : this.props.zoom) || 0;
  _lastCenter = (this.props.defaultCenter
    ? this.props.defaultCenter
    : this.props.center) || [0, 0];
  _boundsSynced = false;
  _minMaxCache!: [number, number, number, TMinMax];

  // ref
  _el = React.createRef<HTMLDivElement>();

  state: MapState = {
    zoom: this._lastZoom || 0,
    center: this._lastCenter || [0, 0],
    width: this.props.width || this.props.defaultWidth || 0,
    height: this.props.height || this.props.defaultHeight || 0,
    zoomDelta: 0,
    pixelDelta: null,
    oldTiles: [],
    showWarning: false,
    warningType: null,
    dragManager: dragManager(this._el),
    latLngToPixel: (
      latLng: TPoint,
      center = this.state.center,
      zoom = this.zoomPlusDelta()
    ) => {
      const { width, height, pixelDelta } = this.state;

      const tileCenterX = lng2tile(center[1], zoom);
      const tileCenterY = lat2tile(center[0], zoom);

      const tileX = lng2tile(latLng[1], zoom);
      const tileY = lat2tile(latLng[0], zoom);

      return [
        (tileX - tileCenterX) * 256.0 +
          width / 2 +
          (pixelDelta ? pixelDelta[0] : 0),
        (tileY - tileCenterY) * 256.0 +
          height / 2 +
          (pixelDelta ? pixelDelta[1] : 0)
      ];
    },
    pixelToLatLng: (
      pixel: TPoint,
      center = this.state.center,
      zoom = this.zoomPlusDelta()
    ) => {
      const { width, height, pixelDelta } = this.state;

      const pointDiff = [
        (pixel[0] - width / 2 - (pixelDelta ? pixelDelta[0] : 0)) / 256.0,
        (pixel[1] - height / 2 - (pixelDelta ? pixelDelta[1] : 0)) / 256.0
      ];

      const tileX = lng2tile(center[1], zoom) + pointDiff[0];
      const tileY = lat2tile(center[0], zoom) + pointDiff[1];

      return [
        Math.max(
          absoluteMinMax[0],
          Math.min(absoluteMinMax[1], tile2lat(tileY, zoom))
        ),
        Math.max(
          absoluteMinMax[2],
          Math.min(absoluteMinMax[3], tile2lng(tileX, zoom))
        )
      ];
    }
  };
  _animFrame!: number;
  _centerStart!: TPoint;
  _zoomStart: any;
  _zoomAround: any;
  _loadTracker!: Record<string, boolean>;
  _touchStartMidPoint!: TPoint;
  _touchStartDistance!: number;
  _secondTouchEnd: any;
  _lastWheel: any;
  _warningClearTimeout: any;

  componentDidMount() {
    this.bindEvents();

    if (!this.props.width || !this.props.height) {
      // A height:100% container div often results in height=0 being returned on mount.
      // So ask again once everything is painted.
      if (!this.updateWidthHeight())
        requestAnimationFrame(this.updateWidthHeight);
    }

    this.syncToProps();
  }

  componentWillUnmount() {
    this.unbindEvents();
    this.state.dragManager.dispose();
  }

  updateWidthHeight = () => {
    if (this._el.current) {
      const rect = this._el.current.getBoundingClientRect();

      if (rect && rect.width > 0 && rect.height > 0) {
        this.setState({
          width: rect.width,
          height: rect.height
        });
        return true;
      }
    }
    return false;
  };

  bindMouseEvents(bind: boolean) {
    if (bind) {
      wae("mousedown", this.handleMouseDown);
      wae("mouseup", this.handleMouseUp);
      wae("mousemove", this.handleMouseMove);
      if (this._el.current)
        this._el.current.addEventListener("wheel", this.handleWheel, {
          passive: false
        });
    } else {
      wre("mousedown", this.handleMouseDown);
      wre("mouseup", this.handleMouseUp);
      wre("mousemove", this.handleMouseMove);
      if (this._el.current)
        this._el.current.removeEventListener("wheel", this.handleWheel);
    }
  }

  bindTouchEvents(bind: boolean) {
    if (bind) {
      wae("touchstart", this.handleTouchStart, { passive: false });
      wae("touchmove", this.handleTouchMove, {
        passive: false
      });
      wae("touchend", this.handleTouchEnd, {
        passive: false
      });
    } else {
      wre("touchstart", this.handleTouchStart);
      wre("touchmove", this.handleTouchMove);
      wre("touchend", this.handleTouchEnd);
    }
  }

  bindEvents() {
    this.props.mouseEvents && this.bindMouseEvents(true);
    this.props.touchEvents && this.bindTouchEvents(true);
    wae("resize", this.updateWidthHeight);
  }

  unbindEvents() {
    this.props.mouseEvents && this.bindMouseEvents(false);
    this.props.touchEvents && this.bindTouchEvents(false);
    wre("resize", this.updateWidthHeight);
  }

  componentWillReceiveProps(nextProps: MapProps) {
    if (nextProps.mouseEvents !== this.props.mouseEvents)
      this.bindMouseEvents(!!nextProps.mouseEvents);

    if (nextProps.touchEvents !== this.props.touchEvents)
      this.bindTouchEvents(!!nextProps.touchEvents);

    if (nextProps.width && nextProps.width !== this.props.width)
      this.setState({ width: nextProps.width });

    if (nextProps.height && nextProps.height !== this.props.height)
      this.setState({ height: nextProps.height });

    if (!nextProps.center && !nextProps.zoom) {
      // if the user isn't controlling neither zoom nor center we don't have to update.
      return;
    }
    if (
      (!nextProps.center ||
        (this.props.center &&
          nextProps.center[0] === this.props.center[0] &&
          nextProps.center[1] === this.props.center[1])) &&
      nextProps.zoom === this.props.zoom
    ) {
      // if the user is controlling either zoom or center but nothing changed
      // we don't have to update aswell
      return;
    }

    const currentCenter = this._isAnimating
      ? this._centerTarget
      : this.state.center;
    const currentZoom = this._isAnimating ? this._zoomTarget : this.state.zoom;

    const nextCenter = nextProps.center || currentCenter; // prevent the rare null errors
    const nextZoom = nextProps.zoom || currentZoom;

    if (
      Math.abs(nextZoom - currentZoom) > 0.001 ||
      Math.abs(nextCenter[0] - currentCenter[0]) > 0.0001 ||
      Math.abs(nextCenter[1] - currentCenter[1]) > 0.0001
    ) {
      this.setCenterZoomTarget(nextCenter, nextZoom, true);
    }
  }

  setCenterZoomTarget = (
    center: TPoint,
    zoom: number,
    fromProps = false,
    zoomAround: TPoint | null = null,
    animationDuration = ANIMATION_TIME
  ) => {
    if (
      this.props.animate &&
      (!fromProps ||
        this.distanceInScreens(
          center,
          zoom,
          this.state.center,
          this.state.zoom
        ) <= this.props.animateMaxScreens)
    ) {
      if (this._isAnimating) {
        cancelAnimationFrame(this._animFrame);
        const { centerStep, zoomStep } = this.animationStep(
          window.performance.now()
        );
        this._centerStart = centerStep;
        this._zoomStart = zoomStep;
      } else {
        this._isAnimating = true;
        this._centerStart = this.limitCenterAtZoom(
          [this._lastCenter[0], this._lastCenter[1]],
          this._lastZoom
        );
        this._zoomStart = this._lastZoom;
        this.onAnimationStart();
      }

      this._animationStart = window.performance.now();
      this._animationEnd = this._animationStart + animationDuration;

      if (zoomAround) {
        this._zoomAround = zoomAround;
        this._centerTarget = this.calculateZoomCenter(
          this._lastCenter,
          // @ts-ignore
          zoomAround,
          this._lastZoom,
          zoom
        );
      } else {
        this._zoomAround = null;
        this._centerTarget = center;
      }
      this._zoomTarget = zoom;

      this._animFrame = requestAnimationFrame(this.animate);
    } else {
      this.stopAnimating();

      if (zoomAround) {
        const center = this.calculateZoomCenter(
          this._lastCenter,
          // @ts-ignore
          zoomAround,
          this._lastZoom,
          zoom
        );
        this.setCenterZoom(center, zoom, fromProps);
      } else {
        this.setCenterZoom(center, zoom, fromProps);
      }
    }
  };

  distanceInScreens = (
    centerTarget: TPoint,
    zoomTarget: number,
    center: TPoint,
    zoom: number
  ) => {
    const { width, height } = this.state;

    // distance in pixels at the current zoom level
    const l1 = this.latLngToPixel(center, center, zoom);
    const l2 = this.latLngToPixel(centerTarget, center, zoom);

    // distance in pixels at the target zoom level (could be the same)
    const z1 = this.latLngToPixel(center, center, zoomTarget);
    const z2 = this.latLngToPixel(centerTarget, center, zoomTarget);

    // take the average between the two and divide by width or height to get the distance multiplier in screens
    const w = (Math.abs(l1[0] - l2[0]) + Math.abs(z1[0] - z2[0])) / 2 / width;
    const h = (Math.abs(l1[1] - l2[1]) + Math.abs(z1[1] - z2[1])) / 2 / height;

    // return the distance
    return Math.sqrt(w * w + h * h);
  };

  animationStep = (timestamp: number) => {
    const length = this._animationEnd - this._animationStart;
    const progress = Math.max(timestamp - this._animationStart, 0);
    const percentage = easeOutQuad(progress / length);

    const zoomDiff = (this._zoomTarget - this._zoomStart) * percentage;
    const zoomStep = this._zoomStart + zoomDiff;

    if (this._zoomAround) {
      const centerStep = this.calculateZoomCenter(
        this._centerStart,
        this._zoomAround,
        this._zoomStart,
        zoomStep
      );

      return { centerStep, zoomStep };
    } else {
      const centerStep: TPoint = [
        this._centerStart[0] +
          (this._centerTarget[0] - this._centerStart[0]) * percentage,
        this._centerStart[1] +
          (this._centerTarget[1] - this._centerStart[1]) * percentage
      ];

      return { centerStep, zoomStep };
    }
  };

  animate = (timestamp: number) => {
    if (timestamp >= this._animationEnd) {
      this._isAnimating = false;
      this.setCenterZoom(this._centerTarget, this._zoomTarget, true);
      this.onAnimationStop();
    } else {
      const { centerStep, zoomStep } = this.animationStep(timestamp);
      this.setCenterZoom(centerStep, zoomStep);
      this._animFrame = requestAnimationFrame(this.animate);
    }
  };

  stopAnimating = () => {
    if (this._isAnimating) {
      this._isAnimating = false;
      this.onAnimationStop();
      cancelAnimationFrame(this._animFrame);
    }
  };

  limitCenterAtZoom = (center: TPoint, zoom: number): TPoint => {
    // [minLat, maxLat, minLng, maxLng]
    const minMax = this.getBoundsMinMax(zoom || this.state.zoom);

    return [
      Math.max(
        Math.min(
          isNaN(center[0]) ? this.state.center[0] : center[0],
          minMax[1]
        ),
        minMax[0]
      ),
      Math.max(
        Math.min(
          isNaN(center[1]) ? this.state.center[1] : center[1],
          minMax[3]
        ),
        minMax[2]
      )
    ];
  };

  onAnimationStart = () => {
    this.props.onAnimationStart && this.props.onAnimationStart();
  };

  onAnimationStop = () => {
    this.props.onAnimationStop && this.props.onAnimationStop();
  };

  // main logic when changing coordinates
  setCenterZoom = (center: TPoint, zoom: number, animationEnded = false) => {
    const limitedCenter = this.limitCenterAtZoom(center, zoom);

    if (Math.round(this.state.zoom) !== Math.round(zoom)) {
      const tileValues = this.tileValues(this.state);
      const nextValues = this.tileValues({
        center: limitedCenter,
        zoom,
        width: this.state.width,
        height: this.state.height
      });
      const oldTiles = this.state.oldTiles;

      this.setState(
        {
          oldTiles: oldTiles
            .filter((o) => o.roundedZoom !== tileValues.roundedZoom)
            .concat(tileValues)
        },
        NOOP
      );

      let loadTracker: Record<string, boolean> = {};

      for (let x = nextValues.tileMinX; x <= nextValues.tileMaxX; x++) {
        for (let y = nextValues.tileMinY; y <= nextValues.tileMaxY; y++) {
          let key = `${x}-${y}-${nextValues.roundedZoom}`;
          loadTracker[key] = false;
        }
      }

      this._loadTracker = loadTracker;
    }

    this.setState({ center: limitedCenter, zoom }, NOOP);

    const maybeZoom = this.props.zoom ? this.props.zoom : this._lastZoom;
    const maybeCenter = this.props.center
      ? this.props.center
      : this._lastCenter;
    if (
      animationEnded ||
      Math.abs(maybeZoom - zoom) > 0.001 ||
      Math.abs(maybeCenter[0] - limitedCenter[0]) > 0.00001 ||
      Math.abs(maybeCenter[1] - limitedCenter[1]) > 0.00001
    ) {
      this._lastZoom = zoom;
      this._lastCenter = limitedCenter;
      this.syncToProps(limitedCenter, zoom);
    }
  };

  getBoundsMinMax = (zoom: number) => {
    if (this.props.limitBounds === "center") {
      return absoluteMinMax;
    }

    const { width, height } = this.state;

    if (
      this._minMaxCache &&
      this._minMaxCache[0] === zoom &&
      this._minMaxCache[1] === width &&
      this._minMaxCache[2] === height
    ) {
      return this._minMaxCache[3];
    }

    const pixelsAtZoom = Math.pow(2, zoom) * 256;

    const minLng = width > pixelsAtZoom ? 0 : tile2lng(width / 512, zoom); // x
    const minLat =
      height > pixelsAtZoom
        ? 0
        : tile2lat(Math.pow(2, zoom) - height / 512, zoom); // y

    const maxLng =
      width > pixelsAtZoom
        ? 0
        : tile2lng(Math.pow(2, zoom) - width / 512, zoom); // x
    const maxLat = height > pixelsAtZoom ? 0 : tile2lat(height / 512, zoom); // y

    const minMax: TMinMax = [minLat, maxLat, minLng, maxLng];

    this._minMaxCache = [zoom, width, height, minMax];

    return minMax;
  };

  imageLoaded = (key: string) => {
    if (this._loadTracker && key in this._loadTracker) {
      this._loadTracker[key] = true;

      const unloadedCount = Object.keys(this._loadTracker).filter(
        (k) => !this._loadTracker[k]
      ).length;

      if (unloadedCount === 0) {
        this.setState({ oldTiles: [] }, NOOP);
      }
    }
  };

  coordsInside(pixel: TPoint) {
    const { width, height } = this.state;

    if (
      pixel[0] < 0 ||
      pixel[1] < 0 ||
      pixel[0] >= width ||
      pixel[1] >= height
    ) {
      return false;
    }

    const pos = parentPosition(this._el.current!);
    const element = document.elementFromPoint(
      pixel[0] + pos.x,
      pixel[1] + pos.y
    );

    return this._el.current === element || this._el.current!.contains(element);
  }

  handleTouchStart = (event: TouchEvent) => {
    if (!this._el.current) {
      return;
    }
    if (
      event.target &&
      parentHasClass(event.target as HTMLElement, "pigeon-drag-block")
    ) {
      return;
    }
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const pixel = getMousePixel(this._el.current, touch);

      if (this.coordsInside(pixel)) {
        this._touchStartPixel = [pixel];

        if (!this.props.twoFingerDrag) {
          this.stopAnimating();
          this.trackMoveEvents(pixel);
        }
      }
      // added second finger and first one was in the area
    } else if (event.touches.length === 2 && this._touchStartPixel) {
      event.preventDefault();

      this.stopTrackingMoveEvents();

      if (this.state.pixelDelta || this.state.zoomDelta) {
        this.sendDeltaChange();
      }

      const t1 = getMousePixel(this._el.current, event.touches[0]);
      const t2 = getMousePixel(this._el.current, event.touches[1]);

      this._touchStartPixel = [t1, t2];
      this._touchStartMidPoint = [(t1[0] + t2[0]) / 2, (t1[1] + t2[1]) / 2];
      this._touchStartDistance = Math.sqrt(
        Math.pow(t1[0] - t2[0], 2) + Math.pow(t1[1] - t2[1], 2)
      );
    }
  };

  handleTouchMove = (event: TouchEvent) => {
    if (!this._el.current) {
      this._touchStartPixel = null;
      return;
    }
    if (event.touches.length === 1 && this._touchStartPixel) {
      const touch = event.touches[0];
      const pixel = getMousePixel(this._el.current, touch);

      if (this.props.twoFingerDrag) {
        if (this.coordsInside(pixel)) {
          this.showWarning("fingers");
        }
      } else {
        event.preventDefault();
        this.trackMoveEvents(pixel);

        this.setState(
          {
            pixelDelta: [
              pixel[0] - this._touchStartPixel[0][0],
              pixel[1] - this._touchStartPixel[0][1]
            ]
          },
          NOOP
        );
      }
    } else if (event.touches.length === 2 && this._touchStartPixel) {
      const { width, height, zoom } = this.state;

      event.preventDefault();

      const t1 = getMousePixel(this._el.current, event.touches[0]);
      const t2 = getMousePixel(this._el.current, event.touches[1]);

      const midPoint = [(t1[0] + t2[0]) / 2, (t1[1] + t2[1]) / 2];
      const midPointDiff = [
        midPoint[0] - this._touchStartMidPoint[0],
        midPoint[1] - this._touchStartMidPoint[1]
      ];

      const distance = Math.sqrt(
        Math.pow(t1[0] - t2[0], 2) + Math.pow(t1[1] - t2[1], 2)
      );

      const zoomDelta =
        Math.max(
          this.props.minZoom,
          Math.min(
            this.props.maxZoom,
            zoom + Math.log2(distance / this._touchStartDistance)
          )
        ) - zoom;
      const scale = Math.pow(2, zoomDelta);

      const centerDiffDiff = [
        (width / 2 - midPoint[0]) * (scale - 1),
        (height / 2 - midPoint[1]) * (scale - 1)
      ];

      this.setState(
        {
          zoomDelta: zoomDelta,
          pixelDelta: [
            centerDiffDiff[0] + midPointDiff[0] * scale,
            centerDiffDiff[1] + midPointDiff[1] * scale
          ]
        },
        NOOP
      );
    }
  };

  handleTouchEnd = (event: TouchEvent) => {
    if (!this._el.current) {
      this._touchStartPixel = null;
      return;
    }
    if (this._touchStartPixel) {
      const { zoomSnap, twoFingerDrag, minZoom, maxZoom } = this.props;
      const { zoomDelta } = this.state;
      const { center, zoom } = this.sendDeltaChange();

      if (event.touches.length === 0) {
        if (twoFingerDrag) {
          this.clearWarning();
        } else {
          // if the click started and ended at about
          // the same place we can view it as a click
          // and not prevent default behavior.
          const oldTouchPixel = this._touchStartPixel[0];
          const newTouchPixel = getMousePixel(
            this._el.current,
            event.changedTouches[0]
          );

          if (
            Math.abs(oldTouchPixel[0] - newTouchPixel[0]) > CLICK_TOLERANCE ||
            Math.abs(oldTouchPixel[1] - newTouchPixel[1]) > CLICK_TOLERANCE
          ) {
            // don't throw immediately after releasing the second finger
            if (
              !this._secondTouchEnd ||
              window.performance.now() - this._secondTouchEnd >
                PINCH_RELEASE_THROW_DELAY
            ) {
              event.preventDefault();
              this.throwAfterMoving(newTouchPixel, center, zoom);
            }
          }

          this._touchStartPixel = null;
          this._secondTouchEnd = null;
        }
      } else if (event.touches.length === 1) {
        event.preventDefault();
        const touch = getMousePixel(this._el.current, event.touches[0]);

        this._secondTouchEnd = window.performance.now();
        this._touchStartPixel = [touch];
        this.trackMoveEvents(touch);

        if (zoomSnap) {
          // if somehow we have no midpoint for the two finger touch, just take the center of the map
          const latLng = this._touchStartMidPoint
            ? this.pixelToLatLng(this._touchStartMidPoint)
            : this.state.center;

          let zoomTarget;

          // do not zoom up/down if we must drag with 2 fingers and didn't change the zoom level
          if (
            twoFingerDrag &&
            Math.round(this.state.zoom) ===
              Math.round(this.state.zoom + zoomDelta)
          ) {
            zoomTarget = Math.round(this.state.zoom);
          } else {
            zoomTarget =
              zoomDelta > 0
                ? Math.ceil(this.state.zoom)
                : Math.floor(this.state.zoom);
          }
          const zoom = Math.max(minZoom, Math.min(zoomTarget, maxZoom));

          this.setCenterZoomTarget(latLng, zoom, false, latLng);
        }
      }
    }
  };

  handleDblClick = (event: React.MouseEvent) => {
    const pixel = getMousePixel(this._el.current!, event.nativeEvent);
    const latLngNow = this.pixelToLatLng(pixel);
    this.setCenterZoomTarget(
      //@ts-ignore
      null,
      Math.max(
        this.props.minZoom,
        Math.min(this.state.zoom + 2, this.props.maxZoom)
      ),
      false,
      latLngNow
    );
  };

  handleMouseDown = (event: MouseEvent) => {
    if (!this._el.current) {
      return;
    }
    const pixel = getMousePixel(this._el.current, event);
    // console.log("mousedown", event.target);

    if (
      event.button === 0 &&
      (!event.target ||
        !parentHasClass(event.target as HTMLElement, "pigeon-drag-block")) &&
      this.coordsInside(pixel)
    ) {
      this.stopAnimating();
      event.preventDefault();

      this._mouseDown = true;
      this._dragStart = pixel;
      this.trackMoveEvents(pixel);
    }
  };

  handleMouseMove = (event: MouseEvent) => {
    if (!this._el.current) {
      return;
    }
    const _mousePosition = getMousePixel(this._el.current, event);

    if (this._mouseDown && this._dragStart) {
      this.trackMoveEvents(_mousePosition);
      this.setState(
        {
          pixelDelta: [
            _mousePosition[0] - this._dragStart[0],
            _mousePosition[1] - this._dragStart[1]
          ]
        },
        NOOP
      );
    }
  };

  handleMouseUp = (event: MouseEvent) => {
    if (!this._el.current) {
      this._mouseDown = false;
      return;
    }
    const { pixelDelta } = this.state;

    if (this._mouseDown) {
      this._mouseDown = false;

      const pixel = getMousePixel(this._el.current, event);

      if (
        this.props.onClick &&
        (!event.target ||
          !parentHasClass(event.target as HTMLElement, "pigeon-click-block")) &&
        (!pixelDelta ||
          Math.abs(pixelDelta[0]) + Math.abs(pixelDelta[1]) <= CLICK_TOLERANCE)
      ) {
        const latLng = this.pixelToLatLng(pixel);
        this.props.onClick({ event, latLng, pixel: pixel });
        this.setState({ pixelDelta: null }, NOOP);
      } else {
        const { center, zoom } = this.sendDeltaChange();

        this.throwAfterMoving(pixel, center, zoom);
      }
    }
  };

  // https://www.bennadel.com/blog/1856-using-jquery-s-animate-step-callback-function-to-create-custom-animations.htm
  stopTrackingMoveEvents = () => {
    this._moveEvents = [];
  };

  trackMoveEvents = (coords: TPoint) => {
    console.log("track", coords);

    const timestamp = window.performance.now();

    if (
      this._moveEvents.length === 0 ||
      timestamp - this._moveEvents[this._moveEvents.length - 1].timestamp > 40
    ) {
      console.log("trackin", coords);

      this._moveEvents.push({ timestamp, coords });
      if (this._moveEvents.length > 2) {
        this._moveEvents.shift();
      }
    }
  };

  throwAfterMoving = (coords: TPoint, center: TPoint, zoom: number) => {
    const { width, height } = this.state;
    const { animate } = this.props;

    const timestamp = window.performance.now();
    const lastEvent = this._moveEvents.shift();

    if (lastEvent && animate) {
      const deltaMs = Math.max(timestamp - lastEvent.timestamp, 1);

      const delta = [
        ((coords[0] - lastEvent.coords[0]) / deltaMs) * 120,
        ((coords[1] - lastEvent.coords[1]) / deltaMs) * 120
      ];

      console.log("thro", lastEvent, deltaMs);

      const distance = Math.sqrt(delta[0] * delta[0] + delta[1] * delta[1]);

      if (distance > MIN_DRAG_FOR_THROW) {
        const diagonal = Math.sqrt(width * width + height * height);

        const throwTime = (DIAGONAL_THROW_TIME * distance) / diagonal;

        const lng = tile2lng(
          lng2tile(center[1], zoom) - delta[0] / 256.0,
          zoom
        );
        const lat = tile2lat(
          lat2tile(center[0], zoom) - delta[1] / 256.0,
          zoom
        );

        this.setCenterZoomTarget([lat, lng], zoom, false, null, throwTime);
      }
    }

    this.stopTrackingMoveEvents();
  };

  sendDeltaChange = () => {
    const { center, zoom, pixelDelta, zoomDelta } = this.state;

    let lat = center[0];
    let lng = center[1];

    if (pixelDelta || zoomDelta !== 0) {
      lng = tile2lng(
        lng2tile(center[1], zoom + zoomDelta) -
          (pixelDelta ? pixelDelta[0] / 256.0 : 0),
        zoom + zoomDelta
      );
      lat = tile2lat(
        lat2tile(center[0], zoom + zoomDelta) -
          (pixelDelta ? pixelDelta[1] / 256.0 : 0),
        zoom + zoomDelta
      );
      this.setCenterZoom([lat, lng], zoom + zoomDelta);
    }

    this.setState(
      {
        pixelDelta: null,
        zoomDelta: 0
      },
      NOOP
    );

    return {
      center: this.limitCenterAtZoom([lat, lng], zoom + zoomDelta),
      zoom: zoom + zoomDelta
    };
  };

  getBounds = (center = this.state.center, zoom = this.zoomPlusDelta()) => {
    const { width, height } = this.state;

    return {
      ne: this.pixelToLatLng([width - 1, 0], center, zoom),
      sw: this.pixelToLatLng([0, height - 1], center, zoom)
    };
  };

  handleWheel = (event: WheelEvent) => {
    const { mouseEvents, metaWheelZoom, zoomSnap, animate } = this.props;

    if (!mouseEvents) {
      return;
    }

    if (!metaWheelZoom || event.metaKey) {
      event.preventDefault();

      const addToZoom = -event.deltaY / SCROLL_PIXELS_FOR_ZOOM_LEVEL;

      if (!zoomSnap && this._zoomTarget) {
        const stillToAdd = this._zoomTarget - this.state.zoom;
        this.zoomAroundMouse(addToZoom + stillToAdd, event);
      } else {
        if (animate) {
          this.zoomAroundMouse(addToZoom, event);
        } else {
          if (
            !this._lastWheel ||
            window.performance.now() - this._lastWheel > ANIMATION_TIME
          ) {
            this._lastWheel = window.performance.now();
            this.zoomAroundMouse(addToZoom, event);
          }
        }
      }
    } else {
      this.showWarning("wheel");
    }
  };

  showWarning = (warningType: any) => {
    if (!this.state.showWarning || this.state.warningType !== warningType) {
      this.setState({ showWarning: true, warningType });
    }

    if (this._warningClearTimeout) {
      window.clearTimeout(this._warningClearTimeout);
    }
    this._warningClearTimeout = window.setTimeout(
      this.clearWarning,
      WARNING_DISPLAY_TIMEOUT
    );
  };

  clearWarning = () =>
    this.state.showWarning && this.setState({ showWarning: false });

  zoomAroundMouse = (zoomDiff: number, event: MouseEvent | Touch) => {
    if (!this._el.current) {
      return;
    }
    const { zoom } = this.state;
    const { minZoom, maxZoom, zoomSnap } = this.props;

    const _mousePosition = getMousePixel(this._el.current, event);

    if (
      !_mousePosition ||
      (zoom === minZoom && zoomDiff < 0) ||
      (zoom === maxZoom && zoomDiff > 0)
    ) {
      return;
    }

    const latLngNow = this.pixelToLatLng(_mousePosition);

    let zoomTarget = zoom + zoomDiff;
    if (zoomSnap) {
      zoomTarget =
        zoomDiff < 0 ? Math.floor(zoomTarget) : Math.ceil(zoomTarget);
    }
    zoomTarget = Math.max(minZoom, Math.min(zoomTarget, maxZoom));

    //@ts-ignore
    this.setCenterZoomTarget(null, zoomTarget, false, latLngNow);
  };

  // tools

  zoomPlusDelta = () => {
    return this.state.zoom + this.state.zoomDelta;
  };

  pixelToLatLng = this.state.pixelToLatLng;

  latLngToPixel = this.state.latLngToPixel;

  calculateZoomCenter = (
    center: TPoint,
    coords: TPoint,
    oldZoom: number,
    newZoom: number
  ): TPoint => {
    const { width, height } = this.state;

    const pixelBefore = this.latLngToPixel(coords, center, oldZoom);
    const pixelAfter = this.latLngToPixel(coords, center, newZoom);

    const newCenter = this.pixelToLatLng(
      [
        width / 2 + pixelAfter[0] - pixelBefore[0],
        height / 2 + pixelAfter[1] - pixelBefore[1]
      ],
      center,
      newZoom
    );

    return this.limitCenterAtZoom(newCenter, newZoom);
  };

  // data to display the tiles

  tileValues(state: {
    center: TPoint;
    zoom: number;
    width: number;
    height: number;
    pixelDelta?: TPoint;
    zoomDelta?: number;
  }) {
    const { center, zoom, pixelDelta, zoomDelta, width, height } = state;

    const roundedZoom = Math.round(zoom + (zoomDelta || 0));
    const zoomDiff = zoom + (zoomDelta || 0) - roundedZoom;

    const scale = Math.pow(2, zoomDiff);
    const scaleWidth = width / scale;
    const scaleHeight = height / scale;

    const tileCenterX =
      lng2tile(center[1], roundedZoom) -
      (pixelDelta ? pixelDelta[0] / 256.0 / scale : 0);
    const tileCenterY =
      lat2tile(center[0], roundedZoom) -
      (pixelDelta ? pixelDelta[1] / 256.0 / scale : 0);

    const halfWidth = scaleWidth / 2 / 256.0;
    const halfHeight = scaleHeight / 2 / 256.0;

    const tileMinX = Math.floor(tileCenterX - halfWidth);
    const tileMaxX = Math.floor(tileCenterX + halfWidth);

    const tileMinY = Math.floor(tileCenterY - halfHeight);
    const tileMaxY = Math.floor(tileCenterY + halfHeight);

    return {
      tileMinX,
      tileMaxX,
      tileMinY,
      tileMaxY,
      tileCenterX,
      tileCenterY,
      roundedZoom,
      zoomDelta: zoomDelta || 0,
      scaleWidth,
      scaleHeight,
      scale
    };
  }

  // display the tiles

  renderTiles() {
    const { oldTiles } = this.state;
    const { dprs } = this.props;
    const mapUrl = this.props.provider || wikimedia;

    const {
      tileMinX,
      tileMaxX,
      tileMinY,
      tileMaxY,
      tileCenterX,
      tileCenterY,
      roundedZoom,
      scaleWidth,
      scaleHeight,
      scale
    } = this.tileValues(this.state);

    let tiles = [];

    for (let i = 0; i < oldTiles.length; i++) {
      let old = oldTiles[i];
      let zoomDiff = old.roundedZoom - roundedZoom;

      if (Math.abs(zoomDiff) > 4 || zoomDiff === 0) {
        continue;
      }

      let pow = 1 / Math.pow(2, zoomDiff);
      let xDiff = -(tileMinX - old.tileMinX * pow) * 256;
      let yDiff = -(tileMinY - old.tileMinY * pow) * 256;

      let xMin = Math.max(old.tileMinX, 0);
      let yMin = Math.max(old.tileMinY, 0);
      let xMax = Math.min(old.tileMaxX, Math.pow(2, old.roundedZoom) - 1);
      let yMax = Math.min(old.tileMaxY, Math.pow(2, old.roundedZoom) - 1);

      for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
          tiles.push({
            key: `${x}-${y}-${old.roundedZoom}`,
            url: mapUrl(x, y, old.roundedZoom),
            srcSet: srcSet(dprs, mapUrl, x, y, old.roundedZoom),
            left: xDiff + (x - old.tileMinX) * 256 * pow,
            top: yDiff + (y - old.tileMinY) * 256 * pow,
            width: 256 * pow,
            height: 256 * pow,
            active: false
          });
        }
      }
    }

    let xMin = Math.max(tileMinX, 0);
    let yMin = Math.max(tileMinY, 0);
    let xMax = Math.min(tileMaxX, Math.pow(2, roundedZoom) - 1);
    let yMax = Math.min(tileMaxY, Math.pow(2, roundedZoom) - 1);

    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tiles.push({
          key: `${x}-${y}-${roundedZoom}`,
          url: mapUrl(x, y, roundedZoom),
          srcSet: srcSet(dprs, mapUrl, x, y, roundedZoom),
          left: (x - tileMinX) * 256,
          top: (y - tileMinY) * 256,
          width: 256,
          height: 256,
          active: true
        });
      }
    }

    const boxStyle: CSSProperties = {
      width: scaleWidth,
      height: scaleHeight,
      position: "absolute",
      top: 0,
      left: 0,
      overflow: "hidden",
      willChange: "transform",
      transform: `scale(${scale}, ${scale})`,
      transformOrigin: "top left"
    };
    const boxClassname = this.props.boxClassname || "";

    const left = -((tileCenterX - tileMinX) * 256 - scaleWidth / 2);
    const top = -((tileCenterY - tileMinY) * 256 - scaleHeight / 2);

    const tilesStyle: CSSProperties = {
      position: "absolute",
      width: (tileMaxX - tileMinX + 1) * 256,
      height: (tileMaxY - tileMinY + 1) * 256,
      willChange: "transform",
      transform: `translate(${left}px, ${top}px)`
    };

    return (
      <div style={boxStyle} className={boxClassname}>
        <div style={tilesStyle}>
          {tiles.map((tile) => (
            <img
              alt=""
              key={tile.key}
              src={tile.url}
              srcSet={tile.srcSet}
              width={tile.width}
              height={tile.height}
              onLoad={() => this.imageLoaded(tile.key)}
              style={{
                position: "absolute",
                left: tile.left,
                top: tile.top,
                willChange: "transform",
                //@ts-ignore
                transform: tile.transform,
                transformOrigin: "top left",
                opacity: 1
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  render() {
    const {
      touchEvents,
      twoFingerDrag,
      metaWheelZoom,
      metaWheelZoomWarning,
      twoFingerDragWarning
    } = this.props;
    const { width, height, showWarning, warningType } = this.state;

    const containerStyle: React.CSSProperties = {
      width: this.props.width ? width : "100%",
      height: this.props.height ? height : "100%",
      position: "relative",
      display: "inline-block",
      overflow: "hidden",
      background: "#dddddd",
      touchAction: touchEvents
        ? twoFingerDrag
          ? "pan-x pan-y"
          : "none"
        : "auto"
    };

    const hasSize = !!(width && height);

    return (
      <MapContext.Provider value={this.state}>
        <div
          style={containerStyle}
          ref={this._el}
          onDoubleClick={this.handleDblClick}
        >
          {hasSize && this.renderTiles()}
          {this.props.children}
          {metaWheelZoom || twoFingerDrag ? (
            <MapWarning
              showWarning={showWarning}
              warningType={warningType}
              twoFingerDragWarning={twoFingerDragWarning}
              metaWheelZoomWarning={metaWheelZoomWarning}
            />
          ) : null}
        </div>
      </MapContext.Provider>
    );
  }
}

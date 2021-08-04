import React from "react";
import { MapState } from "./context";
import { MapStateUpdater, TLatLng, MapDeltaUpdater, TPoint } from "./types";
import { eventManager } from "./utils/eventManager";
import {
  latLngToPoint,
  pointToLatLng,
  project,
  unproject
} from "./utils/projection";
import styles from "./styles.module.css";

export interface MapProps {
  defaultCenter?: TLatLng;
  defaultZoom?: number;
}

export class Map extends React.Component<MapProps, MapState> {
  update: MapStateUpdater = (state) => this.setState(state as any);
  updateDelta: MapDeltaUpdater = (dp, dz) => {
    this.setState(state => {
      const zoom = Math.min(Math.max(state.zoom + dz, 1), 18);
      const point = project(state.center, zoom);
      const addedPoint: TPoint = [point[0] + dp[0], point[1] + dp[1]];
      const center = unproject(addedPoint, zoom);
      console.log("set", point, state.center, dp, addedPoint, center);

      return {
        center,
        zoom
      };
    });
  };
  _em = eventManager(this.update, this.updateDelta);

  state: MapState = {
    width: 0,
    height: 0,
    center: this.props.defaultCenter || [0, 0],
    zoom: this.props.defaultZoom || 1
  };

  container: HTMLDivElement | null = null;
  initRef = (r: HTMLDivElement | null) => {
    if (r) {
      this._em.init(r);
    } else {
      this._em.dispose();
    }
    this.container = r;
  };

  render() {
    const { width, height, center, zoom } = this.state;
    const point = latLngToPoint(center, center, zoom, width, height);
    console.log("render", center, point);

    const size = zoom * 20;
    return (
      <div ref={this.initRef} className={styles.map}>
        {width && height && (
          <div
            style={{
              position: "absolute",
              left: point[0] - size / 2,
              top: point[1] - size / 2,
              width: size,
              height: size,
              background: "red"
            }}
          >
            map {width} {height} {center[0]} {center[1]} {zoom}
          </div>
        )}
      </div>
    );
  }
}

import React, { useContext } from "react";
import { render } from "react-dom";
import Map from "./Map";

import "./styles.css";
import { MapContext } from "./context";
import { Attributtion } from "./Attributtion";
import { Marker } from "./Marker";
import { Polygon } from "./Polygon";
import { osm } from "./providers";

function Test(p: any) {
  const map = useContext(MapContext);

  const [left, top] = map.latLngToPixel(p.anchor);

  return (
    <div style={{ position: "absolute", left, top, border: "1px solid black" }}>
      sdf
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <div>Trying to modernize a bit more Pigeon maps</div>
      <Map
        defaultCenter={[50.879, 4.6997]}
        defaultZoom={12}
        width={600}
        height={400}
        provider={osm}
      >
        <Test anchor={[50.879, 4.6997]} />
        <svg
          style={{
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            position: "absolute"
          }}
        >
          <Polygon
            coords={[
              [50.879, 4.6997],
              [50.879, 4.5997],
              [50.859, 4.6997],
              [50.879, 4.6997]
            ]}
          />
        </svg>
        <Marker anchor={[50.879, 4.6997]} />
        <Attributtion />
      </Map>
    </div>
  );
}

const rootElement = document.getElementById("root");
render(<App />, rootElement);

import React from "react";
import { render } from "react-dom";

import { Map } from "./map/Map";

import "./styles.css";

function App() {
  return (
    <div className="App">
      <Map />
    </div>
  );
}

const rootElement = document.getElementById("root");
render(<App />, rootElement);

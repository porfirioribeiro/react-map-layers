import React from "react";

interface AttributtionProps {
  attribution?: boolean;
  attributionPrefix?: boolean;
}

export function Attributtion({
  attribution,
  attributionPrefix
}: AttributtionProps) {
  if (attribution === false) {
    return null;
  }

  const style = {
    position: "absolute",
    bottom: 0,
    right: 0,
    fontSize: "11px",
    padding: "2px 5px",
    background: "rgba(255, 255, 255, 0.7)",
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    color: "#333"
  };

  const linkStyle = {
    color: "#0078A8",
    textDecoration: "none"
  };

  return (
    <div key="attr" className="pigeon-attribution" style={style}>
      {attributionPrefix === false ? null : (
        <span>
          {attributionPrefix || (
            <a href="https://pigeon-maps.js.org/" style={linkStyle}>
              Pigeon
            </a>
          )}
          {" | "}
        </span>
      )}
      {attribution || (
        <span>
          {" © "}
          <a href="https://www.openstreetmap.org/copyright" style={linkStyle}>
            OpenStreetMap
          </a>
          {" contributors"}
        </span>
      )}
    </div>
  );
}

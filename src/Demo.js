import React from "react";
import Tree from "./Tree";
import logo from "./logo.svg";
import "./Demo.css";

export default function() {
  return (
    <div className="Demo">
      <div className="Demo-sidebar">
        <header>
          <img src={logo} className="Demo-logo" alt="PingThings" />
        </header>
        <div className="Demo-version">{"BTrDB Viz v2018.03.19"}</div>
        <div className="Demo-notes">
          <p>
            Zooming into a BTrDB tree is achieved by descending its branches, so
            we show each descent as magnifiying a node.
          </p>
          <h3>Controls</h3>
          <ul>
            <li>Click nodes</li>
            <li>Enter to animate</li>
            <li>Shift+Mouse ↕ to scrub</li>
          </ul>
          <h3>Changes</h3>
          <ul>
            <li>Replace plot with bounding boxes</li>
          </ul>
          <h3>Next</h3>
          <ul>
            <li>Explanatory Annotations</li>
          </ul>
        </div>
      </div>
      <div className="Demo-body">
        <Tree />
      </div>
    </div>
  );
}

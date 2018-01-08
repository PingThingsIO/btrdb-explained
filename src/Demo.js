import React from "react";
import Viz from "./Viz";
import logo from "./logo.svg";
import "./Demo.css";

export default function() {
  return (
    <div className="Demo">
      <div className="Demo-sidebar">
        <header>
          <img src={logo} className="Demo-logo" alt="PingThings" />
        </header>
        <div className="Demo-version">{"BTrDB Viz v2018.01.07"}</div>
        <div className="Demo-notes">
          <p>
            Zooming into a BTrDB tree is achieved by descending its branches, so
            we show each descent as magnifiying a node.
          </p>
          <h3>Controls</h3>
          <ul>
            <li>Mouse ↕ to animate</li>
          </ul>
          <h3>Changes</h3>
          <ul>
            <li>Traverse random nodes</li>
          </ul>
          <h3>Next</h3>
          <ul>
            <li>Show dates</li>
            <li>Show writes</li>
            <li>Show version layers</li>
          </ul>
        </div>
      </div>
      <div className="Demo-body">
        <Viz />
      </div>
    </div>
  );
}

import React, { Component } from "react";
import { pointLookup, randomMesh, rippleMap } from "./geometry";

class Ping extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // canvas
      width: 1024,
      height: 600
    };
    const { points, triangles, graph } = this.randomMesh();
    this.state.points = points;
    this.state.triangles = triangles;
    this.state.graph = graph;
    const { distMap } = rippleMap(graph, 0);
    this.state.distMap = distMap;
  }
  componentWillMount() {
    this.computeDerivedState(this.props, this.state);
  }
  componentWillUpdate(nextProps, nextState) {
    this.computeDerivedState(nextProps, nextState);
  }
  computeDerivedState = (props, state) => {
    const pixelRatio = window.devicePixelRatio || 1;
    this.ds = {
      pixelRatio
    };
  };
  randomMesh = () => {
    const { width, height } = this.state;
    const pad = 20;
    return randomMesh({
      n: 18,
      xdomain: [pad, width - pad],
      ydomain: [pad, height - pad],
      minDist: 60,
      minArea: Math.pow(120, 2) / 2,
      minAngle: 20 * Math.PI / 180
    });
  };
  drawTriangles = ctx => {
    const { points, triangles } = this.state;

    ctx.fillStyle = "#f5f4f7";
    for (let indexes of triangles) {
      const [a, b, c] = pointLookup(points, indexes);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.closePath();
      ctx.fill();
    }
  };
  drawGraph = ctx => {
    const { points, graph } = this.state;
    ctx.beginPath();
    for (let i = 0; i < graph.length; i++) {
      for (let j of Object.keys(graph[i])) {
        if (i < j) {
          const [a, b] = pointLookup(points, [i, j]);
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
        }
      }
    }
    ctx.strokeStyle = "#789";
    ctx.stroke();
  };
  drawRippleMap = ctx => {
    const { points, distMap } = this.state;
    ctx.beginPath();
    for (let i of Object.keys(distMap)) {
      for (let j of Object.keys(distMap[i].distTo)) {
        const [a, b] = pointLookup(points, [i, j]);
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = "red";
    ctx.stroke();
  };
  draw = canvas => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { pixelRatio } = this.ds;
    const { width, height } = this.state;
    ctx.save();
    ctx.scale(pixelRatio, pixelRatio);
    ctx.clearRect(0, 0, width, height);
    this.drawTriangles(ctx);
    this.drawGraph(ctx);
    this.drawRippleMap(ctx);
    ctx.restore();
  };
  render() {
    const { width, height } = this.state;
    const { pixelRatio } = this.ds;
    return (
      <canvas
        ref={node => {
          this.canvas = node;
          this.draw(node);
        }}
        width={width * pixelRatio}
        height={height * pixelRatio}
        style={{ width: `${width}px`, height: `${height}px` }}
      />
    );
  }
}

export default Ping;

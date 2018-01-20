import React, { Component } from "react";
import * as d3array from "d3-array";
import * as d3scale from "d3-scale";
import * as d3interpolate from "d3-interpolate";
import { pointLookup, randomMesh, rippleMap, dist } from "./geometry";

class Ping extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // canvas
      width: 1024,
      height: 600,
      animDist: 0,
      animTail: 100
    };
    const { points, triangles, graph } = this.randomMesh();
    const root = Math.floor(Math.random() * points.length);
    const { distMap, totalDist } = rippleMap(graph, root);
    this.state.points = points;
    this.state.triangles = triangles;
    this.state.graph = graph;
    this.state.distMap = distMap;
    this.state.totalDist = totalDist;
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
    const n = 20;
    return randomMesh({
      n,
      xdomain: [pad, width - pad],
      ydomain: [pad, height - pad],
      minDist: 60,
      minArea: width * height / n / 6,
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
    const { points, distMap, animDist, animTail } = this.state;
    for (let i of Object.keys(distMap)) {
      const node = distMap[i];
      const start = node.distFromRoot;
      const maxChildDist = d3array.max(Object.values(node.distTo));
      for (let j of Object.keys(node.distTo)) {
        const childDist = node.distTo[j];
        const scale = d3scale
          .scaleLinear()
          .domain([start, start + childDist])
          .range([0, 1])
          .clamp(true);
        const t0 = scale(animDist);
        const t1 = scale(animDist - animTail);
        if (t0 > 0 && t1 < 1) {
          const [src, dst] = pointLookup(points, [i, j]);
          const point = t => d3interpolate.interpolate(src, dst)(t);

          const start = point(t0);
          const end = point(t1);

          if (maxChildDist === childDist) {
            const r = dist(point((t0 + t1) / 2), src);
            ctx.beginPath();
            ctx.ellipse(src[0], src[1], r, r, 0, 0, 2 * Math.PI);
            ctx.lineWidth = dist(start, end);
            ctx.strokeStyle = d3interpolate.interpolate(
              "#789",
              "rgba(0,0,0,0)"
            )(0.8);
            ctx.stroke();
          }

          // draw dist
          ctx.beginPath();
          ctx.strokeStyle = "#789";
          ctx.lineWidth = 3;
          ctx.moveTo(start[0], start[1]);
          ctx.lineTo(end[0], end[1]);
          ctx.stroke();
        }
      }
    }
  };
  draw = canvas => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { pixelRatio } = this.ds;
    const { width, height } = this.state;
    ctx.save();
    ctx.scale(pixelRatio, pixelRatio);
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = 0.4;
    this.drawTriangles(ctx);
    this.drawGraph(ctx);
    ctx.globalAlpha = 1;
    this.drawRippleMap(ctx);
    ctx.restore();
  };
  onMouseMove = e => {
    const rect = this.canvas.getBoundingClientRect();
    // const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { height, totalDist, animTail } = this.state;
    const pad = 40;
    const scale = d3scale
      .scaleLinear()
      .domain([pad, height - pad])
      .range([0, totalDist + animTail])
      .clamp(true);
    const animDist = scale(y);
    this.setState({ animDist });
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
        onMouseMove={this.onMouseMove}
      />
    );
  }
}

export default Ping;

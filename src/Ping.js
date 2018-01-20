import React, { Component } from "react";
import * as d3array from "d3-array";
import * as d3scale from "d3-scale";
import * as d3interpolate from "d3-interpolate";

import { pointLookup, randomMesh, rippleMap, dist } from "./geometry";
import logo from "./logo.svg";
import { backgroundGray, supportGray, popGreen, popOrange } from "./colors";

const frontierColors = {
  green: d3interpolate.interpolate(popGreen, "rgba(255,255,255,0)")(0.4),
  orange: d3interpolate.interpolate(popOrange, "rgba(255,255,255,0)")(0.4),
  gray: d3interpolate.interpolate(backgroundGray, "rgba(255,255,255,0)")(0.4)
};

class Ping extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // canvas
      width: 1024,
      height: 600,
      animDist: 0,
      animTail: 180
    };
    this.state.animData = this.randomAnimData();
    this.logo = new Image();
    this.logo.src = logo;
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
  randomAnimData = () => {
    const { points, triangles, graph } = this.randomMesh();
    const root = Math.floor(Math.random() * points.length);
    const { distMap, totalDist } = rippleMap(graph, root);
    const frontierTypes = points.map(_ => {
      const t = Math.random();
      if (t < 0.1) return "green";
      if (t < 0.2) return "orange";
      return "gray";
    });
    return { points, triangles, graph, distMap, totalDist, frontierTypes };
  };
  drawTriangles = ctx => {
    const { points, triangles } = this.state.animData;

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
    const { points, graph } = this.state.animData;
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
    ctx.strokeStyle = supportGray;
    ctx.stroke();
  };
  drawRipples = (ctx, layer, layerOpt) => {
    const { animDist, animTail, animData } = this.state;
    const { points, distMap, frontierTypes } = animData;
    for (let i of Object.keys(distMap)) {
      const node = distMap[i];
      const start = node.distFromRoot;
      const maxChildDist = d3array.max(Object.values(node.distTo));
      for (let j of Object.keys(node.distTo)) {
        const childDist = node.distTo[j];
        const end = start + childDist;
        const scale = d3scale
          .scaleLinear()
          .domain([start, end])
          .range([0, 1])
          .clamp(true);
        const headT = scale(animDist);
        const tailT = scale(animDist - animTail);
        if (headT > 0 && tailT < 1) {
          const [src, dst] = pointLookup(points, [i, j]);
          const point = t => d3interpolate.interpolate(src, dst)(t);

          const head = point(headT);
          const tail = point(tailT);

          switch (layer) {
            case "frontier":
              if (maxChildDist === childDist) {
                const r = dist(point((headT + tailT) / 2), src);
                ctx.beginPath();
                ctx.ellipse(src[0], src[1], r, r, 0, 0, 2 * Math.PI);
                ctx.lineWidth = dist(head, tail);
                const type = frontierTypes[i];
                if (
                  (layerOpt === "gray" && type === "gray") ||
                  (layerOpt === "pop" && type !== "gray")
                ) {
                  ctx.strokeStyle = frontierColors[type];
                  ctx.stroke();
                }
              }
              break;
            case "branches":
              ctx.strokeStyle = ctx.fillStyle = "#fff";
              ctx.beginPath();
              ctx.lineWidth = 4;
              ctx.moveTo(head[0], head[1]);
              ctx.lineTo(tail[0], tail[1]);
              ctx.stroke();

              const maxR = 8;
              const padR = maxR * 3;
              const r = d3scale
                .scaleLinear()
                .domain([
                  end,
                  end + padR,
                  end + animTail - padR,
                  end + animTail
                ])
                .range([0, maxR, maxR, 0])
                .clamp(true)(animDist);
              ctx.beginPath();
              ctx.ellipse(dst[0], dst[1], r, r, 0, 0, 2 * Math.PI);
              ctx.fill();
              break;
            default:
              break;
          }
        }
      }
    }
  };
  drawLogo = ctx => {
    const s = 1;
    const w = this.logo.width * s;
    const h = this.logo.height * s;
    const x = this.state.width / 2 - w / 2;
    const y = this.state.height / 2 - h / 2;
    ctx.drawImage(this.logo, x, y, w, h);
  };
  draw = canvas => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { pixelRatio } = this.ds;
    const { width, height } = this.state;
    ctx.save();
    ctx.scale(pixelRatio, pixelRatio);
    ctx.fillStyle = backgroundGray;
    ctx.clearRect(0, 0, width, height);
    // ctx.fillRect(0, 0, width, height);
    // this.drawTriangles(ctx);
    // this.drawGraph(ctx);
    this.drawRipples(ctx, "frontier", "gray");
    this.drawRipples(ctx, "frontier", "pop");
    this.drawRipples(ctx, "branches");
    this.drawLogo(ctx);
    ctx.restore();
  };
  onMouseMove = e => {
    const rect = this.canvas.getBoundingClientRect();
    // const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { height, animTail } = this.state;
    const { totalDist } = this.state.animData;
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
        style={{
          position: "absolute",
          width: `${width}px`,
          height: `${height}px`
        }}
        onMouseMove={this.onMouseMove}
      />
    );
  }
}

export default Ping;

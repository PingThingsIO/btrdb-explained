import React, { Component } from "react";
import delaunay from "delaunay-fast";

function randomPoints(n, xmin, xmax, ymin, ymax, minDist) {
  const points = [];
  const xrange = xmax - xmin;
  const yrange = ymax - ymin;
  const randPoint = () => [
    Math.random() * xrange + xmin,
    Math.random() * yrange + ymin
  ];
  const dist = ([x0, y0], [x1, y1]) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    return Math.sqrt(dx * dx + dy * dy);
  };
  const isPointValid = a => {
    for (let b of points) {
      if (dist(a, b) < minDist) return false;
    }
    return true;
  };
  const randValidPoint = () => {
    while (true) {
      const p = randPoint();
      if (isPointValid(p)) return p;
    }
  };
  for (let i = 0; i < n; i++) {
    points.push(randValidPoint());
  }
  return points;
}

function triangulate(points) {
  const indices = delaunay.triangulate(points);
  const triangles = [];
  for (let i = 0; i < indices.length; i += 3) {
    triangles.push(indices.slice(i, i + 3));
  }
  return triangles;
}

class Ping extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // canvas
      width: 1024,
      height: 600
    };
    this.state.points = this.randomPoints();
  }
  componentWillMount() {
    this.computeDerivedState(this.props, this.state);
  }
  componentWillUpdate(nextProps, nextState) {
    this.computeDerivedState(nextProps, nextState);
  }
  computeDerivedState = (props, state) => {
    const pixelRatio = window.devicePixelRatio || 1;
    const triangles = triangulate(state.points);

    this.ds = {
      pixelRatio,
      triangles
    };
  };
  randomPoints = () => {
    const { width, height } = this.state;
    const points = randomPoints(12, 0, width, 0, height, 60);
    return points;
  };
  drawTriangles = ctx => {
    const { points } = this.state;
    const { triangles } = this.ds;

    ctx.strokeStyle = "#789";
    for (let [a, b, c] of triangles) {
      const pa = points[a];
      const pb = points[b];
      const pc = points[c];
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
      ctx.lineTo(pc[0], pc[1]);
      ctx.closePath();
      ctx.stroke();
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
    this.drawTriangles(ctx);
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

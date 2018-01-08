import React, { Component } from "react";
import * as d3scale from "d3-scale";
// import * as d3ease from "d3-ease";
// import * as d3transition from "d3-transition";
// import * as d3shape from "d3-shape";

class Viz extends Component {
  constructor(props) {
    super(props);
    this.state = {
      width: 600,
      height: 600,
      numCells: 64,
      hover: {
        level: null,
        cell: null
      },
      path: [],
      pathAnim: 1,
      cellW: 8,
      cellH: 12,
      treeX: 40,
      treeY: 20,
      levelOffset: 5
    };
    for (let i = 0; i < 10; i++) {
      this.state.path.push(Math.floor(Math.random() * this.state.numCells));
    }
    this.state.pathAnim = this.state.path.length;
    this.createD3Objects();
  }
  componentWillMount() {
    this.computeDerivedState(this.props, this.state);
  }
  componentWillUpdate(nextProps, nextState) {
    this.computeDerivedState(nextProps, nextState);
  }
  createD3Objects = () => {
    this.d3 = {};
  };
  computeDerivedState = (props, state) => {
    const { cellW, cellH } = state;

    const pixelRatio = window.devicePixelRatio || 1;

    const cellX = d3scale
      .scaleLinear()
      .domain([0, 1])
      .range([0, cellW]);
    const cellY = d3scale
      .scaleLinear()
      .domain([0, 1])
      .range([0, cellH]);

    this.ds = {
      pixelRatio,
      cellX,
      cellY
    };
  };
  drawCell = (ctx, level, cell) => {
    const { cellH, cellW, path } = this.state;
    const child = path[level + 1];
    ctx.globalAlpha = child === cell ? 1 : 0.1;
    ctx.strokeRect(0, 0, cellW, cellH);
  };
  drawNode = (ctx, level) => {
    const { numCells, cellW, cellH, path, levelOffset, pathAnim } = this.state;
    const parent = path[level];

    const { cellX, cellY } = this.ds;

    const t = d3scale
      .scaleLinear()
      .domain([level, level + 1])
      .range([0, 1])
      .clamp(true)(pathAnim);

    if (t === 0) return;

    const dip = 1 / levelOffset;

    const domain = [0, dip, 1];
    const scaleX0 = d3scale
      .scaleLinear()
      .domain(domain)
      .range([cellX(parent), cellX(parent), cellX(0)])
      .clamp(true);
    const scaleX1 = d3scale
      .scaleLinear()
      .domain(domain)
      .range([cellX(parent + 1), cellX(parent + 1), cellX(numCells)])
      .clamp(true);
    const scaleY = d3scale
      .scaleLinear()
      .domain(domain)
      .range([cellY(-levelOffset), cellY(-levelOffset * (1 - dip)), cellY(0)])
      .clamp(true);

    const x0 = scaleX0(t);
    const x1 = scaleX1(t);
    const y = scaleY(t);
    const w = x1 - x0;

    ctx.save();
    ctx.fillStyle = "rgba(80,100,120, 0.15)";
    if (level > 0 && t > dip) {
      const ytop = scaleY(0) + cellH + 1;
      ctx.beginPath();
      ctx.moveTo(scaleX0(0), ytop);
      ctx.lineTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.lineTo(scaleX1(0), ytop);
      ctx.fill();
    }

    ctx.translate(x0, y);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, cellH);
    ctx.strokeStyle = "#555";
    if (t === 1) {
      ctx.save();
      for (let cell = 0; cell < numCells; cell++) {
        this.drawCell(ctx, level, cell);
        ctx.translate(cellW, 0);
      }
      ctx.restore();
    }
    ctx.strokeRect(0, 0, w, cellH);
    ctx.restore();
  };
  drawTree = ctx => {
    ctx.save();
    const { treeX, treeY, cellH, levelOffset, path } = this.state;
    ctx.translate(treeX, treeY);
    for (let level = 0; level < path.length; level++) {
      this.drawNode(ctx, level);
      ctx.translate(0, cellH * levelOffset);
    }
    ctx.restore();
  };
  draw = canvas => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { pixelRatio } = this.ds;
    const { width, height } = this.state;
    ctx.save();
    ctx.scale(pixelRatio, pixelRatio);
    ctx.clearRect(0, 0, width, height);
    this.drawTree(ctx);
    ctx.restore();
  };
  onMouseMove = e => {
    const rect = this.canvas.getBoundingClientRect();
    // const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { height, path } = this.state;
    const pad = 40;
    const scale = d3scale
      .scaleLinear()
      .domain([pad, height - pad])
      .range([1, path.length])
      .clamp(true);
    const t = scale(y);
    this.setState({ pathAnim: t });
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

export default Viz;

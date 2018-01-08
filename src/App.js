import React, { Component } from "react";
import * as d3scale from "d3-scale";
import * as d3ease from "d3-ease";
import * as d3transition from "d3-transition";
import * as d3shape from "d3-shape";
import "./App.css";

class App extends Component {
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
      path: [4, 2, 3, 3, 8, 9, 5, 1, 0, 6],
      pathAnim: 1,
      cellW: 8,
      cellH: 12,
      treeX: 40,
      treeY: 20,
      padLevels: 5
    };
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
    const { padLevels, cellH } = state;

    const pixelRatio = window.devicePixelRatio || 1;
    const levelOffset = (padLevels + 1) * cellH;
    this.ds = {
      pixelRatio,
      levelOffset
    };
  };
  drawCell = (ctx, level, cell) => {
    const { cellH, cellW } = this.state;
    ctx.strokeRect(0, 0, cellW, cellH);
  };
  drawNode = (ctx, level) => {
    const { numCells, cellW, cellH, path, padLevels, pathAnim } = this.state;
    const { levelOffset } = this.ds;

    if (pathAnim < level) return;
    ctx.save();
    const parent = path[level];

    const maxW = numCells * cellW;

    const domain = [level, level + 1];
    const scaleW = d3scale
      .scaleLinear()
      .domain(domain)
      .range([cellW, maxW])
      .clamp(true);
    const scaleX = d3scale
      .scaleLinear()
      .domain(domain)
      .range([cellW * parent, 0])
      .clamp(true);
    const scaleY = d3scale
      .scaleLinear()
      .domain(domain)
      .range([-levelOffset, 0])
      .clamp(true);

    ctx.translate(scaleX(pathAnim), scaleY(pathAnim));
    const w = scaleW(pathAnim);
    if (w !== maxW) {
      ctx.strokeRect(0, 0, w, cellH);
    } else {
      for (let cell = 0; cell < numCells; cell++) {
        this.drawCell(ctx, level, cell);
        ctx.translate(cellW, 0);
      }
    }
    ctx.restore();
  };
  drawTree = ctx => {
    ctx.save();
    const { treeX, treeY, cellH, path } = this.state;
    const { levelOffset } = this.ds;
    ctx.translate(treeX, treeY);
    for (let level = 0; level < path.length; level++) {
      this.drawNode(ctx, level);
      ctx.translate(0, levelOffset);
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
    const y = e.pageY;
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
        ref={node => this.draw(node)}
        width={width * pixelRatio}
        height={height * pixelRatio}
        style={{ width: `${width}px`, height: `${height}px` }}
        onMouseMove={this.onMouseMove}
      />
    );
  }
}

export default App;

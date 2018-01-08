import React, { Component } from "react";
import "./App.css";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      width: 1024,
      height: 800,
      numCells: 64,
      hover: {
        level: null,
        cell: null
      },
      nodes: [
        { depth: 0, i: 4, t: 1 },
        { depth: 1, i: 2, t: 1 },
        { depth: 2, i: 3, t: 1 },
        { depth: 3, i: 3, t: 1 },
        { depth: 4, i: 8, t: 1 },
        { depth: 5, i: 9, t: 1 },
        { depth: 6, i: 5, t: 1 },
        { depth: 7, i: 1, t: 1 },
        { depth: 8, i: 0, t: 1 },
        { depth: 9, i: 6, t: 1 }
      ],
      cellW: 8,
      cellH: 12,
      treeX: 100,
      treeY: 100,
      treePad: 48
    };
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
  drawCell = (ctx, node, cell) => {
    const { cellH, cellW } = this.state;
    ctx.strokeRect(0, 0, cellW, cellH);
  };
  drawNode = (ctx, node) => {
    const { numCells, cellW } = this.state;
    ctx.save();
    for (let cell = 0; cell < numCells; cell++) {
      this.drawCell(ctx, node, cell);
      ctx.translate(cellW, 0);
    }
    ctx.restore();
  };
  drawTree = ctx => {
    ctx.save();
    const { treeX, treeY, treePad, cellH, nodes } = this.state;
    ctx.translate(treeX, treeY);
    for (let node of nodes) {
      this.drawNode(ctx, node);
      ctx.translate(0, cellH + treePad);
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
  render() {
    const { width, height } = this.state;
    const { pixelRatio } = this.ds;
    return (
      <canvas
        ref={node => this.draw(node)}
        width={width * pixelRatio}
        height={height * pixelRatio}
        style={{ width: `${width}px`, height: `${height}px` }}
        onMouseMove={() => console.log("move")}
        onClick={() => console.log("click")}
      />
    );
  }
}

export default App;

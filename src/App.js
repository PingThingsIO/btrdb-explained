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
      path: [4, 2, 3, 3, 8, 9, 5, 1, 0, 6],
      pathAnim: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
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
  drawCell = (ctx, level, cell) => {
    const { cellH, cellW } = this.state;
    ctx.strokeRect(0, 0, cellW, cellH);
  };
  drawNode = (ctx, level) => {
    const { numCells, cellW } = this.state;
    ctx.save();
    for (let cell = 0; cell < numCells; cell++) {
      this.drawCell(ctx, level, cell);
      ctx.translate(cellW, 0);
    }
    ctx.restore();
  };
  drawTree = ctx => {
    ctx.save();
    const { treeX, treeY, treePad, cellH, path } = this.state;
    ctx.translate(treeX, treeY);
    for (let level = 0; level < path.length; level++) {
      this.drawNode(ctx, level);
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

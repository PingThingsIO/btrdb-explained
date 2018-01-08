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
      path: [],
      pathAnim: [],
      cellW: 10,
      cellH: 10,
      treeX: 100,
      treeY: 100,
      treePad: 32
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
  drawTree = ctx => {
    // TODO: draw tree
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

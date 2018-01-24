import React, { Component } from "react";
import * as d3scale from "d3-scale";
import { scaleTimeNano } from "./scaleTimeNano";
import * as d3interpolate from "d3-interpolate";
import * as d3ease from "d3-ease";
import * as d3transition from "d3-transition";
import hexToRgba from "hex-to-rgba";
// import * as d3shape from "d3-shape";

const nodeLengthLabels = [
  "146 years",
  "2.28 years",
  "13.03 days",
  "4.88 hours",
  "4.58 min",
  "4.29 s",
  "67.11 ms",
  "1.05 ms",
  "16.38 µs",
  "256 ns",
  "4 ns"
];

const theme = {
  green: "#1eb7aa",
  orange: "#db7b35"
};

const colors = {
  cellFillExpanded: "rgba(80,100,120, 0.15)",
  cellFillHighlight: hexToRgba(theme.green, 0.4),
  cellWall: hexToRgba("#555", 0.1),
  cellWallExpanded: "#555",
  cellWallHighlight: theme.green,

  unixEpoch: theme.green,
  now: theme.orange,
  dateTick: "rgba(90,110,100, 0.5)",
  scrub: "#e7e8e9",
  zoomCone: "rgba(80,100,120, 0.15)"
};

class Tree extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // canvas
      width: 1024,
      height: 720,

      numCells: 64, // cells in a tree row
      numSquareCells: 8, // cells in a calendar row

      path: [0], // first of path is ignored for generality
      pathAnim: 1, // float representing what index of the path we are showing

      // Tree placement and sizing
      treeCellW: 8,
      treeCellH: 10,
      treeX: 40,
      treeY: 34,
      levelOffset: 7,
      cellHighlight: null,

      // Calendar placement and sizing
      calCellSize: 38,
      calX: 700,
      calY: 40,

      rootStart: -1152921504606846976,
      rootResolution: 56

      // TODO:
      // selectionStart (path)
      // selectionEnd (path)

      // TODO:
      // path has to allow mid-level resolution cells
      // idea: mouseToPath returns {level, numCells}
    };
    for (let i = 1; i < 10; i++) {
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
  componentDidMount() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }
  componentWillUnmount() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }
  createD3Objects = () => {
    this.d3 = {};
  };
  computeDerivedState = (props, state) => {
    const {
      treeCellW,
      treeCellH,
      calCellSize,
      path,
      rootStart,
      rootResolution,
      numCells,
      numSquareCells,
      levelOffset
    } = state;

    // `dip` is how long `t` will spend dropping the node before expanding it.
    const dipTime = 1 / levelOffset;

    const pixelRatio = window.devicePixelRatio || 1;

    // maps tree cell units to pixels
    const treeColX = d3scale
      .scaleLinear()
      .domain([0, 1])
      .range([0, treeCellW]);
    const treeRowY = d3scale
      .scaleLinear()
      .domain([0, 1])
      .range([0, treeCellH]);

    // maps calendar cell units to pixels
    const calColX = d3scale
      .scaleLinear()
      .domain([0, 1])
      .range([0, calCellSize]);
    const calRowY = d3scale
      .scaleLinear()
      .domain([0, 1])
      .range([0, calCellSize]);

    const treeW = treeCellW * numCells;
    const calW = calCellSize * numSquareCells;

    // compute scale for each level
    const pw = res => Math.pow(2, res);
    let start = rootStart;
    let res = rootResolution;
    const treeTimeX = [];
    const calTimeK = [];
    for (let i = 0; i < path.length; i++) {
      const end = start + pw(res) * numCells;
      const domain = [start, end];
      treeTimeX.push(
        scaleTimeNano()
          .domain(domain)
          .range([0, treeW])
      );
      calTimeK.push(
        scaleTimeNano()
          .domain(domain)
          .range([0, calW * numSquareCells])
      );
      if (i + 1 < path.length) {
        start += pw(res) * path[i + 1];
      }
      res -= 6;
    }

    // calendar time to x and row
    const calKX = k => k % calW;
    const calKRow = k => Math.floor(k / calW);

    this.ds = {
      pixelRatio,
      treeW,
      calW,
      treeColX,
      treeRowY,
      treeTimeX,
      calColX,
      calRowY,
      calTimeK,
      calKX,
      calKRow,
      dipTime
    };
  };
  drawTreeCell = (ctx, level, cell) => {
    const { treeCellH, treeCellW, cellHighlight } = this.state;
    const expanded = this.isCellExpanded(level, cell);
    const highlighted =
      cellHighlight &&
      cellHighlight.cell === cell &&
      cellHighlight.level === level;
    if (highlighted) {
      ctx.strokeStyle = colors.cellWallHighlight;
      ctx.fillStyle = colors.cellFillHighlight;
    } else if (expanded) {
      ctx.strokeStyle = colors.cellWallExpanded;
      ctx.fillStyle = colors.cellFillExpanded;
    } else {
      ctx.strokeStyle = colors.cellWall;
      ctx.fillStyle = "rgba(0,0,0,0)";
    }
    ctx.fillRect(0, 0, treeCellW, treeCellH);
    ctx.strokeRect(0, 0, treeCellW, treeCellH);
  };
  drawTreeNode = (ctx, level) => {
    const {
      numCells,
      treeCellW,
      treeCellH,
      path,
      levelOffset,
      pathAnim
    } = this.state;
    const { treeColX, treeRowY, treeTimeX, dipTime } = this.ds;

    // index of the parent
    // (where in the previous level our node is coming from)
    const parent = path[level];

    // `t` controls the animation of this node
    const t = d3scale
      .scaleLinear()
      .domain([level, level + 1])
      .range([0, 1])
      .clamp(true)(pathAnim);

    // do not draw if pathAnim has not reached our level
    if (t === 0) return;

    const domain = [0, dipTime, 1];

    // left side
    const scaleX0 = d3scale
      .scaleLinear()
      .domain(domain)
      .range([treeColX(parent), treeColX(parent), treeColX(0)])
      .clamp(true);

    // right side
    const scaleX1 = d3scale
      .scaleLinear()
      .domain(domain)
      .range([treeColX(parent + 1), treeColX(parent + 1), treeColX(numCells)])
      .clamp(true);

    // top side
    const scaleY = d3scale
      .scaleLinear()
      .domain(domain)
      .range([
        treeRowY(-levelOffset),
        treeRowY(-levelOffset * (1 - dipTime)),
        treeRowY(0)
      ])
      .clamp(true);

    // compute
    const x0 = scaleX0(t);
    const x1 = scaleX1(t);
    const y = scaleY(t);
    const w = x1 - x0;

    ctx.save();

    // Draw zooming cone that connects previous level to this one
    ctx.fillStyle = colors.zoomCone;
    if (level > 0 && t > dipTime) {
      const ytop = scaleY(0) + treeCellH + 1;
      ctx.beginPath();
      ctx.moveTo(scaleX0(0), ytop);
      ctx.lineTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.lineTo(scaleX1(0), ytop);
      ctx.fill();
    }

    // draw mid-resolution blocks (temporary)
    if (level > 0 && t === 1) {
      for (let i = 0; i < 6; i++) {
        ctx.save();
        const x = this.midResStart(parent, i) * treeCellW;
        const y = (-levelOffset + 1 + i) * treeCellH;
        ctx.translate(x, y);
        const numMidCells = Math.pow(2, i);
        for (let j = 0; j < numMidCells; j++) {
          ctx.strokeRect(0, 0, treeCellW, treeCellH);
          ctx.translate(treeCellW, 0);
        }
        ctx.restore();
      }
    }

    // Translate to the topleft corner of box
    ctx.translate(x0, y);

    // Make opaque
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, treeCellH);

    // Draw inner cells
    if (t === 1) {
      ctx.save();
      for (let cell = 0; cell < numCells; cell++) {
        this.drawTreeCell(ctx, level, cell);
        ctx.translate(treeCellW, 0);
      }
      ctx.restore();
    }

    // Draw outer border
    ctx.strokeRect(0, 0, w, treeCellH);

    // Tick font
    ctx.font = "10px sans-serif";
    ctx.textBaseline = "bottom";
    ctx.textAlign = "center";

    // Draw the major _unix epoch_ and _now_ ticks
    if (level === 0) {
      const drawTick = (t, color, title) => {
        const x = treeTimeX[level](t);
        if (x < 0 || x > treeColX(numCells)) return;
        ctx.fillStyle = ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, treeRowY(-0.7));
        ctx.lineTo(x, treeRowY(1));
        ctx.stroke();
        ctx.fillText(title, x, treeRowY(-2));
      };
      drawTick(0, colors.unixEpoch, "unix epoch");
      drawTick(+new Date() * 1e6, colors.now, "now");
    }

    // Draw the date ticks
    if (t === 1) {
      ctx.strokeStyle = ctx.fillStyle = colors.dateTick;
      const drawTick = (t, title) => {
        const x = treeTimeX[level](t);
        ctx.beginPath();
        ctx.moveTo(x, treeRowY(0));
        ctx.lineTo(x, treeRowY(-0.5));
        ctx.stroke();
        ctx.fillText(title, x, treeRowY(-0.75));
      };
      const count = 8;
      const ticks = treeTimeX[level].ticks(count);
      const tickFormat = treeTimeX[level].tickFormat(count);
      for (let i = 0; i < ticks.length; i++) {
        const tickTime = ticks[i];
        // nanosecond ticks sometimes duplicate
        if (ticks[i] !== ticks[i - 1]) {
          drawTick(tickTime, tickFormat(tickTime));
        }
      }
    }

    // Draw the node length
    if (t === 1) {
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(nodeLengthLabels[level], x1 + 28, treeRowY(0.5));
    }

    ctx.restore();
  };
  getTreeHeight = () => {
    const { path, levelOffset, treeCellH } = this.state;
    return (path.length - 1) * levelOffset * treeCellH + treeCellH;
  };
  drawScrubGuide = ctx => {
    const { scrubbing, path, pathAnim } = this.state;
    if (!scrubbing) return;
    ctx.save();
    ctx.strokeStyle = colors.scrub;
    ctx.translate(-30, 0);
    const barH = 32;
    const treeH = this.getTreeHeight();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, treeH);
    ctx.lineWidth = 1;
    ctx.stroke();
    const y = d3scale
      .scaleLinear()
      .domain([1, path.length])
      .range([0, treeH - barH])(pathAnim);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(0, y + barH);
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  };
  drawTree = ctx => {
    ctx.save();
    const { treeX, treeY, treeCellH, levelOffset, path } = this.state;
    ctx.translate(treeX, treeY);
    // this.drawScrubGuide(ctx);
    for (let level = 0; level < path.length; level++) {
      this.drawTreeNode(ctx, level);
      ctx.translate(0, treeCellH * levelOffset);
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
  getMousePos = e => {
    if (!e) return this.lastMouse || { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return (this.lastMouse = { x, y });
  };
  isLevelVisible = level => {
    return level < Math.floor(this.state.pathAnim);
  };
  isCellExpanded = (level, cell) => {
    return this.state.path[level + 1] === cell;
  };
  midResStart = (parent, exp) => {
    // 0 <= parent < 64   (the child node of previous level that we are expanding)
    // 0 <= exp <= 6 (the resolution row => numMidCells = 2^exp)
    const { numCells } = this.state;
    const numMidCells = Math.pow(2, exp);
    return d3scale
      .scaleLinear()
      .domain([0, numCells - 1])
      .range([0, numCells - numMidCells])(parent);
  };
  mouseToPath = (x, y) => {
    const { treeX, treeY, treeCellW, treeCellH, levelOffset } = this.state;

    const cell = Math.floor((x - treeX) / treeCellW);
    const gridY = Math.floor((y - treeY) / treeCellH);
    const level = Math.floor(gridY / levelOffset);
    if (
      cell >= 0 &&
      cell < 64 &&
      gridY % levelOffset === 0 &&
      this.isLevelVisible(level)
    ) {
      return { level, cell };
    }

    // TODO: compute "derived" resolution cells
  };
  scrubAnim = (x, y) => {
    const { treeY, path } = this.state;
    const t = d3scale
      .scaleLinear()
      .domain([treeY, treeY + this.getTreeHeight()])
      .range([1, path.length])
      .clamp(true)(y);
    this.setState({ pathAnim: t });
  };
  onMouseDown = (e, { isDrag }) => {
    const { x, y } = this.getMousePos(e);
    const cellHighlight = this.mouseToPath(x, y);
    if (cellHighlight) {
      const { level, cell } = cellHighlight;
      if (this.isLevelVisible(level + 1) && !this.isCellExpanded(level, cell)) {
        const path = this.state.path.slice(0, level + 1);
        path.push(cell);
        this.setState({ path, pathAnim: level + 2 });
      }
      this.mousedownLevel = level;
      if (!isDrag) {
        this.mousedownCell = cell;
        this.shouldCollapseOnMouseUp = this.isCellExpanded(level, cell);
      } else if (cell !== this.mousedownCell) {
        this.shouldCollapseOnMouseUp = false;
      }
    }
  };
  cancelTransitions = () => {
    d3transition.interrupt("collapse-cell");
    d3transition.interrupt("expand-cell");
    d3transition.interrupt("collapse-all");
    d3transition.interrupt("expand-all");
  };
  onMouseUp = e => {
    this.mousedownLevel = null;
    const { cellHighlight, pathAnim } = this.state;
    if (cellHighlight) {
      const { level, cell } = cellHighlight;
      const parentPath = this.state.path.slice(0, level + 1);
      if (this.isLevelVisible(level + 1)) {
        const interp = d3interpolate.interpolate(pathAnim, level + 1);
        if (this.shouldCollapseOnMouseUp) {
          this.cancelTransitions();
          d3transition
            .transition("collapse-cell")
            .duration(500)
            .tween("pathAnim", () => t =>
              this.setState({ pathAnim: interp(t) })
            )
            .on("end", () => this.setState({ path: parentPath }));
        }
      } else {
        parentPath.push(cell);
        this.setState({ path: parentPath });
        this.cancelTransitions();
        d3transition
          .transition("expand-cell")
          .duration(500)
          .tween("pathAnim", () => t =>
            this.setState({ pathAnim: level + 1 + t })
          );
      }
    }
  };
  onMouseMove = e => {
    const { x, y } = this.getMousePos(e);
    if (this.state.scrubbing) {
      this.scrubAnim(x, y);
    } else {
      const curr = this.mouseToPath(x, y);
      const prev = this.state.cellHighlight;
      this.setState({
        cursor: curr ? "pointer" : "default"
      });
      if (JSON.stringify(curr) !== JSON.stringify(prev)) {
        this.setState({ cellHighlight: curr });
      }
      if (curr && this.mousedownLevel === curr.level) {
        this.onMouseDown(e, { isDrag: true });
      }
    }
  };
  onKeyDown = e => {
    if (e.key === "Shift") {
      this.setState({ scrubbing: true });
      this.setState({ cursor: "grabbing" });
      this.onMouseMove();
    }
  };
  onKeyUp = e => {
    if (e.key === "Shift") {
      this.setState({ scrubbing: false });
      this.setState({ cursor: "default" });
    } else if (e.key === "Enter") {
      this.cancelTransitions();
      const { pathAnim, path } = this.state;
      const durationPerLevel = 125;
      if (pathAnim > 1) {
        const interp = d3interpolate.interpolate(pathAnim, 1);
        const dist = pathAnim - 1;
        const duration = dist * durationPerLevel;
        d3transition
          .transition("collapse-all")
          .ease(d3ease.easeLinear)
          .duration(duration)
          .tween("pathAnim", () => t => this.setState({ pathAnim: interp(t) }));
      } else {
        const interp = d3interpolate.interpolate(pathAnim, path.length);
        const dist = path.length - pathAnim;
        const duration = dist * durationPerLevel;
        d3transition
          .transition("expand-all")
          .ease(d3ease.easeLinear)
          .duration(duration)
          .tween("pathAnim", () => t => this.setState({ pathAnim: interp(t) }));
      }
    }
  };
  getCssCursor = cursor => {
    if (cursor === "grabbing") {
      cursor = "-webkit-grabbing";
    }
    return cursor;
  };
  render() {
    const { width, height, cursor } = this.state;
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
          width: `${width}px`,
          height: `${height}px`,
          userSelect: "none",
          cursor: this.getCssCursor(cursor)
        }}
        onMouseMove={this.onMouseMove}
        onMouseDown={e => this.onMouseDown(e, { isDrag: false })}
        onMouseUp={this.onMouseUp}
        onDragStart={() => false}
      />
    );
  }
}

export default Tree;

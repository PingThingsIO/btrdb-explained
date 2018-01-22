import React, { Component } from "react";
import * as d3scale from "d3-scale";
import { scaleTimeNano } from "./scaleTimeNano";
import * as d3interpolate from "d3-interpolate";
// import * as d3ease from "d3-ease";
import * as d3transition from "d3-transition";
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

class Viz extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // canvas
      width: 1024,
      height: 600,

      numCells: 64, // cells in a tree row
      numSquareCells: 8, // cells in a calendar row

      path: [0], // first of path is ignored for generality
      pathAnim: 1, // float representing what index of the path we are showing

      // Tree placement and sizing
      treeCellW: 8,
      treeCellH: 12,
      treeX: 40,
      treeY: 40,
      levelOffset: 5,
      cellHighlight: {},

      // Calendar placement and sizing
      calCellSize: 38,
      calX: 700,
      calY: 40,

      rootStart: -1152921504606846976,
      rootResolution: 56
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
    const { treeCellH, treeCellW, path, cellHighlight } = this.state;
    const child = path[level + 1];
    ctx.globalAlpha = child === cell ? 1 : 0.1;
    ctx.strokeStyle = "#555";
    ctx.strokeRect(0, 0, treeCellW, treeCellH);
    if (child === cell) {
      ctx.fillStyle = "rgba(80,100,120, 0.15)";
      ctx.fillRect(0, 0, treeCellW, treeCellH);
    }
    ctx.globalAlpha = 1;
    if (
      cellHighlight &&
      cellHighlight.cell === cell &&
      cellHighlight.level === level
    ) {
      ctx.fillStyle = ctx.strokeStyle = "#1eb7aa";
      ctx.strokeRect(0, 0, treeCellW, treeCellH);
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, 0, treeCellW, treeCellH);
    }
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
    ctx.fillStyle = "rgba(80,100,120, 0.15)";
    if (level > 0 && t > dipTime) {
      const ytop = scaleY(0) + treeCellH + 1;
      ctx.beginPath();
      ctx.moveTo(scaleX0(0), ytop);
      ctx.lineTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.lineTo(scaleX1(0), ytop);
      ctx.fill();
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
      drawTick(0, "#1eb7aa", "unix epoch");
      drawTick(+new Date() * 1e6, "#db7b35", "now");
    }

    // Draw the date ticks
    if (t === 1) {
      ctx.strokeStyle = ctx.fillStyle = "rgba(90,110,100, 0.5)";
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
  drawTree = ctx => {
    ctx.save();
    const { treeX, treeY, treeCellH, levelOffset, path } = this.state;
    ctx.translate(treeX, treeY);
    for (let level = 0; level < path.length; level++) {
      this.drawTreeNode(ctx, level);
      ctx.translate(0, treeCellH * levelOffset);
    }
    ctx.restore();
  };
  drawCalendarCell = (ctx, level, cell) => {
    const s = this.state.calCellSize;
    const len = 4;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s, 0);
    ctx.stroke();
    ctx.globalAlpha *= 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, len);
    ctx.stroke();
    ctx.restore();
  };
  drawCalendarNode = (ctx, level) => {
    const n = this.state.numSquareCells;
    const s = this.state.calCellSize;
    let cell = 0;
    ctx.save();
    for (let cy = 0; cy < n; cy++) {
      ctx.save();
      for (let cx = 0; cx < n; cx++) {
        this.drawCalendarCell(ctx, level, cell++);
        ctx.translate(s, 0);
      }
      ctx.restore();
      ctx.translate(0, s);
    }
    ctx.restore();
  };
  drawCalendarNodeTicks = (ctx, level) => {
    ctx.save();
    ctx.lineWidth *= 2;
    ctx.font = "10px sans-serif";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const pad = { left: 5, top: 4 };
    const { calTimeK, calKX, calKRow, calRowY } = this.ds;
    if (level === 0) {
      const drawTick = (t, color, title) => {
        const k = calTimeK[level](t);
        const x = calKX(k);
        const row = calKRow(k);
        ctx.fillStyle = ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, calRowY(row));
        ctx.lineTo(x, calRowY(row + 1));
        ctx.stroke();
        let y = calRowY(row);
        for (let text of title.split("\n")) {
          ctx.fillText(text, x + pad.left, y + pad.top);
          y += 12;
        }
      };
      drawTick(0, "#1eb7aa", "unix\nepoch");
      drawTick(+new Date() * 1e6, "#db7b35", "now");
    }

    ctx.lineWidth /= 2;
    ctx.strokeStyle = ctx.fillStyle = "rgba(90,110,100, 0.5)";
    const drawTick = (t, title) => {
      const k = calTimeK[level](t);
      const x = calKX(k);
      const row = calKRow(k);
      ctx.beginPath();
      ctx.moveTo(x, calRowY(row));
      ctx.lineTo(x, calRowY(row + 1));
      ctx.stroke();
      let y = calRowY(row);
      for (let text of title.split("\n")) {
        ctx.fillText(text, x + pad.left, y + pad.top);
        y += 12;
      }
    };
    const count = 32;
    const ticks = calTimeK[level].ticks(count);
    const tickFormat = calTimeK[level].tickFormat(count);
    for (let i = 0; i < ticks.length; i++) {
      const tickTime = ticks[i];
      if (ticks[i] === ticks[i - 1]) continue; // nanosecond ticks sometimes duplicate
      if (level === 0 && i === 7) continue; // we already drew this as "unix epoch"
      const text = tickFormat(tickTime)
        .split(" ")
        .join("\n");
      drawTick(tickTime, text);
    }
    ctx.restore();
  };
  drawCalendar = ctx => {
    const {
      path,
      pathAnim,
      numSquareCells,
      calCellSize,
      calX,
      calY
    } = this.state;
    const { dipTime, calW, calTimeK } = this.ds;

    const s = calCellSize;
    const n = numSquareCells;

    const t = pathAnim % 1;

    // time used to control the camera
    let camT = d3scale
      .scaleLinear()
      .domain([dipTime, 1])
      .range([0, 1])
      .clamp(true)(t);

    // time used to control the child highlight border
    let highlightT = d3scale
      .scaleLinear()
      .domain([0, dipTime / 2])
      .range([0, 1])
      .clamp(true)(t);

    let index = Math.floor(pathAnim);
    let contextLabelIndex = index - 1;

    // edge case for last path
    if (index > path.length - 1) {
      index = path.length - 1;
      contextLabelIndex = index;
      camT = 1;
      highlightT = 1;
    }

    const child = path[index];
    const level = index - 1;

    const treeColX = child % n;
    const treeRowY = Math.floor(child / n);

    const [x, y, scale] = d3scale
      .scaleLinear()
      .domain([0, 1])
      .range([[treeColX * s, treeRowY * s, 1 / n], [0, 0, 1]])(camT);

    ctx.save();
    ctx.translate(calX, calY);

    // draw date context
    ctx.save();
    ctx.translate(calW, 0);
    ctx.textBaseline = "bottom";
    ctx.textAlign = "right";
    const contextDate = calTimeK[level].contextFormat();
    if (contextDate) {
      ctx.fillStyle = "rgba(90,110,100, 0.3)";
      ctx.fillText(contextDate, 0, -10);
    }
    ctx.restore();

    // draw node time length
    ctx.save();
    ctx.translate(calW, calW);
    ctx.textBaseline = "top";
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(90,110,100, 0.5)";
    ctx.fillText(nodeLengthLabels[contextLabelIndex], -5, 10);
    ctx.restore();

    // clip window
    ctx.beginPath();
    ctx.rect(-1, -1, calW + 2, calW + 2);
    ctx.clip();

    const transformToChild = () => {
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.lineWidth /= scale;
    };
    const transformToParent = () => {
      transformToChild();
      ctx.scale(n, n);
      ctx.translate(-treeColX * s, -treeRowY * s);
      ctx.lineWidth /= n;
    };

    // draw parent
    const gridColor = d3interpolate.interpolate("#fff", "#555")(0.3);
    ctx.strokeStyle = gridColor;
    ctx.save();
    transformToParent();
    this.drawCalendarNode(ctx, level);
    ctx.restore();

    // draw parent ticks
    ctx.save();
    transformToParent();
    this.drawCalendarNodeTicks(ctx, level);
    ctx.strokeRect(0, 0, calW, calW);
    ctx.restore();

    // draw child
    const childAlpha = d3interpolate.interpolate(0, 1)(Math.pow(camT, 2));
    ctx.save();
    transformToChild();
    ctx.beginPath();
    ctx.rect(-1, -1, calW + 2, calW + 2);
    ctx.clip();
    ctx.globalAlpha *= childAlpha;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, calW, calW);
    this.drawCalendarNode(ctx, level + 1);
    this.drawCalendarNodeTicks(ctx, level + 1);
    ctx.restore();

    // outline child
    ctx.save();
    transformToChild();
    ctx.strokeStyle = d3interpolate.interpolate("rgba(0,0,0,0)", "#555")(
      highlightT
    );
    ctx.strokeRect(0, 0, calW, calW);
    ctx.restore();

    // outline window
    ctx.strokeStyle = "#555";
    ctx.strokeRect(0, 0, calW, calW);

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
    this.drawCalendar(ctx);
    ctx.restore();
  };
  getMousePos = e => {
    if (!e) return this.lastMouse;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return (this.lastMouse = { x, y });
  };
  isLevelVisible = level => {
    return level < Math.floor(this.state.pathAnim);
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
  onMouseMove = e => {
    const { x, y } = this.getMousePos(e);
    if (this.scrubbing) {
      this.scrubAnim(x, y);
    } else {
      const curr = this.mouseToPath(x, y);
      const prev = this.state.cellHighlight;
      this.canvas.style.cursor = curr ? "pointer" : "default";
      if (JSON.stringify(curr) !== JSON.stringify(prev)) {
        this.setState({ cellHighlight: curr });
      }
    }
  };
  onClick = e => {
    const { cellHighlight } = this.state;
    if (cellHighlight) {
      const { level, cell } = cellHighlight;
      // set path
      const path = this.state.path.slice(0, level + 1);
      path.push(cell);
      this.setState({ path });
      d3transition
        .transition()
        .duration(500)
        .tween("expand-cell", () => t =>
          this.setState({ pathAnim: level + 1 + t })
        );
    }
  };
  onKeyDown = e => {
    if (e.key === "Shift") {
      this.scrubbing = true;
      this.onMouseMove();
    }
  };
  onKeyUp = e => {
    if (e.key === "Shift") {
      this.scrubbing = false;
    }
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
        style={{ outline: 0, width: `${width}px`, height: `${height}px` }}
        onMouseMove={this.onMouseMove}
        onClick={this.onClick}
      />
    );
  }
}

export default Viz;

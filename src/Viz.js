import React, { Component } from "react";
import * as d3scale from "d3-scale";
import { scaleTimeNano } from "./scaleTimeNano";
import * as d3interpolate from "d3-interpolate";
// import * as d3ease from "d3-ease";
// import * as d3transition from "d3-transition";
// import * as d3shape from "d3-shape";

class Viz extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // canvas
      width: 1024,
      height: 600,

      numCells: 64, // cells in a tree row
      numSquareCells: 8, // cells in a calendar row

      path: [0],
      pathAnim: 1,

      // Tree placement and sizing
      cellW: 8,
      cellH: 12,
      treeX: 40,
      treeY: 40,
      levelOffset: 5,

      // Tree placement and sizing
      calendarCellSize: 40,
      calendarX: 700,
      calendarY: 40,

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
  createD3Objects = () => {
    this.d3 = {};
  };
  computeDerivedState = (props, state) => {
    const {
      cellW,
      cellH,
      path,
      rootStart,
      rootResolution,
      numCells,
      levelOffset
    } = state;

    // `dip` is how long `t` will spend dropping the node before expanding it.
    const dipTime = 1 / levelOffset;

    const pixelRatio = window.devicePixelRatio || 1;

    // maps cell number to its x position
    const cellX = d3scale
      .scaleLinear()
      .domain([0, 1])
      .range([0, cellW]);

    // maps cell number to its y position
    const cellY = d3scale
      .scaleLinear()
      .domain([0, 1])
      .range([0, cellH]);

    // compute scale for each level
    const pw = res => Math.pow(2, res);
    let start = rootStart;
    let res = rootResolution;
    const timeX = [];
    for (let i = 0; i < path.length; i++) {
      const end = start + pw(res) * numCells;
      timeX.push(
        scaleTimeNano()
          .domain([start, end])
          .range([0, cellW * numCells])
      );
      if (i + 1 < path.length) {
        start += pw(res) * path[i + 1];
      }
      res -= 6;
    }

    this.ds = {
      pixelRatio,
      cellX,
      cellY,
      timeX,
      dipTime
    };
  };
  drawCell = (ctx, level, cell) => {
    const { cellH, cellW, path } = this.state;
    const child = path[level + 1];
    ctx.globalAlpha = child === cell ? 1 : 0.1;
    ctx.strokeRect(0, 0, cellW, cellH);
    if (child === cell) {
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillStyle = "rgba(80,100,120, 0.15)";
      ctx.fillRect(0, 0, cellW, cellH);
    }
  };
  drawNode = (ctx, level) => {
    const { numCells, cellW, cellH, path, levelOffset, pathAnim } = this.state;
    const { cellX, cellY, timeX, dipTime } = this.ds;

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
      .range([cellX(parent), cellX(parent), cellX(0)])
      .clamp(true);

    // right side
    const scaleX1 = d3scale
      .scaleLinear()
      .domain(domain)
      .range([cellX(parent + 1), cellX(parent + 1), cellX(numCells)])
      .clamp(true);

    // top side
    const scaleY = d3scale
      .scaleLinear()
      .domain(domain)
      .range([
        cellY(-levelOffset),
        cellY(-levelOffset * (1 - dipTime)),
        cellY(0)
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
      const ytop = scaleY(0) + cellH + 1;
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
    ctx.fillRect(0, 0, w, cellH);

    // Draw inner cells
    ctx.strokeStyle = "#555";
    if (t === 1) {
      ctx.save();
      for (let cell = 0; cell < numCells; cell++) {
        this.drawCell(ctx, level, cell);
        ctx.translate(cellW, 0);
      }
      ctx.restore();
    }

    // Draw outer border
    ctx.strokeRect(0, 0, w, cellH);

    // Tick font
    ctx.font = "10px sans-serif";
    ctx.textBaseline = "bottom";
    ctx.textAlign = "center";

    // Draw the major _unix epoch_ and _now_ ticks
    if (level === 0) {
      const drawTick = (t, color, title) => {
        const x = timeX[level](t);
        if (x < 0 || x > cellX(numCells)) return;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, cellY(-0.7));
        ctx.lineTo(x, cellY(1));
        ctx.stroke();
        ctx.fillText(title, x, cellY(-2));
      };
      drawTick(0, "#1eb7aa", "unix epoch");
      drawTick(+new Date() * 1e6, "#db7b35", "now");
    }

    // Draw the date ticks
    if (t === 1) {
      ctx.strokeStyle = ctx.fillStyle = "rgba(90,110,100, 0.5)";
      const drawTick = (t, title) => {
        const x = timeX[level](t);
        ctx.beginPath();
        ctx.moveTo(x, cellY(0));
        ctx.lineTo(x, cellY(-0.5));
        ctx.stroke();
        ctx.fillText(title, x, cellY(-0.75));
      };
      const count = 8;
      const ticks = timeX[level].ticks(count);
      const tickFormat = timeX[level].tickFormat(count);
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
      const labels = [
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
      ctx.fillText(labels[level], x1 + 28, cellY(0.5));
    }

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
  drawCalendarCell = (ctx, level, cell) => {
    const s = this.state.calendarCellSize;
    ctx.strokeRect(0, 0, s, s);
  };
  drawCalendarNode = (ctx, level) => {
    const n = this.state.numSquareCells;
    const s = this.state.calendarCellSize;
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
  drawCalendar = ctx => {
    const {
      path,
      pathAnim,
      numSquareCells,
      calendarCellSize,
      calendarX,
      calendarY
    } = this.state;
    const { dipTime } = this.ds;

    const s = calendarCellSize;
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

    let level = path[Math.floor(pathAnim)];

    // edge case for last path
    if (level == null) {
      level = path[path.length - 1];
      camT = 1;
      highlightT = 1;
    }

    const cellX = level % n;
    const cellY = Math.floor(level / n);

    const [x, y, scale] = d3scale
      .scaleLinear()
      .domain([0, 1])
      .range([[cellX * s, cellY * s, 1], [0, 0, n]])(camT);

    ctx.save(); // 1
    ctx.translate(calendarX, calendarY);

    // clip window
    ctx.beginPath();
    ctx.rect(-1, -1, s * n + 2, s * n + 2);
    ctx.clip();

    ctx.save(); // 2

    // transform camera
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.translate(-cellX * s, -cellY * s);

    // keep 1px line width
    ctx.lineWidth = 1 / scale;
    const gridColor = d3interpolate.interpolate("#fff", "#555")(0.3);
    ctx.strokeStyle = gridColor;

    // draw parent
    this.drawCalendarNode(ctx, level);

    // draw child
    ctx.save(); // 3
    ctx.translate(cellX * s, cellY * s);
    const scale2 = 1 / n;
    ctx.lineWidth /= scale2;
    ctx.scale(scale2, scale2);
    ctx.globalAlpha *= d3interpolate.interpolate(0, 1)(Math.pow(camT, 2));
    this.drawCalendarNode(ctx, level);
    ctx.restore(); // 3

    // highlight child
    ctx.strokeStyle = d3interpolate.interpolate(gridColor, "#555")(highlightT);
    ctx.strokeRect(cellX * s, cellY * s, s, s);

    // outline window
    ctx.restore(); // 2
    ctx.strokeStyle = "#555";
    ctx.strokeRect(0, 0, s * n, s * n);

    ctx.restore(); // 1
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

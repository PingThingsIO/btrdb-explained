import React, { Component } from "react";
import * as d3scale from "d3-scale";
import { scaleTimeNano } from "./scaleTimeNano";
import * as d3interpolate from "d3-interpolate";
import * as d3ease from "d3-ease";
import * as d3transition from "d3-transition";
import * as d3array from "d3-array";
import * as d3color from "d3-color";
import * as d3shape from "d3-shape";
import { getStatPoint } from "./datagen";

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

function rgba(color, opacity) {
  const c = d3color.color(color);
  c.opacity = opacity;
  return c + "";
}

const theme = {
  green: "#1eb7aa",
  orange: "#db7b35"
};

const colors = {
  cellFillExpanded: "rgba(80,100,120, 0.15)",
  cellFillHighlight: rgba(theme.green, 0.8),
  cellWall: rgba("#555", 0.1),
  cellWallExpanded: "#555",
  cellWallHighlight: theme.green,

  nodeFill: "#fff",
  nodeStroke: "#000",
  midNodeFill: rgba("#fff", 0.5),
  midNodeStroke: rgba("#000", 0.5),

  unixEpoch: theme.green,
  now: theme.orange,
  dateTick: "rgba(90,110,100, 0.5)",
  scrub: "#e7e8e9",

  zoomCone: "rgba(80,100,120, 0.15)",
  shadowCone: rgba(theme.green, 0.4),

  plotShadow: "rgba(80,100,120, 0.15)",
  plotLine: rgba("#555", 0.5),
  plotBorder: "#555",
  plotConeLine: rgba("#555", 0.4),
  plotHighlight: theme.green,
  clear: "rgba(0,0,0,0)"
};

class Tree extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // canvas
      width: 1024,
      height: 800,

      numCells: 64, // cells in a tree row
      numSquareCells: 8, // cells in a calendar row

      path: [0], // first of path is ignored for generality
      pathAnim: 1, // float representing what index of the path we are showing

      // Tree placement and sizing
      treeCellW: 8,
      treeCellH: 10,
      treeX: 88,
      treeY: 82,
      levelOffset: 7,
      cellHighlight: null,

      // Plot placement and sizing
      plotX: 620,
      plotW: 256,
      plotH: 40,

      // Calendar placement and sizing
      calCellSize: 38,
      calX: 700,
      calY: 40,

      rootStart: -1152921504606846976,
      rootResolution: 56

      // TODO:
      // selectionStart (path)
      // selectionEnd (path)
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
      levelOffset,
      plotH
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

    const numMidRows = levelOffset - 1;

    // pre-populate tree data by retrieving bottom point
    const bottomPath = path.slice(1); // remove the stand-in root node
    bottomPath.push(0); // retrieve any node on last path
    getStatPoint(bottomPath);

    // get node for each level (cell data inside `.children` property)
    const levelPaths = d3array
      .range(path.length)
      .map(i => path.slice(1, i + 1));
    const levelData = levelPaths.map(path => getStatPoint(path));
    const levelScaleY = levelData.map(({ min, max }) =>
      d3scale
        .scaleLinear()
        .domain([min, max])
        .range([plotH, 0])
    );

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
      dipTime,
      numMidRows,
      levelData,
      levelScaleY
    };
  };
  cone = (parent, row) => {
    const { treeCellW, treeCellH, levelOffset } = this.state;
    const x = this.midResStart(parent, Math.max(0, row)) * treeCellW;
    const numCells = Math.pow(2, Math.max(0, row));
    const w = numCells * treeCellW;
    const y = (-levelOffset + 1 + row) * treeCellH;
    return { x, y, w, numCells };
  };
  getParent = level => {
    // get the index of the level's parent
    // (for example, the level below descends from index 3 of previous level)
    //
    // 0 1 2 3 4 5 6 7 8 9
    //       |
    //      /|\
    // -------------------
    // |                 |
    // -------------------
    return this.state.path[level];
  };
  getLevelAnimTime = level => {
    return d3scale
      .scaleLinear()
      .domain([level, level + 1])
      .range([0, 1])
      .clamp(true)(this.state.pathAnim);
  };
  getConeAnimRow = level => {
    const { dipTime, numMidRows } = this.ds;
    const t = this.getLevelAnimTime(level);
    return d3scale
      .scaleLinear()
      .domain([dipTime, 1])
      .range([0, numMidRows])(t);
  };
  drawCell = (ctx, level, cell) => {
    const { treeCellH, treeCellW } = this.state;
    const expanded = this.isCellExpanded(level, cell);
    const highlighted = this.isCellHighlighted(level, cell);
    if (highlighted) {
      ctx.strokeStyle = colors.cellWallHighlight;
      ctx.fillStyle = colors.cellFillHighlight;
    } else if (expanded) {
      ctx.strokeStyle = colors.cellWallExpanded;
      ctx.fillStyle = colors.cellFillExpanded;
    } else {
      ctx.strokeStyle = colors.cellWall;
      ctx.fillStyle = colors.clear;
    }
    ctx.fillRect(0, 0, treeCellW, treeCellH);
    ctx.strokeRect(0, 0, treeCellW, treeCellH);
  };
  drawMidResCell = (ctx, level, cell, midRes) => {
    const { treeCellH, treeCellW, cellHighlight } = this.state;
    const highlight =
      cellHighlight &&
      cellHighlight.level === level &&
      cellHighlight.midRes === midRes &&
      cellHighlight.cell === cell;
    if (highlight) {
      ctx.strokeStyle = colors.cellWallHighlight;
      ctx.fillStyle = colors.cellFillHighlight;
    } else {
      ctx.strokeStyle = colors.cellWall;
      ctx.fillStyle = colors.clear;
    }
    ctx.fillRect(0, 0, treeCellW, treeCellH);
    ctx.strokeRect(0, 0, treeCellW, treeCellH);
  };
  drawZoomCone = (ctx, level) => {
    const row = this.getConeAnimRow(level);
    const { treeCellH } = this.state;
    const parent = this.getParent(level);

    if (level > 0 && row > 0) {
      ctx.beginPath();
      const dr = 1 / treeCellH;
      for (let r = 0; r <= row; r += dr) {
        const { x, y } = this.cone(parent, r);
        ctx.lineTo(x, y);
      }
      for (let r = row; r >= 0; r -= dr) {
        const { x, y, w } = this.cone(parent, r);
        ctx.lineTo(x + w, y);
      }
      ctx.fillStyle = colors.zoomCone;
      ctx.fill();
    }
  };
  drawHighlightCone = (ctx, level) => {
    const { cellHighlight, treeCellH } = this.state;
    const t = this.getLevelAnimTime(level);
    const row = this.getConeAnimRow(level);

    const highlight =
      t === 1 &&
      cellHighlight &&
      cellHighlight.cell != null &&
      cellHighlight.midRes != null &&
      cellHighlight.level === level;

    if (highlight) {
      ctx.beginPath();
      const dr = 1 / treeCellH;
      const startR = cellHighlight.midRes;
      const startCell = cellHighlight.cell;
      const parent = this.getParent(level);
      const top = this.cone(parent, startR);
      for (let r = startR; r <= row; r += dr) {
        const { x, y, w } = this.cone(parent, r);
        ctx.lineTo(x + w * startCell / top.numCells, y);
      }
      for (let r = row; r >= startR; r -= dr) {
        const { x, y, w } = this.cone(parent, r);
        ctx.lineTo(x + w * (startCell + 1) / top.numCells, y);
      }
      ctx.fillStyle = colors.shadowCone;
      ctx.fill();
    }
  };
  drawMidLevelBox = (ctx, level) => {
    const { cellHighlight, treeCellW, treeCellH } = this.state;
    const { numMidRows } = this.ds;

    const parent = this.getParent(level);
    const t = this.getLevelAnimTime(level);

    if (level > 0 && t === 1) {
      for (let r = 1; r < numMidRows; r++) {
        ctx.save();
        const { x, y, w, numCells } = this.cone(parent, r);
        ctx.translate(Math.floor(x), y - treeCellH);
        const midRes = r;
        const show =
          cellHighlight &&
          cellHighlight.midRes === midRes &&
          cellHighlight.level === level;
        if (show) {
          ctx.fillStyle = colors.midNodeFill;
          ctx.fillRect(0, 0, w, treeCellH);
          ctx.save();
          for (let cell = 0; cell < numCells; cell++) {
            this.drawMidResCell(ctx, level, cell, midRes);
            ctx.translate(treeCellW, 0);
          }
          ctx.restore();
          ctx.strokeStyle = colors.midNodeStroke;
          ctx.strokeRect(0, 0, w, treeCellH);
        }
        ctx.restore();
      }
    }
  };
  drawLevelBox = (ctx, level) => {
    const { treeCellW, treeCellH, numCells, cellHighlight } = this.state;
    const { treeColX, treeRowY, treeTimeX } = this.ds;

    const t = this.getLevelAnimTime(level);
    const row = this.getConeAnimRow(level);
    const parent = this.getParent(level);
    const { x, y, w } = this.cone(parent, row);
    const x1 = x + w;

    // Translate to the topleft corner of box
    ctx.save();
    ctx.translate(x, y);

    // Make opaque
    ctx.fillStyle = colors.nodeFill;
    ctx.fillRect(0, 0, w, treeCellH);

    // Draw inner cells
    if (t === 1) {
      ctx.save();
      for (let cell = 0; cell < numCells; cell++) {
        this.drawCell(ctx, level, cell);
        ctx.translate(treeCellW, 0);
      }
      ctx.restore();
    }

    // draw mid-resolution highlight and ticks
    if (
      t === 1 &&
      cellHighlight &&
      cellHighlight.midRes != null &&
      cellHighlight.level === level &&
      cellHighlight.cell != null
    ) {
      const blockSize = numCells / Math.pow(2, cellHighlight.midRes);
      ctx.save();
      for (let cell = 0; cell < numCells; cell += blockSize) {
        if (cell === cellHighlight.cell * blockSize) {
          ctx.fillStyle = colors.shadowCone;
          ctx.fillRect(0, 0, treeCellW * blockSize, treeCellH);
        }
        ctx.strokeStyle = rgba("#555", 0.5);
        ctx.strokeRect(0, 0, treeCellW * blockSize, treeCellH);
        ctx.translate(blockSize * treeCellW, 0);
      }
      ctx.restore();
    }

    // Draw outer border
    ctx.strokeStyle = colors.nodeStroke;
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
  drawPlot = (ctx, level) => {
    const t = this.getLevelAnimTime(level);
    if (t < 1) return;

    const {
      plotX,
      plotW,
      plotH,
      treeCellH,
      path,
      levelOffset,
      cellHighlight
    } = this.state;
    const { levelData, levelScaleY } = this.ds;

    // TODO: use midResChildren if highlighting midRes level
    const data = levelData[level];
    const midRes =
      cellHighlight &&
      cellHighlight.level === level &&
      cellHighlight.midRes != null
        ? cellHighlight.midRes
        : null;
    const rawPoints = data.midResChildren[midRes] || data.children;
    const points = rawPoints.map(({ min, mean, max }, i) => ({
      min,
      mean,
      max,
      i
    }));

    if (!points) return;

    // scales
    const xScale = d3scale
      .scaleLinear()
      .domain([-0.5, points.length - 0.5])
      .range([0, plotW]);
    const yScale = levelScaleY[level];

    // shapes
    const line = d3shape
      .line()
      .context(ctx)
      .x(({ i }) => xScale(i))
      .y(({ mean }) => yScale(mean));
    const shadow = d3shape
      .area()
      .context(ctx)
      .x(({ i }) => xScale(i))
      .y0(({ min }) => yScale(min))
      .y1(({ max }) => yScale(max));

    ctx.save();
    ctx.translate(plotX, treeCellH / 2 - plotH / 2);

    // draw border
    ctx.strokeStyle = colors.plotBorder;
    ctx.strokeRect(0, 0, plotW, plotH);

    // draw min/max shadow
    ctx.beginPath();
    shadow(points);
    ctx.fillStyle = colors.plotShadow;
    ctx.fill();

    // draw mean
    ctx.beginPath();
    line(points);
    ctx.strokeStyle = colors.plotLine;
    ctx.stroke();

    const cellRect = ({ i, min, max }, res) => {
      // custom scale if we use lower resolution
      const xs =
        res == null
          ? xScale
          : d3scale
              .scaleLinear()
              .domain([-0.5, 2 ** res - 0.5])
              .range([0, plotW]);
      const ys = yScale;
      ctx.rect(xs(i - 0.5), ys(min), xs(1) - xs(0), ys(max) - ys(min));
    };

    // draw expanded cell
    const expandedCell = path[level + 1];
    if (midRes == null && expandedCell != null) {
      const p = points[expandedCell];
      ctx.beginPath();
      cellRect(p);
      ctx.strokeStyle = colors.cellWallExpanded;
      ctx.stroke();

      const topx0 = xScale(p.i - 0.5);
      const topx1 = xScale(p.i + 0.5);
      const topy = yScale(p.min);

      const midy = plotH;

      const botx0 = 0;
      const botx1 = plotW;
      const boty = levelOffset * treeCellH;

      ctx.beginPath();
      ctx.moveTo(topx0, topy);
      ctx.lineTo(topx0, midy);
      ctx.moveTo(topx1, topy);
      ctx.lineTo(topx1, midy);
      ctx.setLineDash([3, 2]);
      ctx.strokeStyle = colors.plotConeLine;
      ctx.stroke();
      ctx.beginPath();
      ctx.lineTo(topx0, midy);
      ctx.lineTo(botx0, boty);
      ctx.lineTo(botx1, boty);
      ctx.lineTo(topx1, midy);
      ctx.stroke();
      ctx.setLineDash([]);
      // ctx.fillStyle = colors.zoomCone;
      // ctx.fill();
    }

    // draw highlighted cell
    if (
      cellHighlight &&
      cellHighlight.level === level &&
      cellHighlight.cell != null
    ) {
      const p = points[cellHighlight.cell];
      ctx.beginPath();
      cellRect(p, cellHighlight.midRes);
      ctx.strokeStyle = colors.cellWallHighlight;
      ctx.stroke();
      ctx.fillStyle = colors.cellFillHighlight;
      ctx.fill();
    }

    ctx.restore();
  };
  drawLevel = (ctx, level) => {
    const t = this.getLevelAnimTime(level);
    if (t === 0) return;

    ctx.save();
    this.drawZoomCone(ctx, level);
    this.drawHighlightCone(ctx, level);
    this.drawLevelBox(ctx, level);
    this.drawMidLevelBox(ctx, level);
    this.drawPlot(ctx, level);
    ctx.restore();
  };
  getTreeHeight = () => {
    const { path, levelOffset, treeCellH } = this.state;
    return (path.length - 1) * levelOffset * treeCellH + treeCellH;
  };
  drawScrubGuide = ctx => {
    const { scrubbingAnim, path, pathAnim } = this.state;
    if (!scrubbingAnim) return;
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
      this.drawLevel(ctx, level);
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
  isCellHighlighted = (level, cell, midRes) => {
    const { cellHighlight } = this.state;
    return (
      cellHighlight &&
      cellHighlight.midRes === midRes &&
      cellHighlight.cell === cell &&
      cellHighlight.level === level
    );
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
  mouseToTreePath = (x, y) => {
    const {
      treeX,
      treeY,
      treeCellW,
      treeCellH,
      levelOffset,
      path
    } = this.state;
    const { numMidRows, treeW } = this.ds;

    const inside = treeX <= x && x < treeX + treeW;
    if (!inside) return;

    const gridY = Math.floor((y - treeY) / treeCellH);
    let level = Math.floor(gridY / levelOffset);

    const atNode = gridY % levelOffset === 0 && this.isLevelVisible(level);
    const betweenNodes =
      gridY % levelOffset > 0 && this.isLevelVisible(level + 1);

    if (atNode) {
      const cell = Math.floor((x - treeX) / treeCellW);
      if (cell >= 0 && cell < 64) return { level, cell };
    } else if (betweenNodes) {
      level++;
      const row = Math.floor(gridY % levelOffset);
      if (row < numMidRows) {
        const parent = path[level];
        const cone = this.cone(parent, row);
        const cell = Math.floor((x - treeX - cone.x) / treeCellW);
        const midRes = row;
        if (cell >= 0 && cell < cone.numCells) {
          return { level, midRes, cell };
        } else {
          return { level, midRes };
        }
      }
    }
  };
  mouseToPlotPath = (x, y) => {
    const {
      treeX,
      treeY,
      plotX,
      plotW,
      treeCellH,
      plotH,
      levelOffset
    } = this.state;

    const leftX = treeX + plotX;
    const inside = leftX <= x && x < leftX + plotW;
    if (!inside) return;

    const topY = treeY + treeCellH / 2 - plotH / 2;
    const offsetY = levelOffset * treeCellH;

    const level = Math.floor((y - topY) / offsetY);
    const levelY = y % offsetY;

    if (levelY < plotH && this.isLevelVisible(level)) {
      const cell = Math.floor((x - leftX) / plotW * 64);
      return { level, cell };
    }
    // TODO: mid-resolution mouse-over
  };
  mouseToPath = (x, y) => {
    return this.mouseToTreePath(x, y) || this.mouseToPlotPath(x, y);
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
    const mouse = this.getMousePos(e);
    if (!this.isMouseDown) this.mouseLockY = mouse.y;
    this.isMouseDown = true;

    const { x, y } = { x: mouse.x, y: this.mouseLockY };
    const point = this.mouseToPath(x, y);

    if (point && point.midRes == null) {
      const { level, cell } = point;
      if (this.isLevelVisible(level + 1) && !this.isCellExpanded(level, cell)) {
        const path = this.state.path.slice(0, level + 1);
        path.push(cell);
        this.setState({ path, pathAnim: level + 2 });
      }
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
    this.isMouseDown = false;
    this.mouseLockY = null;
    const { cellHighlight, pathAnim } = this.state;
    if (
      cellHighlight &&
      cellHighlight.midRes == null &&
      this.levelClickable(cellHighlight.level)
    ) {
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
    this.onMouseMove();
  };
  levelClickable = level => {
    return level < 9;
  };
  cellClickable = obj => {
    if (!obj) return false;
    const { cell, level, midRes } = obj;
    return cell != null && midRes == null && this.levelClickable(level);
  };
  onMouseMove = e => {
    const mouse = this.getMousePos(e);
    if (this.state.scrubbingAnim) {
      this.scrubAnim(mouse.x, mouse.y);
    } else {
      const x = mouse.x;
      const y = this.isMouseDown ? this.mouseLockY : mouse.y;
      const curr = this.mouseToPath(x, y);
      const prev = this.state.cellHighlight;
      const clickable = this.cellClickable(curr);
      const cursor = clickable ? "pointer" : "default";
      const cursorChange = this.state.cursor !== cursor;
      const highlightChange = JSON.stringify(curr) !== JSON.stringify(prev);
      if (cursorChange) this.setState({ cursor });
      if (highlightChange) this.setState({ cellHighlight: curr });
      if (this.isMouseDown) this.onMouseDown(e, { isDrag: true });
    }
  };
  onKeyDown = e => {
    if (e.key === "Shift") {
      this.setState({ scrubbingAnim: true });
      this.setState({ cursor: "grabbing" });
      // this.onMouseMove();
    }
  };
  onKeyUp = e => {
    if (e.key === "Shift") {
      this.setState({ scrubbingAnim: false });
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

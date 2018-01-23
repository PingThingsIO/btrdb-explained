import React, { Component } from "react";
import * as d3scale from "d3-scale";
import * as d3interpolate from "d3-interpolate";

class Calendar extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // Calendar placement and sizing
      calCellSize: 38,
      calX: 700,
      calY: 40
    };
  }
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
      drawTick(0, colors.unixEpoch, "unix\nepoch");
      drawTick(+new Date() * 1e6, colors.now, "now");
    }

    ctx.lineWidth /= 2;
    ctx.strokeStyle = ctx.fillStyle = colors.dateTick;
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
    const gridColor = d3interpolate.interpolate("#fff", colors.cellWall)(0.3);
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
    ctx.strokeStyle = d3interpolate.interpolate(
      "rgba(0,0,0,0)",
      colors.cellWall
    )(highlightT);
    ctx.strokeRect(0, 0, calW, calW);
    ctx.restore();

    // outline window
    ctx.strokeStyle = colors.cellWall;
    ctx.strokeRect(0, 0, calW, calW);

    ctx.restore();
  };
}

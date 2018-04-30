import { scaleLinear, scaleTime } from "d3-scale";
import { bisector, tickStep, ticks } from "d3-array";
import { timeFormat, utcFormat } from "d3-time-format";
import {
  timeYear,
  timeMonth,
  timeWeek,
  timeDay,
  timeHour,
  timeMinute,
  timeSecond,
  timeMillisecond,
  utcYear,
  utcMonth,
  utcWeek,
  utcDay,
  utcHour,
  utcMinute,
  utcSecond,
  utcMillisecond
} from "d3-time";

//----------------------------------------------------------------------------
// Date to nanosecond timestamp conversion
//----------------------------------------------------------------------------
function nsToDate(ns) {
  return new Date(+ns / 1e6);
}
function dateToNs(date) {
  return +date * 1e6;
}

function calendar(BigNum, timeFuncs) {
  const {
    year,
    month,
    week,
    day,
    hour,
    minute,
    second,
    milli,
    format
  } = timeFuncs;

  //------------------------------------------------------------
  // State
  //------------------------------------------------------------
  let bigDomain; // BigNum domain
  let highOffset; // BigNum offset of domain for high precision numbers
  let mode; // precision mode (low or high)

  //------------------------------------------------------------
  // Precision Mode
  //------------------------------------------------------------
  const MODE_LO = "LO"; // Low precision (safe to convert BigNums to floats directly)
  const MODE_HI = "HI"; // High precision (use distance from left domain point for high precision)

  const updateMode = () => {
    const d = bigDomain;
    const [a, b] = [d[0], d[d.length - 1]];
    mode = Math.abs(+a - +b) > 1e7 ? MODE_LO : MODE_HI;
  };

  const b2f = {
    // BigNum -> Float
    [MODE_LO]: b => +b,
    [MODE_HI]: b => +b.minus(highOffset)
  };
  const f2b = {
    // Float -> BigNum
    [MODE_LO]: f => BigNum(String(f)),
    [MODE_HI]: f => highOffset.plus(String(f))
  };

  //------------------------------------------------------------
  // Float scale
  //------------------------------------------------------------
  const floatScale = scaleLinear();

  //------------------------------------------------------------
  // BigNum scale
  //------------------------------------------------------------
  const bigScale = x => {
    const bigX = BigNum(x);
    const floatX = b2f[mode](bigX);
    const y = floatScale(floatX);
    return y;
  };
  bigScale.invert = y => {
    const floatX = floatScale.invert(y);
    const bigX = f2b[mode](floatX);
    return bigX;
  };

  bigScale.domain = domain => {
    if (!domain) return bigDomain.slice();
    if (domain[0] instanceof Date) {
      domain = domain.map(dateToNs);
    }
    bigDomain = domain.map(t => BigNum(t));
    highOffset = BigNum(dateToNs(nsToDate(bigDomain[0])));
    updateMode();
    floatScale.domain(bigDomain.map(b2f[mode]));
    return bigScale;
  };

  // inherit floatScale functions as they are
  const inheritFns = ["range", "rangeRound", "clamp", "interpolate"];
  for (let fn of inheritFns) {
    bigScale[fn] = (...args) => {
      const result = floatScale[fn](...args);
      // make sure we return bigScale for chainable methods
      return result === floatScale ? bigScale : result;
    };
  }

  //------------------------------------------------------------
  // Copy
  //------------------------------------------------------------
  bigScale.copy = function() {
    return calendar(BigNum, timeFuncs)
      .domain(bigScale.domain())
      .range(bigScale.range())
      .interpolate(bigScale.interpolate())
      .clamp(bigScale.clamp());
  };

  //------------------------------------------------------------
  // Tick formatter
  //------------------------------------------------------------
  function tickFormat(ns) {
    // NOTE: assuming ns is an integer

    const sign = Math.sign(+ns);
    let nano = +(ns + "").slice(-3) * sign;
    let micro = +(ns + "").slice(-6, -3) * sign;

    const posMod = (t, n) => (t % n + n) % n;
    if (nano !== 0) return posMod(nano, 1000) + "n";
    if (micro !== 0) return posMod(micro, 1000) + "u";

    return scaleTime().tickFormat()(nsToDate(ns));
  }

  bigScale.tickFormat = function(count, specifier) {
    // NOTE: count and specifier are currently ignored
    return tickFormat;
  };

  //------------------------------------------------------------
  // Ticks
  //------------------------------------------------------------
  bigScale.ticks = function(interval, step) {
    if (mode === MODE_LO) {
      return scaleTime()
        .domain(bigDomain.map(nsToDate))
        .ticks(interval, step)
        .map(dateToNs);
    } else if (mode === MODE_HI) {
      // order
      const d = bigScale.domain();
      let [t0, t1] = [d[0], d[d.length - 1]];
      const r = t1.lt(t0);
      if (r) [t0, t1] = [t1, t0];

      // ticks
      let t;
      if (interval == null) interval = 10;
      if (typeof interval === "number") {
        t = ticks(b2f[mode](t0), b2f[mode](t1), interval).map(f2b[mode]);
      } else {
        const i = step == null ? interval : interval.every(step);
        const a = i.ceil(nsToDate(t0));
        const b = i.floor(nsToDate(t1));
        t = i.range(a, b + 1, step).map(dateToNs);
      }
      return r ? t.reverse() : t;
    } else {
      throw new Error("unknown mode");
    }
  };

  //------------------------------------------------------------
  // Rounding the domain to nice values
  //------------------------------------------------------------
  bigScale.nice = function(interval, step) {
    if (mode === MODE_LO) {
      bigScale.domain(
        scaleTime()
          .domain(bigScale.domain().map(nsToDate))
          .nice(interval, step)
          .domain()
          .map(dateToNs)
      );
    } else if (mode === MODE_HI) {
      if (interval == null) interval = 10;
      if (typeof interval === "number") {
        bigScale.domain(
          floatScale
            .nice(interval)
            .domain()
            .map(f2b[mode])
        );
      } else {
        const d = bigScale.domain();
        let [t0, t1] = [d[0], d[d.length - 1]];
        const r = t1.lt(t0);
        if (r) [t0, t1] = [t1, t0];

        const i = step == null ? interval : interval.every(step);
        const a = i.floor(nsToDate(t0));
        const b = i.ceil(nsToDate(t1));
        bigScale.domain([a, b].map(dateToNs));
      }
    } else {
      throw new Error("unknown mode");
    }
    return bigScale;
  };

  return bigScale;
}

//----------------------------------------------------------------------------
// Local or UTC time scales
//----------------------------------------------------------------------------
const timeFuncs = {
  year: timeYear,
  month: timeMonth,
  week: timeWeek,
  day: timeDay,
  hour: timeHour,
  minute: timeMinute,
  second: timeSecond,
  milli: timeMillisecond,
  format: timeFormat
};
const utcFuncs = {
  year: utcYear,
  month: utcMonth,
  week: utcWeek,
  day: utcDay,
  hour: utcHour,
  minute: utcMinute,
  second: utcSecond,
  milli: utcMillisecond,
  format: utcFormat
};
function scaleTimeNano(BigNum) {
  if (!BigNum) throw new Error("please specify a BigNum");
  const domain = [new Date(2000, 0, 1), new Date(2000, 0, 2)];
  return calendar(BigNum, timeFuncs).domain(domain);
}
function scaleUtcNano(BigNum) {
  if (!BigNum) throw new Error("please specify a BigNum");
  const domain = [Date.UTC(2000, 0, 1), Date.UTC(2000, 0, 2)];
  return calendar(BigNum, utcFuncs).domain(domain);
}

export { scaleTimeNano, scaleUtcNano };

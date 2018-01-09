import * as d3scale from "d3-scale";
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
// FIXME: 64-BIT FLOAT NANOSECONDS ARE ONLY ACCURATE TO MICROSECONDS.
// Tracking here: https://github.com/PingThingsIO/react-pingthings-ui/issues/35
//
// scaleTimeNano still gives us much smoother zooming at the millisecond level
// than d3's scaleTime, but this scale will have to be modified to allow zooming
// to the nanosecond level.
//
// SOLUTION:
// This will probably have to be done by splitting the timestamp into a
// millisecond float, and a remainder nanosecond float.
//----------------------------------------------------------------------------

//----------------------------------------------------------------------------
// Date to nanosecond timestamp conversion
//----------------------------------------------------------------------------
function nsToDate(ns) {
  const ms = Math.floor(ns / 1e6);
  return new Date(ms);
}
function dateToNs(date) {
  const ms = date.getTime();
  return ms * 1e6;
}

//----------------------------------------------------------------------------
// Durations in nanoseconds
//----------------------------------------------------------------------------
const durationSecond = 1e9;

// Copied directly: https://github.com/d3/d3-scale/blob/v1.0.7/src/time.js#L9
const durationMinute = durationSecond * 60;
const durationHour = durationMinute * 60;
const durationDay = durationHour * 24;
const durationWeek = durationDay * 7;
const durationMonth = durationDay * 30;
const durationYear = durationDay * 365;

//----------------------------------------------------------------------------
// Nanosecond Time Scale
//----------------------------------------------------------------------------
function calendar(year, month, week, day, hour, minute, second, milli, format) {
  //------------------------------------------------------------
  // Use Linear Scale as a base
  //------------------------------------------------------------
  const scaleLinear = d3scale.scaleLinear();
  const scale = x => scaleLinear(x);
  const inheritFns = [
    "invert",
    "domain",
    "range",
    "rangeRound",
    "clamp",
    "interpolate"
  ];
  for (let fn of inheritFns) {
    scale[fn] = (...args) => {
      const result = scaleLinear[fn](...args);
      return result === scaleLinear ? scale : result;
    };
  }

  //------------------------------------------------------------
  // Scale copying
  //------------------------------------------------------------
  // Copied directly: https://github.com/d3/d3-scale/blob/v1.0.7/src/continuous.js#L59
  function copy(source, target) {
    return target
      .domain(source.domain())
      .range(source.range())
      .interpolate(source.interpolate())
      .clamp(source.clamp());
  }

  // Copied directly: https://github.com/d3/d3-scale/blob/v1.0.7/src/time.js#L126
  // prettier-ignore
  scale.copy = function() {
    return copy(scale, calendar(year, month, week, day, hour, minute, second, milli, format));
  };

  //------------------------------------------------------------
  // TICK FORMATTING
  // Determines how to print a tick by matching it to its closest unit.
  //------------------------------------------------------------
  // Copied directly: https://github.com/d3/d3-scale/blob/v1.0.7/src/time.js#L30
  const tickFormatMilli = format(".%L");
  const tickFormatSecond = format(":%S");
  const tickFormatMinute = format("%I:%M");
  const tickFormatHour = format("%I %p");
  const tickFormatDay = format("%a %d");
  const tickFormatWeek = format("%b %d");
  const tickFormatMonth = format("%B");
  const tickFormatYear = format("%Y");

  // Copied directly: https://github.com/d3/d3-scale/blob/v1.0.7/src/time.js#L60
  // prettier-ignore
  function tickFormatDate(date) {
    return (second(date) < date ? tickFormatMilli
        : minute(date) < date ? tickFormatSecond
        : hour(date) < date ? tickFormatMinute
        : day(date) < date ? tickFormatHour
        : month(date) < date ? (week(date) < date ? tickFormatDay : tickFormatWeek)
        : year(date) < date ? tickFormatMonth
        : tickFormatYear)(date);
  }

  // Copied directly: https://github.com/d3/d3-scale/blob/v1.0.7/src/time.js#L115
  scale.tickFormat = function(count, specifier) {
    return specifier == null ? tickFormat : format(specifier);
  };

  // CUSTOM:
  // Format nanosecond remainder, otherwise format the Date part.
  function tickFormat(ns) {
    // Using string operations yields more accurate results than the division
    // and modulo arithmetic to retrieve digits.
    const nano = (ns + "").slice(-3);
    const micro = (ns + "").slice(-6, -3);
    if (nano !== "000") return nano + "n";
    if (micro !== "000") return micro + "µ";

    return tickFormatDate(nsToDate(ns));
  }

  //------------------------------------------------------------
  // CONTEXT FORMATTING
  // For printing the datetime breadcrumbs that all points in this scale have in
  // common. (Gives the time axis extra context as we zoom in.)
  //------------------------------------------------------------
  // prettier-ignore
  const contextFormats = [
    [format("%a %b %-d, %Y (%-I:%M:%S.%L %p)"), milli], // Thu Dec 21, 2017 (11:15:30.023 PM)
    [format("%a %b %-d, %Y (%-I:%M:%S %p)"), second],   // Thu Dec 21, 2017 (11:15:30 PM)
    [format("%a %b %-d, %Y (%-I:%M %p)"), minute],      // Thu Dec 21, 2017 (11:15 PM)
    [format("%a %b %-d, %Y (%-I%p)"), hour],            // Thu Dec 21, 2017 (11PM)
    [format("%a %b %-d, %Y"), day],                     // Thu Dec 21, 2017
    [format("%B %Y"), month],                           // December 2017
    [format("%Y"), year]                                // 2017
  ];
  // prettier-ignore
  const contextFormatRemainder = {                      // Thu Dec 21, 2017 (11:15:30.023XXXXXX PM)
    head: format("%a %b %-d, %Y (%-I:%M:%S.%L"),        // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    tail: format(" %p)")                                //                                     ^^^^
  };

  scale.contextFormat = () => {
    const [t0, t1] = scale.domain();
    const d0 = nsToDate(t0);
    const d1 = nsToDate(t1);

    // Get common micro and nanosecond digits.
    // Using string operations to retrieve digits yields more accurate results
    // than division and modulo arithmetic.
    let a = (t0 + "").slice(-6);
    let b = (t1 + "").slice(-6);
    if (+d0 === +d1 && a !== b) {
      let digits = "";
      for (let i = 0; i < 5; i++) {
        if (a[i] !== b[i]) break;
        digits += a[i];
      }
      const { head, tail } = contextFormatRemainder;
      return head(d0) + digits + tail(d0);
    }

    for (let [format, floor] of contextFormats) {
      if (+floor(d0) === +floor(d1)) return format(d0);
    }
  };

  //------------------------------------------------------------
  // Ticks
  //------------------------------------------------------------
  // Copied directly: https://github.com/d3/d3-scale/blob/v1.0.7/src/time.js#L39
  // prettier-ignore
  const tickIntervals = [
    [second,  1,      durationSecond],
    [second,  5,  5 * durationSecond],
    [second, 15, 15 * durationSecond],
    [second, 30, 30 * durationSecond],
    [minute,  1,      durationMinute],
    [minute,  5,  5 * durationMinute],
    [minute, 15, 15 * durationMinute],
    [minute, 30, 30 * durationMinute],
    [  hour,  1,      durationHour  ],
    [  hour,  3,  3 * durationHour  ],
    [  hour,  6,  6 * durationHour  ],
    [  hour, 12, 12 * durationHour  ],
    [   day,  1,      durationDay   ],
    [   day,  2,  2 * durationDay   ],
    [  week,  1,      durationWeek  ],
    [ month,  1,      durationMonth ],
    [ month,  3,  3 * durationMonth ],
    [  year,  1,      durationYear  ]
  ];

  // Copied directly: https://github.com/d3/d3-scale/blob/v1.0.7/src/time.js#L70
  // prettier-ignore
  function tickInterval(interval, start, stop, step) {
    if (interval == null) interval = 10;
    if (typeof interval === "number") {
      var target = Math.abs(stop - start) / interval,
          i = bisector(function(i) { return i[2]; }).right(tickIntervals, target);
      if (i === tickIntervals.length) {
        step = tickStep(start / durationYear, stop / durationYear, interval);
        interval = year;
      } else if (i) {
        i = tickIntervals[target / tickIntervals[i - 1][2] < tickIntervals[i][2] / target ? i - 1 : i];
        step = i[1];
        interval = i[0];
      } else {
        // CUSTOM: allow granular ticks for milliseconds and beyond (zooming in)
        return { NANO: true, ticks: ticks(start, stop, interval) };
      }
    }
    return step == null ? interval : interval.every(step);
  }

  // Copied directly: https://github.com/d3/d3-scale/blob/v1.0.7/src/time.js#L103
  scale.ticks = function(interval, step) {
    var d = scale.domain(), // <-- modified from just `domain()`
      t0 = d[0],
      t1 = d[d.length - 1],
      r = t1 < t0,
      t;
    // eslint-disable-next-line
    if (r) (t = t0), (t0 = t1), (t1 = t);
    t = tickInterval(interval, t0, t1, step);

    // CUSTOM: if `tickInterval` returned our granular ticks, just use them.
    if (t.NANO) {
      t = t.ticks || [];
    } else {
      // CUSTOM: map times to Date milliseconds
      t0 = +nsToDate(t0);
      t1 = +nsToDate(t1);

      // ORIGINAL LINE:
      t = t ? t.range(t0, t1 + 1) : []; // inclusive stop

      // CUSTOM: map ticks back to nanoseconds
      t = t.map(dateToNs);
    }

    return r ? t.reverse() : t;
  };

  //------------------------------------------------------------
  // Rounding the domain to nice values
  //------------------------------------------------------------
  const scaleTime = d3scale.scaleTime();
  scale.nice = function(interval, step) {
    // Copied directly: https://github.com/d3/d3-scale/blob/v1.0.7/src/time.js#L120
    const d = scale.domain();
    const t = tickInterval(interval, d[0], d[d.length - 1], step);

    // CUSTOM: if `tickInterval` returned our granular ticks, then that means
    // we are at a scale free from unusual date ticks and can round to usual
    // decimal places.
    if (t.NANO) {
      // CUSTOM: use `scaleLinear` to determine our nice domain.
      scaleLinear.nice(interval, step);
    } else {
      // CUSTOM: use `scaleTime` to determine our nice domain.
      scale.domain(
        scaleTime
          .domain(d.map(nsToDate))
          .nice(interval, step)
          .domain()
          .map(dateToNs)
      );
    }
    return scale;
  };

  return scale;
}

//----------------------------------------------------------------------------
// Local or UTC time scales
//----------------------------------------------------------------------------
function scaleTimeNano() {
  // Copied directly: https://github.com/d3/d3-scale/blob/v1.0.7/src/time.js#L134
  // (modified domain to take nanoseconds)
  const domain = [new Date(2000, 0, 1), new Date(2000, 0, 2)].map(dateToNs);
  // prettier-ignore
  return calendar(timeYear, timeMonth, timeWeek, timeDay, timeHour, timeMinute, timeSecond, timeMillisecond, timeFormat).domain(domain);
}
function scaleUtcNano() {
  // Copied directly: https://github.com/d3/d3-scale/blob/v1.0.7/src/utcTime.js#L6
  // (modified domain to take nanoseconds)
  const domain = [Date.UTC(2000, 0, 1), Date.UTC(2000, 0, 2)].map(dateToNs);
  // prettier-ignore
  return calendar(utcYear, utcMonth, utcWeek, utcDay, utcHour, utcMinute, utcSecond, utcMillisecond, utcFormat).domain(domain);
}

export { scaleTimeNano, scaleUtcNano };

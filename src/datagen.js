import FastSimplexNoise from "fast-simplex-noise";
import seedrandom from "seedrandom";
import * as d3array from "d3-array";

// 10 levels of noise
// TODO: create
// reference: https://beta.observablehq.com/d/3194dc0ab478ec1c
const meanNoise = [];
const shadowNoise = [];

const meanKnob = 0;
const minKnob = 50;
const maxKnob = 80;

function getNoiseXFromPath(path) {
  const exp = 40; // some large exponent (maybe not the full 56 since too large for floats)
  let x = 0;
  for (let p of path) {
    x += p * 2 ** exp;
    exp -= 6;
  }
}

function getNoise(path) {
  const level = path.length - 1;
  const x = getNoiseXFromPath(path);
  const mean = meanNoise[level]([x, meanKnob]);
  const min = mean - shadowNoise[level]([x, minKnob]);
  const max = mean + shadowNoise[level]([x, maxKnob]);
  // TODO: add count
  return { mean, min, max };
}

function cacheLookup(cache, path) {
  let curr = cache;
  for (let i of path) {
    if (!curr || !curr.children) return;
    curr = curr.children[i];
  }
  return curr;
}

function copyStat({ min, mean, max }) {
  return { min, mean, max };
}

function cacheWrite(cache, path, children) {
  let curr = cache;
  for (let i of path) curr = curr.children[i];
  curr.children = children.map(copyStat);
}

function fitChildren(points, parent) {
  // Get mean-centered points.
  // NOTE: disregarding count currently
  const localMean = d3array.sum(points, p => p.mean) / points.length;
  const center = localMean;
  const relative = points.map(({ min, mean, max }) => ({
    mean: mean - center,
    min: min - center,
    max: max - center
  }));

  // Get local relative extremes.
  const localRelMin = d3array.min(relative, p => p.min);
  const localRelMax = d3array.max(relative, p => p.max);
  const indexOfMin = relative.indexOf(localRelMin);
  const indexOfMax = relative.indexOf(localRelMax);

  // Get global relative extremes that we must target.
  const globalRelMin = parent.min - parent.mean;
  const globalRelMax = parent.max - parent.mean;

  // Get the minimum scale that we must stretch the local points such that
  // they are contained inside the global bounds.
  const fit = k =>
    globalRelMin <= localRelMin * k && localRelMax * k <= globalRelMax;
  const minStretch = globalRelMin / localRelMin;
  const maxStretch = globalRelMax / localRelMax;
  const stretch = fit(minStretch) ? minStretch : maxStretch;

  // Fit points to target bounds as best we can w/ recentering and uniform scaling.
  const fitPoint = (rel, k) => ({
    mean: parent.mean + rel.mean * k,
    min: parent.mean + rel.min * k,
    max: parent.mean + rel.max * k
  });
  const fitPoints = relative.map(rel => fitPoint(rel, stretch));

  // Since we are only guaranteed _one_ local bound is flushed against the
  // global bounds, we stretch the two min and max points to the bounds manually
  // to ensure to ensure both bounds are equal.
  fitPoints[indexOfMin].min = parent.min;
  fitPoints[indexOfMax].max = parent.max;

  return fitPoints;
}

function computeChildren(cache, path) {
  if (!path || !path.length) return;
  const points = d3array.range(64).map(i => getNoise([...path, i]));
  const parentPath = path.slice(0, -1);
  const parent = getStatPoint(parentPath);
  fitChildren(points, parent);
  cacheWrite(cache, parentPath, points);
}

// path = tree node path from root
function getStatPoint(cache, path) {
  if (!path || !path.length) return;

  const point = cacheLookup(cache, path);
  if (point) return point;

  const parentPath = path.slice(0, -1);
  computeChildren(cache, parentPath);
  return cacheLookup(cache, path);
}

function getMidStatPoint(cache, path, { res, cell }) {
  const point = getStatPoint(cache, path);
  if (!point) return;

  if (!point.children) computeChildren(cache, path);

  const width = 64 / 2 ** res;
  const points = point.children.slice(cell * width, (cell + 1) * width);

  return {
    min: d3array.min(points, p => p.min),
    max: d3array.max(points, p => p.max),
    mean: d3array.sum(points, p => p.mean) / points.length
  };
}

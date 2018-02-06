import FastSimplexNoise from "fast-simplex-noise";
import seedrandom from "seedrandom";
import * as d3array from "d3-array";

// 10 levels of noise
// TODO: create
// reference: https://beta.observablehq.com/@shaunlebron/btrdb-mock-data-generator/2

// level noise knobs
// prettier-ignore
const levelNoiseKnobs = [
  {meanFrequency: 0.03, shadowFrequency: 0.05, octaves: 5, persistence: 0.5, meanHeight: 120, shadowHeight: 40},
  {meanFrequency: 0.03, shadowFrequency: 0.05, octaves: 5, persistence: 0.5, meanHeight: 120, shadowHeight: 40},
  {meanFrequency: 0.03, shadowFrequency: 0.05, octaves: 5, persistence: 0.5, meanHeight: 120, shadowHeight: 40},
  {meanFrequency: 0.03, shadowFrequency: 0.05, octaves: 5, persistence: 0.5, meanHeight: 120, shadowHeight: 40},
  {meanFrequency: 0.03, shadowFrequency: 0.05, octaves: 5, persistence: 0.5, meanHeight: 120, shadowHeight: 40},
  {meanFrequency: 0.03, shadowFrequency: 0.05, octaves: 5, persistence: 0.5, meanHeight: 120, shadowHeight: 40},
  {meanFrequency: 0.03, shadowFrequency: 0.05, octaves: 5, persistence: 0.5, meanHeight: 120, shadowHeight: 40},
  {meanFrequency: 0.03, shadowFrequency: 0.05, octaves: 5, persistence: 0.5, meanHeight: 120, shadowHeight: 40},
  {meanFrequency: 0.03, shadowFrequency: 0.05, octaves: 5, persistence: 0.5, meanHeight: 120, shadowHeight: 40},
  {meanFrequency: 0.03, shadowFrequency: 0.05, octaves: 5, persistence: 0.5, meanHeight: 120, shadowHeight: 40},
];

const meanNoise = [];
const shadowNoise = [];
for (let {
  meanFrequency,
  shadowFrequency,
  octaves,
  persistence,
  meanHeight,
  shadowHeight
} of levelNoiseKnobs) {
  const min = 0;
  meanNoise.push(
    new FastSimplexNoise({
      random: seedrandom("hello"),
      frequency: meanFrequency,
      max: meanHeight,
      persistence,
      octaves,
      min
    })
  );
  shadowNoise.push(
    new FastSimplexNoise({
      random: seedrandom("hello"),
      frequency: shadowFrequency,
      max: shadowHeight,
      persistence,
      octaves,
      min
    })
  );
}

// global noise knobs
const meanNoiseTime = 0;
const minNoiseTime = 50;
const maxNoiseTime = 80;

function getNoiseXFromPath(path) {
  let exp = 40; // some large exponent (maybe not the full 56 since too large for floats)
  let x = 0;
  for (let p of path) {
    x += p * 2 ** exp;
    exp -= 6;
  }
  return x;
}

function getNoise(path) {
  const level = path.length - 1;
  const x = getNoiseXFromPath(path);
  const mean = meanNoise[level].scaled([x, meanNoiseTime]);
  const min = mean - shadowNoise[level].scaled([x, minNoiseTime]);
  const max = mean + shadowNoise[level].scaled([x, maxNoiseTime]);
  // TODO: add count
  return { mean, min, max };
}

function cacheLookup(cache, path) {
  if (!path || !path.length) return;
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

function midResChildren(children, res) {
  const numPoints = 2 ** res;
  const width = 64 / numPoints;
  const midResPoint = i => {
    const points = children.slice(i * width, (i + 1) * width);
    return {
      min: d3array.min(points, p => p.min),
      max: d3array.max(points, p => p.max),
      mean: d3array.sum(points, p => p.mean) / points.length
    };
  };
  return d3array.range(numPoints).map(midResPoint);
}

function cacheWrite(cache, path, children) {
  let curr = cache;
  for (let i of path) curr = curr.children[i];
  curr.children = children.map(copyStat);
  curr.midResChildren = d3array
    .range(6)
    .map(res => midResChildren(children, res));
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
  const indexOfMin = relative.findIndex(p => p.min === localRelMin);
  const indexOfMax = relative.findIndex(p => p.max === localRelMax);

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

function computeChildren(cache, parentPath) {
  if (!parentPath) return;
  const points = d3array.range(64).map(i => getNoise([...parentPath, i]));
  const parent = getStatPoint(cache, parentPath);
  const finalPoints = parent ? fitChildren(points, parent) : points;
  cacheWrite(cache, parentPath, finalPoints);
}

// path = tree node path from root
function getStatPoint(cache, path) {
  if (!path || !path.length) return;

  const point = cacheLookup(cache, path);
  if (point) return point;

  const parentPath = path.slice(0, -1);
  computeChildren(cache, parentPath);
  const value = cacheLookup(cache, path);
  return value;
}

function test() {
  const cache = { children: [] };
  getStatPoint(cache, [0, 1, 2]);
  console.log(cache);
}
test();

export { getStatPoint };

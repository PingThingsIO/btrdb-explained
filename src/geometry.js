import delaunay from "delaunay-fast";
import * as d3array from "d3-array";

// return triplets of indices
function triangulate(points) {
  const indices = delaunay.triangulate(points);
  const triangles = [];
  for (let i = 0; i < indices.length; i += 3) {
    triangles.push(indices.slice(i, i + 3));
  }
  return triangles;
}

function pointLookup(points, indexes) {
  return indexes.map(i => points[i]);
}

function dist([x0, y0], [x1, y1]) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return Math.sqrt(dx * dx + dy * dy);
}

function triangleArea([p0, p1, p2]) {
  // from: https://en.wikipedia.org/wiki/Heron%27s_formula
  const a = dist(p0, p1);
  const b = dist(p1, p2);
  const c = dist(p2, p0);
  const s = (a + b + c) / 2;
  return Math.sqrt(s * (s - a) * (s - b) * (s - c));
}

function triangleAngles([p0, p1, p2]) {
  // from: https://en.wikipedia.org/wiki/Law_of_cosines
  const a = dist(p0, p1);
  const b = dist(p1, p2);
  const c = dist(p2, p0);
  const angle = (a, b, c) => Math.acos((c * c - a * a - b * b) / (-2 * a * b));
  return [angle(a, b, c), angle(b, c, a), angle(c, a, b)];
}

function createGraph(points, triangles) {
  const graph = points.map(p => ({}));
  for (let [a, b, c] of triangles) {
    for (let [i, j] of [[a, b], [b, c], [c, a]]) {
      const [p0, p1] = pointLookup(points, [i, j]);
      graph[i][j] = graph[j][i] = dist(p0, p1);
    }
  }
  return graph;
}

function randomMesh({ n, xdomain, ydomain, minDist, minArea, minAngle }) {
  const points = [];
  const [xmin, xmax] = xdomain;
  const [ymin, ymax] = ydomain;
  const xrange = xmax - xmin;
  const yrange = ymax - ymin;
  const randPoint = () => [
    Math.random() * xrange + xmin,
    Math.random() * yrange + ymin
  ];
  const isPointValid = a => {
    // check dist
    for (let b of points) {
      if (dist(a, b) < minDist) return false;
    }

    points.push(a);
    let valid = true;
    for (let indexes of triangulate(points)) {
      const tri = pointLookup(points, indexes);
      // check area
      if (triangleArea(tri) < minArea) {
        valid = false;
      } else {
        // check angles
        for (let a of triangleAngles(tri)) {
          if (a < minAngle) valid = false;
        }
      }
      if (!valid) break;
    }
    points.pop();
    return valid;
  };
  const randValidPoint = () => {
    const maxTries = 100;
    for (let i = 0; i < maxTries; i++) {
      const p = randPoint();
      if (isPointValid(p)) {
        // console.log(`${i} tries`);
        return p;
      }
    }
    // console.error(`could not find valid point in ${maxTries} tries`);
    return null;
  };
  for (let i = 0; i < n; i++) {
    const p = randValidPoint();
    if (p) {
      points.push(p);
    } else {
      // restart search since we ended up at a dead-end
      return randomMesh({ n, xdomain, ydomain, minDist, minArea, minAngle });
    }
  }
  const triangles = triangulate(points);
  const graph = createGraph(points, triangles);

  return { points, triangles, graph };
}

function rippleMap(graph, root) {
  // state: distance left to be traveled between a->b
  const progress = {};
  const initProgress = ([a, b]) => {
    if (progress[a] == null) progress[a] = {};
    if (progress[a][b] == null) progress[a][b] = graph[a][b];
  };

  // state: result
  const distMap = {};

  // state: total distance traveled
  let distFromRoot = 0;

  // state: nodes we should not revisit
  const isBlocked = { [root]: true };

  // state: a->b paths that we are currently traveling (array of [a,b])
  const frontier = [];

  // when we reach a node...
  const visit = a => {
    distMap[a] = { distFromRoot, distTo: {} };
    for (let b of Object.keys(graph[a])) {
      b = parseInt(b, 10);
      if (!isBlocked[b]) {
        distMap[a].distTo[b] = graph[a][b];
        initProgress([a, b]);
        frontier.push([a, b]);
        isBlocked[b] = true;
      }
    }
  };

  // walk the graph
  visit(root);
  while (frontier.length > 0) {
    const step = d3array.min(frontier.map(([a, b]) => progress[a][b]));
    distFromRoot += step;

    // update/expire frontier nodes
    const arrived = [];
    for (let i = frontier.length - 1; i >= 0; i--) {
      const [a, b] = frontier[i];
      if (progress[a][b] === step) {
        frontier.splice(i, 1);
        arrived.push(b);
      }
      progress[a][b] -= step;
    }

    for (let a of arrived) {
      visit(a);
    }
  }

  const totalDist = distFromRoot;
  return { distMap, totalDist };
}

export { pointLookup, randomMesh, rippleMap };

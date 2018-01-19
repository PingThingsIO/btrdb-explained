import delaunay from "delaunay-fast";

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
      graph[i][j] = graph[j][i] = true;
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

export { pointLookup, randomMesh };

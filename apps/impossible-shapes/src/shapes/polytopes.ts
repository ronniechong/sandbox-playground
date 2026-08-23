export interface Polytope {
  id: string;
  label: string;
  vertices: [number, number, number, number][];
  edges: [number, number][];
}

function hypercube(): Polytope {
  const vertices: [number, number, number, number][] = [];
  const edges: [number, number][] = [];

  for (let i = 0; i < 16; i++) {
    vertices.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);

    for (let bit = 0; bit < 4; bit++) {
      const other = i ^ (1 << bit);
      if (i < other) edges.push([i, other]);
    }
  }

  return { id: 'tesseract', label: 'Tesseract', vertices, edges };
}

function cellSixteen(): Polytope {
  const vertices: [number, number, number, number][] = [];

  for (let axis = 0; axis < 4; axis++) {
    for (const sign of [1, -1]) {
      const v: [number, number, number, number] = [0, 0, 0, 0];
      v[axis] = sign;
      vertices.push(v);
    }
  }

  const edges: [number, number][] = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const antipodal = vertices[i]!.every((c, k) => c === -vertices[j]![k]!);
      if (!antipodal) edges.push([i, j]);
    }
  }

  return { id: '16-cell', label: '16-cell', vertices, edges };
}

function cellFive(): Polytope {
  const a = 1 / Math.sqrt(5);
  const vertices: [number, number, number, number][] = [
    [1, 1, 1, -a],
    [1, -1, -1, -a],
    [-1, 1, -1, -a],
    [-1, -1, 1, -a],
    [0, 0, 0, 4 * a],
  ];

  const edges: [number, number][] = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      edges.push([i, j]);
    }
  }

  return { id: '5-cell', label: '5-cell', vertices, edges };
}

function distSquared(a: number[], b: number[]): number {
  return a.reduce((sum, c, i) => sum + (c - b[i]!) ** 2, 0);
}

// Connects each vertex to its nearest neighbors only, inferred from the
// vertex set itself — avoids hand-deriving the edge list for shapes whose
// combinatorics aren't a simple bit-flip or all-pairs relation.
function edgesFromNearestNeighbors(vertices: number[][]): [number, number][] {
  let minDist = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const d = distSquared(vertices[i]!, vertices[j]!);
      if (d > 1e-9 && d < minDist) minDist = d;
    }
  }

  const edges: [number, number][] = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      if (Math.abs(distSquared(vertices[i]!, vertices[j]!) - minDist) < 1e-6) edges.push([i, j]);
    }
  }
  return edges;
}

function cellTwentyFour(): Polytope {
  const vertices: [number, number, number, number][] = [];

  for (let a = 0; a < 4; a++) {
    for (let b = a + 1; b < 4; b++) {
      for (const signA of [1, -1]) {
        for (const signB of [1, -1]) {
          const v: [number, number, number, number] = [0, 0, 0, 0];
          v[a] = signA;
          v[b] = signB;
          vertices.push(v);
        }
      }
    }
  }

  return { id: '24-cell', label: '24-cell', vertices, edges: edgesFromNearestNeighbors(vertices) };
}

function cellSixHundred(): Polytope {
  const phi = (1 + Math.sqrt(5)) / 2;
  const vertices: [number, number, number, number][] = [];

  // 8 vertices: permutations of (±1, 0, 0, 0)
  for (let axis = 0; axis < 4; axis++) {
    for (const sign of [1, -1]) {
      const v: [number, number, number, number] = [0, 0, 0, 0];
      v[axis] = sign;
      vertices.push(v);
    }
  }

  // 16 vertices: (±1/2, ±1/2, ±1/2, ±1/2)
  for (const s0 of [1, -1]) {
    for (const s1 of [1, -1]) {
      for (const s2 of [1, -1]) {
        for (const s3 of [1, -1]) {
          vertices.push([s0 / 2, s1 / 2, s2 / 2, s3 / 2]);
        }
      }
    }
  }

  // 96 vertices: even permutations of (±phi/2, ±1/2, ±1/(2*phi), 0)
  const base = [phi / 2, 0.5, 1 / (2 * phi), 0];
  const evenPerms = [
    [0, 1, 2, 3],
    [0, 2, 3, 1],
    [0, 3, 1, 2],
    [1, 0, 3, 2],
    [1, 2, 0, 3],
    [1, 3, 2, 0],
    [2, 0, 1, 3],
    [2, 1, 3, 0],
    [2, 3, 0, 1],
    [3, 0, 2, 1],
    [3, 1, 0, 2],
    [3, 2, 1, 0],
  ];

  for (const perm of evenPerms) {
    const permuted = perm.map((i) => base[i]!);
    const signIndices = permuted.map((v, i) => (v !== 0 ? i : -1)).filter((i) => i >= 0);
    const signCombos = 1 << signIndices.length;
    for (let mask = 0; mask < signCombos; mask++) {
      const v = [...permuted];
      signIndices.forEach((idx, bit) => {
        if (mask & (1 << bit)) v[idx] = -v[idx]!;
      });
      vertices.push(v as [number, number, number, number]);
    }
  }

  return {
    id: '600-cell',
    label: '600-cell',
    vertices,
    edges: edgesFromNearestNeighbors(vertices),
  };
}

export const polytopes: Polytope[] = [
  hypercube(),
  cellSixteen(),
  cellFive(),
  cellTwentyFour(),
  cellSixHundred(),
];

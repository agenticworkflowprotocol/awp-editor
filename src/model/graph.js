// Layered layout of the step graph (spec 5.6): a step's level is the length of the longest
// `dependsOn` chain before it, so dependencies are always drawn above their dependents. Steps of one
// level keep the order of `spec.workflow`. Cycles (invalid manifests) are tolerated: their steps go
// to the last level so the graph still renders.

export const NODE = { width: 184, height: 56, gapX: 32, gapY: 56, margin: 16 };

/**
 * @param {{ id: string, dependsOn: string[] }[]} steps
 * @returns {{ nodes: { id: string, level: number, x: number, y: number }[], edges: { from: string, to: string }[], width: number, height: number }}
 */
export function layoutSteps(steps) {
  const ids = new Set(steps.map((s) => s.id));
  const deps = new Map(steps.map((s) => [s.id, (s.dependsOn ?? []).filter((d) => ids.has(d) && d !== s.id)]));
  const level = new Map();
  const visiting = new Set();
  let cyclic = false;
  const levelOf = (id) => {
    if (level.has(id)) return level.get(id);
    if (visiting.has(id)) { cyclic = true; return 0; }
    visiting.add(id);
    const l = Math.max(-1, ...deps.get(id).map(levelOf)) + 1;
    visiting.delete(id);
    level.set(id, l);
    return l;
  };
  steps.forEach((s) => levelOf(s.id));
  if (cyclic) {
    // Put every step that is part of or after a cycle below all others.
    const max = Math.max(0, ...level.values());
    for (const s of steps) if (reachesItself(s.id, deps)) level.set(s.id, max + 1);
  }

  const rows = [];
  for (const s of steps) {
    const l = level.get(s.id);
    (rows[l] ??= []).push(s.id);
  }
  const dense = rows.filter(Boolean);
  const widest = Math.max(1, ...dense.map((r) => r.length));
  const width = NODE.margin * 2 + widest * NODE.width + (widest - 1) * NODE.gapX;
  const nodes = [];
  dense.forEach((row, rowIndex) => {
    const rowWidth = row.length * NODE.width + (row.length - 1) * NODE.gapX;
    const startX = (width - rowWidth) / 2;
    row.forEach((id, i) => nodes.push({ id, level: rowIndex, x: startX + i * (NODE.width + NODE.gapX), y: NODE.margin + rowIndex * (NODE.height + NODE.gapY) }));
  });
  const edges = steps.flatMap((s) => deps.get(s.id).map((from) => ({ from, to: s.id })));
  const height = NODE.margin * 2 + dense.length * NODE.height + Math.max(0, dense.length - 1) * NODE.gapY;
  return { nodes, edges, width, height: dense.length ? height : 0 };
}

function reachesItself(start, deps) {
  const stack = [...deps.get(start)];
  const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (id === start) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(deps.get(id) ?? []));
  }
  return false;
}

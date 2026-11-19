// Step graph (SVG) and step details.
import { NODE } from '../model/index.js';
import { badge, cell, facts, h, s, section } from './dom.js';

const TYPE_LABEL = { agent: 'agent', command: 'command', approval: 'approval' };

function edgePath(from, to) {
  const x1 = from.x + NODE.width / 2;
  const y1 = from.y + NODE.height;
  const x2 = to.x + NODE.width / 2;
  const y2 = to.y;
  const mid = (y1 + y2) / 2;
  return `M${x1} ${y1} C${x1} ${mid} ${x2} ${mid} ${x2} ${y2 - 6}`;
}

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function stepLabel(step) {
  if (step.type === 'command') return step.command ? `$ ${step.command}` : 'command';
  if (step.type === 'approval') return 'human approval';
  return step.agent ? `agent ${step.agent}` : 'agent';
}

/** Short marker of an iterating step (spec 5.6.4), for example `each ≤20`. */
const forEachMark = (f) => `each ≤${f.maxItems ?? '?'}`;

/** Spoken and written description of an iteration, for labels, titles and the step card. */
function forEachText(f) {
  return `runs once per item of ${f.items}, at most ${f.maxItems ?? '?'} items, ${f.concurrency} at a time`;
}

/** Two offset cards behind the node box: the step runs several times. */
function stackOf(step) {
  if (!step.forEach) return [];
  return [6, 3].map((d) => s('rect', { class: 'node-stack', x: d, y: d, width: NODE.width, height: NODE.height, rx: 8 }));
}

/**
 * @param {object} model
 * @param {{ problemsAt: (pointer: string) => number, select: (pointer: string) => void }} ctx
 */
export function renderGraph(model, ctx) {
  if (!model.steps.length) return null;
  const byId = new Map(model.graph.nodes.map((n) => [n.id, n]));
  const steps = new Map(model.steps.map((st) => [st.id, st]));
  const edges = model.graph.edges.map((e) => {
    const from = byId.get(e.from);
    const to = byId.get(e.to);
    return from && to ? s('path', { class: 'edge', d: edgePath(from, to), 'marker-end': 'url(#awp-arrow)' }) : null;
  });
  const nodes = model.graph.nodes.map((n) => {
    const step = steps.get(n.id);
    const problems = ctx.problemsAt(step.pointer);
    const iteration = step.forEach ? `, ${forEachText(step.forEach)}` : '';
    const label = `Step ${step.id}, ${stepLabel(step)}${iteration}${step.dependsOn.length ? `, after ${step.dependsOn.join(', ')}` : ''}${problems ? `, ${problems} problem${problems === 1 ? '' : 's'}` : ''}`;
    const activate = () => ctx.select(step.pointer);
    return s('g', {
      class: ['node', `type-${step.type}`, step.forEach ? 'for-each' : null, problems ? 'has-problems' : null], 'data-pointer': step.pointer, tabindex: 0, role: 'button', 'aria-label': label,
      transform: `translate(${n.x} ${n.y})`, onclick: activate, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } },
    },
    stackOf(step),
    s('rect', { class: 'node-box', width: NODE.width, height: NODE.height, rx: 8 }),
    s('text', { class: 'node-title', x: 12, y: 22 }, truncate(step.id, 22)),
    s('text', { class: 'node-sub', x: 12, y: 41 }, truncate(stepLabel(step), step.forEach ? 17 : 26)),
    step.forEach ? s('text', { class: 'node-each', x: NODE.width - 10, y: 41, 'text-anchor': 'end' }, forEachMark(step.forEach)) : null,
    problems ? s('circle', { class: 'node-alert', cx: NODE.width - 12, cy: 12, r: 6 }) : null,
    s('title', {}, label));
  });
  const svgEl = s('svg', { class: 'graph', viewBox: `0 0 ${model.graph.width} ${model.graph.height}`, width: model.graph.width, height: model.graph.height, role: 'group', 'aria-label': `Step graph with ${model.steps.length} steps` },
    s('defs', {}, s('marker', { id: 'awp-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, s('path', { d: 'M0 0L10 5L0 10z', class: 'arrow' }))),
    s('g', {}, edges), s('g', {}, nodes));
  return section('graph', 'Workflow', h('div', { class: 'graph-wrap', tabindex: 0, role: 'region', 'aria-label': 'Step graph, scrollable' }, svgEl), { count: model.steps.length });
}

export function renderSteps(model, ctx) {
  if (!model.steps.length) return null;
  const cards = model.steps.map((st) => h('article', { class: ['card', ctx.problemsAt(st.pointer) ? 'has-problems' : null], 'data-pointer': st.pointer },
    h('h3', {}, h('button', { type: 'button', class: 'link', onclick: () => ctx.navigate(st.pointer) }, st.id), ' ', badge(TYPE_LABEL[st.type] ?? st.type, `type-${st.type}`),
      st.forEach ? [' ', badge('for each', 'for-each', 'iteration over a list (spec 5.6.4)')] : null,
      st.extensions.map((x) => badge(x, 'ext', 'extension field (spec 3.3)'))),
    facts([
      ['For each', st.forEach ? forEachText(st.forEach) : undefined],
      ['Agent', st.agent],
      ['Task', st.task],
      ['Command', st.command ? h('code', {}, st.command) : undefined],
      ['Image', st.image],
      ['Environment', st.env],
      ['Approval', st.approval],
      ['After', st.dependsOn],
      ['Outputs', st.outputs.map((o) => `${o.name}${o.classification ? ` (${o.classification})` : ''}`)],
      ['Timeout', st.timeout],
      ['Retries', st.retries],
      ['Budget', st.budget ? cell(st.budget) : undefined],
    ])));
  return section('steps', 'Steps', h('div', { class: 'cards' }, cards), { level: 2 });
}

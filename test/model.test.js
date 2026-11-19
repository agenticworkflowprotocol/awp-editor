import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { buildModel, combine, decide, layoutSteps, locate, parseSource, pointerAt, shorthandDenials } from '../src/model/index.js';

const vendorSpec = new URL('../node_modules/@agenticworkflowprotocol/validator/vendor/awp/spec/', import.meta.url);
const examplesOf = (version) => fileURLToPath(new URL(`${version}/examples/`, vendorSpec));
const examplesDir = examplesOf('v1alpha1');
const example = (name, dir = examplesDir) => readFileSync(dir + name, 'utf8');

test('every manifest example of the specification builds a model', () => {
  for (const version of ['v1alpha1', 'v1alpha2']) {
    const dir = examplesOf(version);
    const files = readdirSync(dir).filter((f) => /\.(workflow|agent|policy)\.yaml$/.test(f));
    assert.ok(files.length >= 5, version);
    for (const f of files) {
      const m = buildModel(parse(example(f, dir)));
      assert.ok(m.kind && m.name, `${version}/${f}`);
    }
  }
});

test('image-review (v1alpha2): an iterating step carries its list, bound and concurrency', () => {
  const m = buildModel(parse(example('image-review.workflow.yaml', examplesOf('v1alpha2'))));
  const byId = Object.fromEntries(m.steps.map((s) => [s.id, s]));
  assert.deepEqual(byId.scan.forEach, { items: 'steps.images.outputs.refs', maxItems: 20, concurrency: 2 });
  assert.equal(byId.images.forEach, undefined);
  assert.deepEqual(m.graph.nodes.map((n) => n.level), [0, 1, 2]);
});

test('forEach without concurrency defaults to one item at a time', () => {
  const m = buildModel({ kind: 'Workflow', metadata: { name: 'x' }, spec: { workflow: [{ id: 'a', agent: 'w', forEach: { items: '${{ inputs.files }}', maxItems: 3 } }] } });
  assert.deepEqual(m.steps[0].forEach, { items: 'inputs.files', maxItems: 3, concurrency: 1 });
});

test('vulnerability-fixer: steps, levels, actions and policy shorthands', () => {
  const m = buildModel(parse(example('vulnerability-fixer.workflow.yaml')));
  assert.deepEqual(m.steps.map((s) => [s.id, s.type]), [['investigate', 'agent'], ['fix', 'agent'], ['test', 'command']]);
  assert.deepEqual(m.graph.nodes.map((n) => n.level), [0, 1, 2]);
  const byAction = Object.fromEntries(m.actions.map((a) => [a.action, a]));
  // listed tools of the researcher
  assert.equal(byAction['github.search_code'].exposure, 'listed');
  // the fixer gets all tools of the server; tools known from action groups are shown
  assert.equal(byAction['github.merge_pull_request'].exposure, 'all-tools');
  assert.deepEqual(byAction['github.merge_pull_request'].deniedByPolicy, ['policies.merge.allow']);
  assert.ok(byAction['github.merge_pull_request'].groups.includes('git.merge'));
  // group names are not tools
  assert.equal(byAction['github.read'], undefined);
  assert.equal(byAction['shell.execute'].exposedTo[0], 'step test');
  assert.equal(byAction['shell.execute'].allowed, true);
});

test('invoice-processing: approval required for the payment draft', () => {
  const m = buildModel(parse(example('invoice-processing.workflow.yaml')));
  const draft = m.actions.find((a) => a.action === 'erp.create_payment_draft');
  assert.ok(draft.approval.length > 0);
});

test('kind Agent and kind Policy', () => {
  const agent = buildModel(parse(example('invoice-extractor.agent.yaml')));
  assert.equal(agent.agents.length, 1);
  assert.equal(agent.steps.length, 0);
  const policy = buildModel(parse(example('no-production-autonomy.policy.yaml')));
  assert.ok(policy.rules.length > 0);
  assert.deepEqual(policy.actions, []);
});

test('permissions: deny wins, default deny, absent permissions allow, all levels must allow', () => {
  const groups = { 'git.merge': ['gh.merge'] };
  assert.equal(decide(undefined, 'gh.merge').allowed, true);
  assert.equal(decide({}, 'gh.merge').allowed, false);
  assert.equal(decide({ default: 'allow' }, 'gh.merge').allowed, true);
  assert.equal(decide({ tools: { 'gh.*': { allow: true }, 'git.merge': { allow: false } } }, 'gh.merge', groups).allowed, false);
  assert.equal(decide({ tools: { 'gh.*': { allow: true } } }, 'gh.read').reason, 'allowed by gh.*');
  const both = combine([{ scope: 'workflow', permissions: { tools: { 'gh.merge': { allow: true } } } }, { scope: 'agent a', permissions: { default: 'deny' } }], 'gh.merge');
  assert.equal(both.allowed, false);
  assert.match(both.reason, /^agent a: default: deny/);
  assert.deepEqual(shorthandDenials({ merge: { allow: false } }, 'gh.merge', groups), ['policies.merge.allow']);
  assert.deepEqual(shorthandDenials({ merge: { allow: true } }, 'gh.merge', groups), []);
});

test('extension fields are collected with their pointer', () => {
  const m = buildModel({ kind: 'Workflow', spec: { workflow: [{ id: 'a', 'x-example-tool': { call: 'x/y' } }] }, 'x-example-root': 1 });
  assert.deepEqual(m.extensions.map((x) => x.pointer).sort(), ['/spec/workflow/0/x-example-tool', '/x-example-root']);
  assert.deepEqual(m.steps[0].extensions, ['x-example-tool']);
});

test('layout: dependencies above dependents, cycles do not hang', () => {
  const g = layoutSteps([{ id: 'a', dependsOn: [] }, { id: 'b', dependsOn: ['a'] }, { id: 'c', dependsOn: ['a'] }, { id: 'd', dependsOn: ['b', 'c'] }]);
  assert.deepEqual(g.nodes.map((n) => [n.id, n.level]), [['a', 0], ['b', 1], ['c', 1], ['d', 2]]);
  assert.equal(g.edges.length, 4);
  const cyclic = layoutSteps([{ id: 'x', dependsOn: ['y'] }, { id: 'y', dependsOn: ['x'] }, { id: 'z', dependsOn: [] }]);
  assert.equal(cyclic.nodes.length, 3);
  assert.equal(layoutSteps([]).height, 0);
});

test('tolerates invalid input', () => {
  for (const v of [undefined, null, 42, 'text', [], { spec: 'x' }, { kind: 'Workflow', spec: { agents: 'x', workflow: [null, 1, { dependsOn: 'a' }] } }]) {
    assert.doesNotThrow(() => buildModel(v));
  }
});

test('source positions: pointer to line and offset to pointer, also in later documents', () => {
  const text = example('vulnerability-fixer.workflow.yaml');
  const source = parseSource(text);
  const fix = locate(source, 0, '/spec/workflow/1');
  assert.equal(text.split('\n')[fix.line - 1].trim(), '- id: fix');
  const agentLine = locate(source, 0, '/spec/agents/1/model/name');
  assert.equal(text.split('\n')[agentLine.line - 1].trim(), 'name: qwen3');
  const offset = text.indexOf('npm test');
  assert.deepEqual(pointerAt(source, offset), { document: 0, pointer: '/spec/workflow/2/command' });
  const multi = `a: 1\n---\nkind: Workflow\nspec:\n  workflow:\n    - id: s\n`;
  assert.deepEqual(pointerAt(parseSource(multi), multi.indexOf('id: s') + 1), { document: 1, pointer: '/spec/workflow/0/id' });
});

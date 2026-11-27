// View model of an AWP manifest: everything the viewer shows, computed from the parsed manifest
// without any DOM. Tolerant of invalid input: missing or wrongly typed fields become empty values,
// so a manifest can be shown while it is being written.
import { layoutSteps } from './graph.js';
import { approvalKeys, combine, groupsOf, shorthandDenials } from './permissions.js';

export { layoutSteps, NODE } from './graph.js';
export { SHORTHANDS, approvalKeys, combine, decide, groupsOf, keyMatches, shorthandDenials } from './permissions.js';
export { documentAt, locate, parseSource, pointerAt } from './source.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (typeof v === 'string' ? v : undefined);
const escape = (s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1');

function owner(meta) {
  if (typeof meta.owner === 'string') return { team: meta.owner };
  return isObj(meta.owner) ? { team: str(meta.owner.team), contact: str(meta.owner.contact) } : {};
}

function toolSources(tools) {
  return list(tools).filter(isObj).map((t) => ({
    type: str(t.type) ?? 'mcp',
    ...(t.server !== undefined ? { server: String(t.server) } : {}),
    ...(t.name !== undefined ? { name: String(t.name) } : {}),
    // null: every tool of the server (spec 5.5.2 default)
    tools: Array.isArray(t.tools) ? t.tools.map(String) : null,
  }));
}

function agentOf(a, i, base = '/spec/agents') {
  return {
    id: str(a.id) ?? `#${i}`,
    pointer: `${base}/${i}`,
    form: a.protocol === 'a2a' ? 'remote' : a.ref ? 'reference' : 'inline',
    model: isObj(a.model) ? { provider: str(a.model.provider), name: str(a.model.name), version: str(a.model.version), region: str(a.model.region) } : undefined,
    instructions: str(a.instructions),
    promptRef: isObj(a.promptRef) ? a.promptRef : undefined,
    ref: isObj(a.ref) ? a.ref : str(a.ref),
    url: str(a.url),
    tools: toolSources(a.tools),
    permissions: isObj(a.permissions) ? a.permissions : undefined,
    budget: isObj(a.budget) ? a.budget : undefined,
  };
}

function stepOf(s, i) {
  const type = str(s.type) ?? 'agent';
  return {
    id: str(s.id) ?? `#${i}`,
    pointer: `/spec/workflow/${i}`,
    type,
    agent: str(s.agent),
    task: str(s.task),
    dependsOn: list(s.dependsOn).map(String),
    outputs: list(s.outputs).filter(isObj).map((o) => ({ name: String(o.name ?? ''), classification: str(o.classification), description: str(o.description) })),
    timeout: str(s.timeout),
    retries: typeof s.retries === 'number' ? s.retries : undefined,
    budget: isObj(s.budget) ? s.budget : undefined,
    command: str(s.command),
    image: str(s.image),
    env: isObj(s.env) ? s.env : undefined,
    approval: isObj(s.approval) ? s.approval : undefined,
    input: isObj(s.input) ? s.input : undefined,
    forEach: forEachOf(s.forEach),
    when: str(s.when),
    workflow: workflowCallOf(s.workflow),
    // v1alpha1/v1alpha2: x- keys on the step; v1alpha3: keys of the step's `extensions` object.
    extensions: [...Object.keys(s).filter((k) => k.startsWith('x-')), ...Object.keys(isObj(s.extensions) ? s.extensions : {})],
  };
}
/** Iteration of a step (v1alpha2 spec 5.6.4, v1alpha3 spec 5.6.5): what the list is, its bound and the concurrency. */
function forEachOf(f) {
  if (!isObj(f)) return undefined;
  // `${{ steps.images.outputs.refs }}` -> `steps.images.outputs.refs`
  const items = str(f.items)?.replace(/^\$\{\{\s*|\s*\}\}$/g, '');
  return {
    items: items ?? '?',
    maxItems: typeof f.maxItems === 'number' ? f.maxItems : undefined,
    concurrency: typeof f.concurrency === 'number' ? f.concurrency : 1,
  };
}

/** Child workflow of a `type: workflow` step (v1alpha4 spec 5.6.6); `wait` defaults to true. */
function workflowCallOf(w) {
  if (!isObj(w)) return undefined;
  return {
    ref: str(w.ref),
    version: str(w.version),
    inputs: isObj(w.inputs) ? w.inputs : undefined,
    wait: w.wait !== false,
  };
}

/** Every `x-` field with its JSON Pointer (spec 3.3). */
export function extensionFields(value, pointer = '') {
  if (Array.isArray(value)) return value.flatMap((v, i) => extensionFields(v, `${pointer}/${i}`));
  if (!isObj(value)) return [];
  return Object.entries(value).flatMap(([k, v]) => {
    const p = `${pointer}/${escape(k)}`;
    return k.startsWith('x-') ? [{ name: k, pointer: p, value: v }] : extensionFields(v, p);
  });
}

/**
 * Actions the manifest exposes, with the static decision of `permissions` and `approval`.
 * Tool sources without a `tools` list expose every tool of the server; the tools known for such a
 * server (from other agents, action groups and permission keys) are listed with `known: false`.
 */
export function actionsOf({ agents, steps, spec }) {
  const groups = isObj(spec.actionGroups) ? spec.actionGroups : {};
  const rows = new Map();
  const add = (action, by, exposure) => {
    const row = rows.get(action) ?? { action, exposedTo: [], exposure };
    if (!row.exposedTo.includes(by)) row.exposedTo.push(by);
    if (exposure === 'listed') row.exposure = 'listed';
    rows.set(action, row);
  };
  const knownTools = (server) => {
    const names = new Set();
    for (const a of agents) for (const t of a.tools) if (t.server === server && t.tools) t.tools.forEach((n) => names.add(n));
    const candidates = [...Object.values(groups).flat(), ...Object.keys(spec.permissions?.tools ?? {}), ...list(spec.approval?.requiredFor)];
    for (const c of candidates) {
      // Group names (for example github.read) are not tools.
      if (typeof c === 'string' && c.startsWith(`${server}.`) && !c.endsWith('.*') && !(c in groups)) names.add(c.slice(server.length + 1));
    }
    return [...names].sort();
  };
  for (const a of agents) {
    for (const t of a.tools) {
      if (t.type === 'builtin') { add(t.name === 'shell' ? 'shell.execute' : `${t.name}`, a.id, 'listed'); continue; }
      if (!t.server) continue;
      if (t.tools) t.tools.forEach((n) => add(`${t.server}.${n}`, a.id, 'listed'));
      else {
        const known = knownTools(t.server);
        if (known.length) known.forEach((n) => add(`${t.server}.${n}`, a.id, 'all-tools'));
        else add(`${t.server}.*`, a.id, 'all-tools');
      }
    }
    if (a.form === 'remote') add(`a2a.${a.id}.send`, a.id, 'listed');
  }
  for (const s of steps) if (s.type === 'command') add('shell.execute', `step ${s.id}`, 'listed');
  // Starting the child execution of a workflow step is an action (v1alpha4 spec 5.6.6).
  for (const s of steps) if (s.type === 'workflow') add('workflow.start', `step ${s.id}`, 'listed');

  return [...rows.values()].sort((x, y) => x.action.localeCompare(y.action)).map((row) => {
    const perAgent = row.exposedTo.map((by) => {
      const agent = agents.find((a) => a.id === by);
      const levels = [{ scope: 'workflow', permissions: spec.permissions }, ...(agent ? [{ scope: `agent ${agent.id}`, permissions: agent.permissions }] : [])];
      return { by, ...combine(levels, row.action, groups) };
    });
    return {
      ...row,
      groups: groupsOf(row.action, groups),
      permission: perAgent,
      // Allowed by permissions for at least one agent or step that has it.
      allowed: perAgent.some((p) => p.allowed),
      deniedByPolicy: shorthandDenials(spec.policies, row.action, groups),
      approval: approvalKeys(spec.approval, row.action, groups),
    };
  });
}

/** Budgets of workflow, agents and steps (spec 5.7). */
function budgetsOf(spec, agents, steps) {
  const out = [];
  if (isObj(spec.budget)) out.push({ scope: 'workflow', pointer: '/spec/budget', budget: spec.budget });
  for (const a of agents) if (a.budget) out.push({ scope: `agent ${a.id}`, pointer: `${a.pointer}/budget`, budget: a.budget });
  for (const s of steps) if (s.budget) out.push({ scope: `step ${s.id}`, pointer: `${s.pointer}/budget`, budget: s.budget });
  return out;
}

/** Governance blocks that are present, for the governance section (spec 7, 8, 10.2). */
function governanceOf(spec) {
  const keys = ['approval', 'policies', 'dataPolicy', 'modelPolicy', 'environment', 'environments', 'audit'];
  return keys.filter((k) => spec[k] !== undefined).map((k) => ({ key: k, pointer: `/spec/${k}`, value: spec[k] }));
}

const KRM_VERSIONS = ['v1alpha3', 'v1alpha4'];

/** Whether the governance fields of a document are in spec (v1alpha3 and later). */
function usesSpecGovernance(doc) {
  return typeof doc.apiVersion === 'string' && KRM_VERSIONS.some((v) => doc.apiVersion.endsWith(`/${v}`));
}

/**
 * Build the view model of one manifest.
 * @param {unknown} manifest parsed manifest
 */
export function buildModel(manifest) {
  const doc = isObj(manifest) ? manifest : {};
  const meta = isObj(doc.metadata) ? doc.metadata : {};
  const spec = isObj(doc.spec) ? doc.spec : {};
  const kind = str(doc.kind);
  // From v1alpha3 on (Kubernetes resource model) version, owner, classification and the other
  // governance fields are in spec; metadata holds only name, namespace, labels and annotations.
  const gov = usesSpecGovernance(doc) ? spec : meta;

  // kind: Agent is one agent whose fields are in spec (spec 6).
  const agents = kind === 'Agent' ? [{ ...agentOf({ id: meta.name, ...spec }, 0), pointer: '/spec' }] : list(spec.agents).filter(isObj).map((a, i) => agentOf(a, i));
  const steps = kind === 'Workflow' ? list(spec.workflow).filter(isObj).map(stepOf) : [];
  const graph = layoutSteps(steps);

  return {
    apiVersion: str(doc.apiVersion),
    kind,
    name: str(meta.name),
    version: str(gov.version),
    description: str(gov.description),
    purpose: str(gov.purpose),
    owner: owner(gov),
    classification: str(gov.classification),
    risk: isObj(gov.risk) ? { level: str(gov.risk.level), category: list(gov.risk.category).map(String) } : undefined,
    namespace: str(meta.namespace),
    labels: isObj(meta.labels) ? meta.labels : undefined,
    integrity: isObj(gov.integrity) ? gov.integrity : undefined,
    governancePointer: gov === spec ? '/spec' : '/metadata',
    workflowRef: kind === 'WorkflowRun' && isObj(spec.workflowRef) ? spec.workflowRef : undefined,
    triggers: list(spec.triggers).filter(isObj),
    inputs: list(spec.inputs).filter(isObj),
    agents,
    steps,
    graph,
    mcpServers: list(spec.mcpServers).filter(isObj),
    secrets: list(spec.secrets).filter(isObj).map((s) => ({ name: str(s.name), source: str(s.source), scope: list(s.scope).map(String) })),
    actionGroups: isObj(spec.actionGroups) ? spec.actionGroups : {},
    permissions: isObj(spec.permissions) ? spec.permissions : undefined,
    actions: kind === 'Policy' ? [] : actionsOf({ agents, steps, spec }),
    budgets: budgetsOf(spec, agents, steps),
    governance: governanceOf(spec),
    rules: kind === 'Policy' ? list(spec.rules).filter(isObj) : [],
    extensions: extensionFields(doc),
  };
}

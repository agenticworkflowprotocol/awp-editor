// Budgets, governance blocks, Policy rules and extension fields.
import { cell, h, section, table, yamlText } from './dom.js';

const LIMITS = [
  ['maxCostUsd', (b) => b.maxCostUsd !== undefined ? `$${b.maxCostUsd}` : undefined],
  ['maxSteps', (b) => b.maxSteps],
  ['maxDuration', (b) => b.maxDuration],
  ['maxTokens', (b) => b.resources?.maxTokens],
  ['maxToolCalls', (b) => b.resources?.maxToolCalls],
  ['maxRetries', (b) => b.resources?.maxRetries],
  ['maxConcurrency', (b) => b.resources?.maxConcurrency],
];

export function renderBudgets(model) {
  if (!model.budgets.length) return null;
  const used = LIMITS.filter(([, get]) => model.budgets.some((b) => get(b.budget) !== undefined));
  const rows = model.budgets.map((b) => [b.scope, ...used.map(([, get]) => cell(get(b.budget)))]);
  const note = h('p', { class: 'muted' }, 'Limits are nested: a step counts against its agent and the workflow; the effective limit is the minimum (spec 5.7).');
  return section('budgets', 'Budgets', [note, table('Budgets', ['Scope', ...used.map(([k]) => k)], rows, { rowAttrs: (i) => ({ 'data-pointer': model.budgets[i].pointer }) })]);
}

const GOVERNANCE_TITLES = {
  approval: 'Human approval (spec 7.6)',
  policies: 'Policies (spec 8.1)',
  dataPolicy: 'Data policy (spec 7.2, 7.3)',
  modelPolicy: 'Model policy (spec 7.4)',
  environment: 'Environment (spec 7.10)',
  environments: 'Environments (spec 7.10)',
  audit: 'Audit (spec 10.2)',
};

export function renderGovernance(model) {
  const blocks = [];
  if (model.permissions) {
    const { tools, ...rest } = model.permissions;
    blocks.push({ key: 'permissions', pointer: '/spec/permissions', title: 'Workflow permissions (spec 7.5)', value: { ...rest, tools: tools ? Object.keys(tools).length + ' rules (see Tools and permissions)' : undefined } });
  }
  for (const g of model.governance) blocks.push({ ...g, title: GOVERNANCE_TITLES[g.key] ?? g.key });
  if (!blocks.length) return null;
  return section('governance', 'Governance', h('div', { class: 'cards' }, blocks.map((b) => h('article', { class: 'card', 'data-pointer': b.pointer },
    h('h3', {}, b.title), h('pre', { class: 'yaml', tabindex: 0 }, yamlText(b.value))))));
}

export function renderPolicyRules(model) {
  if (model.kind !== 'Policy') return null;
  const rows = model.rules.map((r) => [r.id ?? '–', cell(r.when), r.effect ?? '–', r.approval ? cell(r.approval) : '–', r.message ?? r.description ?? '–']);
  return section('rules', 'Policy rules', table('Policy rules', ['Rule', 'When', 'Effect', 'Approval', 'Message'], rows, { rowAttrs: (i) => ({ 'data-pointer': `/spec/rules/${i}` }) }), { count: model.rules.length });
}

export function renderExtensions(model, ctx) {
  if (!model.extensions.length) return null;
  const rows = model.extensions.map((x) => [
    h('code', {}, x.name),
    h('button', { type: 'button', class: 'link', onclick: () => ctx.navigate(x.pointer) }, x.pointer),
    cell(x.value),
  ]);
  const note = h('p', { class: 'muted' }, 'Implementation-specific fields. Runtimes that do not understand them ignore them (spec 3.3); a field that restricts behaviour makes the manifest less portable.');
  return section('extensions', 'Extension fields', [note, table('Extension fields', ['Field', 'Location', 'Value'], rows)], { count: model.extensions.length });
}

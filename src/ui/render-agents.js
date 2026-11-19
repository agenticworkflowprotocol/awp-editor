// Agents, tools and permissions, MCP servers and secrets.
import { badge, cell, facts, h, section, table } from './dom.js';

function toolsText(t) {
  if (t.type === 'builtin') return `built-in ${t.name ?? ''}`.trim();
  return `${t.server ?? '?'}: ${t.tools ? (t.tools.length ? t.tools.join(', ') : 'no tools') : 'all tools of the server'}`;
}

function modelText(m) {
  if (!m) return undefined;
  return [m.provider, m.name].filter(Boolean).join(' / ') + (m.version ? ` ${m.version}` : '') + (m.region ? ` (${m.region})` : '');
}

export function renderAgents(model, ctx) {
  if (!model.agents.length) return null;
  const cards = model.agents.map((a) => h('article', { class: ['card', ctx.problemsAt(a.pointer) ? 'has-problems' : null], 'data-pointer': a.pointer },
    h('h3', {}, h('button', { type: 'button', class: 'link', onclick: () => ctx.navigate(a.pointer) }, a.id), ' ', a.form !== 'inline' ? badge(a.form, 'neutral') : null),
    facts([
      ['Model', modelText(a.model)],
      ['Reference', a.ref],
      ['Endpoint', a.url],
      ['Prompt', a.promptRef ? `${a.promptRef.name ?? ''} ${a.promptRef.version ?? ''}`.trim() : undefined],
      ['Tools', a.tools.length ? h('ul', { class: 'plain' }, a.tools.map((t) => h('li', {}, toolsText(t)))) : 'none'],
      ['Permissions', a.permissions ? `own (default ${a.permissions.default ?? 'deny'})` : undefined],
      ['Budget', a.budget ? cell(a.budget) : undefined],
    ]),
    a.instructions ? h('details', {}, h('summary', {}, 'Instructions'), h('pre', { class: 'text', tabindex: 0 }, a.instructions)) : null));
  return section('agents', 'Agents', h('div', { class: 'cards' }, cards), { count: model.agents.length });
}

function decisionCell(row) {
  if (row.deniedByPolicy.length) return badge('denied', 'bad', `denied by ${row.deniedByPolicy.join(', ')} (spec 8.1)`);
  const allowedFor = row.permission.filter((p) => p.allowed).map((p) => p.by);
  if (!allowedFor.length) return badge('denied', 'bad', row.permission.map((p) => `${p.by}: ${p.reason}`).join('\n'));
  const partial = allowedFor.length < row.permission.length;
  const restricted = row.permission.some((p) => p.resources?.length);
  return h('span', {}, badge(partial ? `allowed for ${allowedFor.join(', ')}` : 'allowed', 'ok', row.permission.map((p) => `${p.by}: ${p.reason}`).join('\n')),
    restricted ? badge('resource scope', 'neutral', row.permission.flatMap((p) => p.resources ?? []).join(', ')) : null);
}

export function renderActions(model) {
  if (!model.actions.length) return null;
  const rows = model.actions.map((a) => [
    h('code', {}, a.action),
    a.exposedTo.join(', '),
    a.exposure === 'all-tools' ? h('span', { class: 'muted', title: 'The agent gets all tools of the server; this tool is known from other parts of the manifest.' }, 'all tools of the server') : 'listed',
    decisionCell(a),
    a.approval.length ? badge('required', 'warn', `approval.requiredFor: ${a.approval.join(', ')}`) : '–',
    a.groups.length ? a.groups.join(', ') : '–',
  ]);
  const note = h('p', { class: 'muted' }, 'Static view of permissions (spec 7.5), policy shorthands (spec 8.1) and approval.requiredFor (spec 7.6). Policy manifests, data and model policies and runtime rules can still deny an action or require approval.');
  return section('actions', 'Tools and permissions', [note, table('Tools and permissions', ['Action', 'Exposed to', 'Exposure', 'Permission', 'Approval', 'Groups'], rows)], { count: model.actions.length });
}

export function renderServersAndSecrets(model) {
  const servers = table('MCP servers', ['Server', 'Transport', 'URL or image', 'Version', 'Auth'], model.mcpServers.map((m) => [
    m.name ?? '–', m.transport ?? '–', m.url ?? m.image ?? '–', m.version ?? '–', m.auth?.secretRef ? `secret ${m.auth.secretRef}` : '–',
  ]), { rowAttrs: (i) => ({ 'data-pointer': `/spec/mcpServers/${i}` }) });
  const secrets = table('Secrets', ['Secret', 'Source', 'Scope'], model.secrets.map((x) => [x.name ?? '–', x.source ?? '–', x.scope.length ? x.scope.join(', ') : '–']),
    { rowAttrs: (i) => ({ 'data-pointer': `/spec/secrets/${i}` }) });
  const groups = Object.entries(model.actionGroups);
  const groupTable = table('Action groups', ['Group', 'Actions'], groups.map(([g, members]) => [h('code', {}, g), cell(members)]));
  return section('connections', 'MCP servers, secrets and action groups', [servers, secrets, groupTable]);
}

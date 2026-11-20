// Header, problems, triggers and inputs.
import { badge, cell, facts, h, section, table } from './dom.js';

const RISK_TONE = { low: 'ok', medium: 'warn', high: 'bad', critical: 'bad' };

export function renderHeader(model, result) {
  const errors = result ? result.diagnostics.filter((d) => d.severity === 'error').length : 0;
  const warnings = result ? result.diagnostics.filter((d) => d.severity === 'warning').length : 0;
  const status = !result ? null
    : result.valid
      ? badge(warnings ? `valid, ${warnings} warning${warnings === 1 ? '' : 's'}` : 'valid', warnings ? 'warn' : 'ok')
      : badge(`invalid, ${errors} error${errors === 1 ? '' : 's'}`, 'bad');
  return h('header', { class: 'head', part: 'header', 'data-pointer': model.governancePointer },
    h('div', { class: 'head-row' },
      model.kind ? badge(model.kind, 'kind') : null,
      h('h2', { class: 'title' }, model.name ?? 'Untitled manifest', model.version ? h('span', { class: 'version' }, ` ${model.version}`) : null),
      status),
    model.description ? h('p', { class: 'description' }, model.description) : null,
    h('div', { class: 'head-meta' },
      model.owner.team ? badge(`owner: ${model.owner.team}`) : null,
      model.classification ? badge(`classification: ${model.classification}`) : null,
      model.risk?.level ? badge(`risk: ${model.risk.level}`, RISK_TONE[model.risk.level] ?? 'neutral') : null,
      model.integrity?.digest ? badge('digest', 'neutral', model.integrity.digest) : null,
      model.apiVersion ? h('span', { class: 'api' }, model.apiVersion) : null),
    model.purpose ? h('p', { class: 'muted' }, `Purpose: ${model.purpose}`) : null);
}

/** Diagnostics of the validator; each one links to its element. */
export function renderProblems(result, navigate) {
  if (!result || !result.diagnostics.length) return null;
  const items = result.diagnostics.map((d) => h('li', { class: `problem ${d.severity}` },
    h('button', { type: 'button', class: 'link', onclick: () => navigate(d.path) },
      h('span', { class: 'sev' }, d.severity),
      d.source?.line ? h('span', { class: 'pos' }, `${d.source.line}:${d.source.column}`) : null,
      h('code', {}, d.code),
      h('span', { class: 'msg' }, d.message),
      d.path ? h('code', { class: 'path' }, d.path) : null)));
  return section('problems', 'Problems', h('ul', { class: 'problems' }, items), { count: result.diagnostics.length });
}

export function renderTriggersAndInputs(model) {
  const triggers = model.triggers.length ? model.triggers : (model.kind === 'Workflow' ? [{ type: 'manual', implicit: true }] : []);
  const triggerRows = triggers.map((t) => [
    t.type ?? '–',
    t.implicit ? 'no triggers declared: manual start only (spec 5.2)'
      : t.type === 'schedule' ? `${t.cron ?? '–'}${t.timezone ? ` (${t.timezone})` : ''}`
        : t.type === 'event' ? `${t.source ?? '–'} · ${t.eventType ?? '–'}${t.filter ? ` · filter ${cell(t.filter)}` : ''}` : '–',
  ]);
  const inputRows = model.inputs.map((i) => [
    i.name ?? '–',
    i.type ?? '–',
    i.required ? 'yes' : 'no',
    i.default !== undefined ? cell(i.default) : '–',
    [i.pattern ? `pattern ${i.pattern}` : null, Array.isArray(i.enum) ? `one of ${cell(i.enum)}` : null].filter(Boolean).join('; ') || '–',
    i.description ?? '–',
  ]);
  return section('start', 'Triggers and inputs', [
    table('Triggers', ['Trigger', 'Details'], triggerRows),
    table('Inputs', ['Input', 'Type', 'Required', 'Default', 'Constraints', 'Description'], inputRows, { rowAttrs: (i) => ({ 'data-pointer': `/spec/inputs/${i}` }) }),
  ]);
}

export function renderMetadataFacts(model) {
  const workflow = model.workflowRef ? `${model.workflowRef.name ?? '–'}${model.workflowRef.version ? `@${model.workflowRef.version}` : ''}` : undefined;
  return facts([
    ['Namespace', model.namespace],
    ['Workflow', workflow],
    ['Contact', model.owner.contact],
    ['Risk categories', model.risk?.category],
    ['Labels', model.labels],
  ]);
}

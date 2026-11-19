// Small DOM helpers for the viewer. No innerHTML anywhere: every text from a manifest is inserted as
// a text node, so untrusted manifests cannot inject markup.
import { stringify } from 'yaml';

const SVG_NS = 'http://www.w3.org/2000/svg';

function apply(node, attrs) {
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
}

function append(node, children) {
  for (const c of children.flat(Infinity)) {
    if (c === undefined || c === null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** HTML element. */
export function h(tag, attrs, ...children) {
  const node = document.createElement(tag);
  apply(node, attrs);
  append(node, children);
  return node;
}

/** SVG element. */
export function s(tag, attrs, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  apply(node, attrs);
  append(node, children);
  return node;
}

/** Value as compact YAML for blocks that the viewer shows verbatim. */
export function yamlText(value) {
  try {
    return stringify(value, { lineWidth: 100 }).trimEnd();
  } catch {
    return String(value);
  }
}

/** A value as text for a table cell. */
export function cell(value) {
  if (value === undefined || value === null || value === '') return '–';
  if (Array.isArray(value)) return value.length ? value.map(cell).join(', ') : '–';
  if (typeof value === 'object') return yamlText(value).replace(/\n\s*/g, '; ');
  return String(value);
}

/** Section with a heading; returns nothing for empty content. */
export function section(id, title, content, { level = 2, count } = {}) {
  const items = [content].flat().filter(Boolean);
  if (!items.length) return null;
  return h('section', { class: 'section', id: `awp-${id}`, part: `section section-${id}`, 'aria-labelledby': `awp-${id}-title` },
    h(`h${level}`, { id: `awp-${id}-title` }, title, count !== undefined ? h('span', { class: 'count' }, String(count)) : null),
    items);
}

/** Table with header row; `rows` are arrays of cell contents. */
export function table(caption, headers, rows, { rowAttrs } = {}) {
  if (!rows.length) return null;
  // The region name differs from the section heading, so landmarks stay unique.
  return h('div', { class: 'table-wrap', tabindex: 0, role: 'region', 'aria-label': `${caption} table, scrollable` },
    h('table', {},
      h('caption', { class: 'sr-only' }, caption),
      h('thead', {}, h('tr', {}, headers.map((x) => h('th', { scope: 'col' }, x)))),
      h('tbody', {}, rows.map((r, i) => h('tr', rowAttrs?.(i) ?? {}, r.map((c, j) => (j === 0 ? h('th', { scope: 'row' }, c) : h('td', {}, c))))))));
}

/** Small label. */
export const badge = (text, tone = 'neutral', title) => h('span', { class: `badge ${tone}`, ...(title ? { title } : {}) }, text);

/** Definition list from pairs; skips empty values. */
export function facts(pairs) {
  const shown = pairs.filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length));
  if (!shown.length) return null;
  return h('dl', { class: 'facts' }, shown.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v instanceof Node ? v : cell(v))]));
}

// Mapping between positions in the manifest text and JSON Pointers into the parsed manifest, so
// that the viewer can jump to the source of an element and the editor cursor can select an element.
import { LineCounter, isMap, isPair, isScalar, isSeq, parseAllDocuments } from 'yaml';

const escape = (s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1');
const unescape = (s) => s.replace(/~1/g, '/').replace(/~0/g, '~');

/** Parse a text once for position lookups. */
export function parseSource(text) {
  const lineCounter = new LineCounter();
  const docs = Array.from(parseAllDocuments(String(text ?? ''), { version: '1.2', schema: 'core', lineCounter, keepSourceTokens: false }));
  return { docs, lineCounter };
}

/** Start of the node at a pointer (or its closest existing parent) as offset, line and column (1-based). */
export function locate(source, documentIndex, pointer) {
  const doc = source.docs[documentIndex];
  if (!doc) return undefined;
  const parts = pointer ? pointer.split('/').slice(1).map(unescape) : [];
  for (let n = parts.length; n >= 0; n--) {
    const keys = parts.slice(0, n).map((p) => (/^\d+$/.test(p) ? Number(p) : p));
    const node = n === 0 ? doc.contents : doc.getIn(keys, true);
    const offset = node?.range?.[0];
    if (offset !== undefined) {
      // For a map entry, point at its key line rather than the value.
      const pair = n > 0 ? pairOf(doc, keys) : undefined;
      const start = pair?.key?.range?.[0] ?? offset;
      const { line, col } = source.lineCounter.linePos(start);
      return { offset: start, line, column: col };
    }
  }
  return undefined;
}

function pairOf(doc, keys) {
  const parent = keys.length > 1 ? doc.getIn(keys.slice(0, -1), true) : doc.contents;
  if (!isMap(parent)) return undefined;
  return parent.items.find((p) => isPair(p) && isScalar(p.key) && p.key.value === keys.at(-1));
}

/** Index of the document that contains an offset. */
export function documentAt(source, offset) {
  const i = source.docs.findIndex((d) => d.range && offset >= d.range[0] && offset <= d.range[2]);
  return i === -1 ? Math.max(0, source.docs.length - 1) : i;
}

/** Deepest JSON Pointer at a character offset. */
export function pointerAt(source, offset) {
  const document = documentAt(source, offset);
  const path = [];
  let node = source.docs[document]?.contents;
  while (node) {
    let next;
    if (isMap(node)) {
      const pair = node.items.find((p) => {
        const start = p.key?.range?.[0];
        const end = p.value?.range?.[2] ?? p.key?.range?.[2];
        return start !== undefined && offset >= start && offset <= end;
      });
      if (pair && isScalar(pair.key)) { path.push(String(pair.key.value)); next = pair.value; }
    } else if (isSeq(node)) {
      const index = node.items.findIndex((item) => item?.range && offset >= item.range[0] && offset <= item.range[2]);
      if (index !== -1) { path.push(index); next = node.items[index]; }
    }
    if (!next || isScalar(next)) break;
    node = next;
  }
  return { document, pointer: path.map((p) => `/${escape(p)}`).join('') };
}

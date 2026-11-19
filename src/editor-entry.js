// Bundle entry dist/awp-editor.mjs: registers <awp-editor> and <awp-viewer> on import.
import { AwpEditor, AwpViewer, defineEditor } from './ui/editor.js';
import { defineViewer } from './ui/viewer.js';

export { AwpEditor, AwpViewer, defineEditor, defineViewer };
export { buildModel } from './model/index.js';
// YAML 1.2 parser of the bundle, for hosts that need the parsed manifest (first document).
export { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
export { validateManifest, validateText } from '@agenticworkflowprotocol/validator/browser';

defineEditor();

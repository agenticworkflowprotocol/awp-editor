// Bundle entry dist/awp-viewer.mjs: registers <awp-viewer> on import.
import { AwpViewer, defineViewer } from './ui/viewer.js';

export { AwpViewer, defineViewer };
export { buildModel } from './model/index.js';
// YAML 1.2 parser of the bundle, for hosts that need the parsed manifest (first document).
export { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
export { validateManifest, validateText } from '@agenticworkflowprotocol/validator/browser';

defineViewer();

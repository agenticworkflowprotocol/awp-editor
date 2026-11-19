# Changelog

All notable changes are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-11-19

### Changed

- Depends on `@agenticworkflowprotocol/validator` 0.1.0 from the npm registry instead of the release tarball.
- Viewer and editor use the colours of agenticworkflowprotocol.org (teal accent); embedders can still override the CSS custom properties.
- Website: AWP logo, favicons, social preview image and shared navigation with the specification site and the validator.
- Releases are published automatically from `main` with npm provenance.

## [0.1.0] - 2026-11-19

### Added

- `<awp-viewer>`: header, problems, step graph, steps, agents, tools and permissions (static
  decision of permissions, policy shorthands and approval.requiredFor), triggers and inputs,
  budgets, governance, MCP servers, secrets, action groups and extension fields; several documents
  per file; validation with `@agenticworkflowprotocol/validator` 0.1.0.
- `<awp-editor>`: CodeMirror 6 YAML editor next to the viewer, problems in the gutter, cursor
  selects the element in the viewer, a click in the viewer moves the cursor.
- View model for Node.js (`@agenticworkflowprotocol/editor/model`).
- Website (editor.agenticworkflowprotocol.org): editor with examples, open file, download as YAML
  or JSON and share links in the URL fragment; standalone viewer (`viewer.html?url=`); embedding
  guide.
- Tests: view model against the specification examples; browser test in Chrome with the site's
  Content-Security-Policy and axe-core in light and dark mode.

[0.1.1]: https://github.com/agenticworkflowprotocol/awp-editor/releases/tag/v0.1.1
[0.1.0]: https://github.com/agenticworkflowprotocol/awp-editor/releases/tag/v0.1.0
